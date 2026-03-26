const cloud = require('wx-server-sdk');
const ExcelJS = require('exceljs');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const MEMBER_COLLECTION = 'members';
const TRAINING_COLLECTION = 'trainings';
const FETCH_LIMIT = 100;
const TRAINING_TYPE_NORMAL = '例训';
const TRAINING_TYPE_MAKEUP = '补训';
const ATTENDANCE_STATUS_LEAVE = '请假';

function normalizeText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function fetchTimestampLabel() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return year + month + day + '_' + hour + minute + second;
}

async function fetchAll(collectionRef, query) {
  const result = [];
  let offset = 0;
  const hasQuery = query && Object.keys(query).length > 0;

  while (true) {
    const ref = hasQuery ? collectionRef.where(query) : collectionRef;
    const res = await ref.skip(offset).limit(FETCH_LIMIT).get();
    const data = res.data || [];
    result.push.apply(result, data);

    if (data.length < FETCH_LIMIT) {
      break;
    }

    offset += data.length;
  }

  return result;
}

function normalizeTrainingType(type, title) {
  const rawType = normalizeText(type);
  const rawTitle = normalizeText(title);

  if (rawType === '日常训练') {
    return '例训';
  }

  if (rawType === '专项训练' || rawType === '彩排') {
    return '补训';
  }

  if (rawType === TRAINING_TYPE_NORMAL || rawType === TRAINING_TYPE_MAKEUP) {
    return rawType;
  }

  if (rawTitle.indexOf(TRAINING_TYPE_MAKEUP) !== -1) {
    return TRAINING_TYPE_MAKEUP;
  }

  if (rawTitle.indexOf(TRAINING_TYPE_NORMAL) !== -1) {
    return TRAINING_TYPE_NORMAL;
  }

  return rawType;
}

function isActiveMember(member) {
  const status = normalizeText(member && member.status);
  return !status || status === '在队';
}

function parseGradeValue(grade) {
  const text = normalizeText(grade);
  const matched = text.match(/\d+/);
  if (!matched) {
    return Number.MAX_SAFE_INTEGER;
  }

  let value = parseInt(matched[0], 10);
  if (value < 100) {
    value += 2000;
  }
  return value;
}

function compareDesc(a, b) {
  if (a === b) {
    return 0;
  }
  return a > b ? -1 : 1;
}

function buildTrainingMap(trainings) {
  const map = {};
  (trainings || []).forEach(function(training) {
    if (training && training.id) {
      map[training.id] = training;
    }
  });
  return map;
}

function getMakeupStatus(record, makeupTraining, today) {
  const currentDay = today || '';
  const makeupTrainingId = normalizeText(record && record.makeupTrainingId);
  const makeupDate = normalizeText(
    makeupTraining && makeupTraining.date ? makeupTraining.date : (record && record.makeupTrainingDate)
  );

  if (!makeupTrainingId) {
    return 'pending';
  }

  if (makeupDate && currentDay && makeupDate > currentDay) {
    return 'scheduled';
  }

  return 'assigned';
}

function buildMemberSummaries(members, trainings) {
  const trainingMap = buildTrainingMap(trainings);
  const today = new Date();
  const todayText = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');

  return (members || []).map(function(member) {
    let pendingCount = 0;
    let upcomingCount = 0;
    let totalCount = 0;

    (trainings || []).forEach(function(training) {
      (training.attendance || []).forEach(function(record) {
        if (!record || record.memberId !== member.id || record.status !== ATTENDANCE_STATUS_LEAVE) {
          return;
        }

        totalCount += 1;
        const makeupTraining = record.makeupTrainingId ? trainingMap[record.makeupTrainingId] : null;
        const status = getMakeupStatus(record, makeupTraining, todayText);

        if (status === 'pending') {
          pendingCount += 1;
        } else if (status === 'scheduled') {
          upcomingCount += 1;
        }
      });
    });

    return Object.assign({}, member, {
      makeupPendingCount: pendingCount,
      makeupUpcomingCount: upcomingCount,
      makeupTotalCount: totalCount
    });
  }).sort(function(a, b) {
    if (a.makeupPendingCount !== b.makeupPendingCount) {
      return b.makeupPendingCount - a.makeupPendingCount;
    }

    if (a.makeupUpcomingCount !== b.makeupUpcomingCount) {
      return b.makeupUpcomingCount - a.makeupUpcomingCount;
    }

    if (a.makeupTotalCount !== b.makeupTotalCount) {
      return b.makeupTotalCount - a.makeupTotalCount;
    }

    const gradeDiff = parseGradeValue(a.grade) - parseGradeValue(b.grade);
    if (gradeDiff !== 0) {
      return gradeDiff;
    }

    const joinDateDiff = normalizeText(a.joinDate).localeCompare(normalizeText(b.joinDate));
    if (joinDateDiff !== 0) {
      return joinDateDiff;
    }

    const studentIdDiff = normalizeText(a.studentId).localeCompare(normalizeText(b.studentId));
    if (studentIdDiff !== 0) {
      return studentIdDiff;
    }

    return normalizeText(a.name).localeCompare(normalizeText(b.name));
  });
}

function compareTrainingAsc(a, b) {
  const dateCompare = normalizeText(a.date).localeCompare(normalizeText(b.date));
  if (dateCompare !== 0) {
    return dateCompare;
  }

  const timeCompare = normalizeText(a.time).localeCompare(normalizeText(b.time));
  if (timeCompare !== 0) {
    return timeCompare;
  }

  return Number(a.createdAt || 0) - Number(b.createdAt || 0);
}

function buildWorksheet(workbook, members, normalTrainings, trainingMap) {
  const sheet = workbook.addWorksheet('补训记录');
  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3E4C8' }
  };
  const redFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF4CCCC' }
  };
  const greenFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFC6E0B4' }
  };
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
  };

  sheet.getCell(1, 1).value = '成员';
  sheet.getCell(1, 1).font = { bold: true };
  sheet.getCell(1, 1).alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getCell(1, 1).fill = headerFill;
  sheet.getCell(1, 1).border = thinBorder;
  sheet.getColumn(1).width = 16;

  normalTrainings.forEach(function(training, index) {
    const cell = sheet.getCell(1, index + 2);
    cell.value = normalizeText(training.date) || normalizeText(training.title) || ('例训' + (index + 1));
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = headerFill;
    cell.border = thinBorder;
    sheet.getColumn(index + 2).width = 14;
  });

  const leaveMaps = normalTrainings.map(function(training) {
    const map = {};
    (training.attendance || []).forEach(function(record) {
      if (record && record.memberId && record.status === ATTENDANCE_STATUS_LEAVE) {
        map[record.memberId] = record;
      }
    });
    return map;
  });

  members.forEach(function(member, memberIndex) {
    const rowIndex = memberIndex + 2;
    const nameCell = sheet.getCell(rowIndex, 1);
    nameCell.value = normalizeText(member.name) || ('成员' + rowIndex);
    nameCell.alignment = { vertical: 'middle', horizontal: 'left' };
    nameCell.border = thinBorder;

    normalTrainings.forEach(function(training, trainingIndex) {
      const cell = sheet.getCell(rowIndex, trainingIndex + 2);
      const leaveRecord = leaveMaps[trainingIndex][member.id];

      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = thinBorder;

      if (!leaveRecord) {
        cell.value = '';
        return;
      }

      const makeupTraining = leaveRecord.makeupTrainingId ? trainingMap[leaveRecord.makeupTrainingId] : null;
      const makeupDate = normalizeText(
        makeupTraining && makeupTraining.date ? makeupTraining.date : leaveRecord.makeupTrainingDate
      );

      if (normalizeText(leaveRecord.makeupTrainingId)) {
        cell.value = makeupDate || '已补';
        cell.fill = greenFill;
        cell.font = { color: { argb: 'FF1D6F42' }, bold: true };
      } else {
        cell.value = '';
        cell.fill = redFill;
      }
    });
  });

  sheet.getRow(1).height = 28;
  return sheet;
}

exports.main = async function() {
  try {
    const members = (await fetchAll(db.collection(MEMBER_COLLECTION)))
      .filter(isActiveMember);
    const trainings = await fetchAll(db.collection(TRAINING_COLLECTION));
    const normalizedTrainings = trainings.map(function(training) {
      return Object.assign({}, training, {
        type: normalizeTrainingType(training.type, training.title)
      });
    });
    const normalTrainings = normalizedTrainings
      .filter(function(training) {
        return training.type === TRAINING_TYPE_NORMAL;
      })
      .sort(compareTrainingAsc);

    if (!members.length) {
      throw new Error('当前没有可导出的在队成员');
    }

    if (!normalTrainings.length) {
      throw new Error('当前没有可导出的例训记录');
    }

    const sortedMembers = buildMemberSummaries(members, normalizedTrainings);
    const trainingMap = buildTrainingMap(normalizedTrainings);
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'CSU Flag Guard Mini Program';
    workbook.created = new Date();
    buildWorksheet(workbook, sortedMembers, normalTrainings, trainingMap);

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = '特勤部补训记录导出_' + fetchTimestampLabel() + '.xlsx';
    const cloudPath = 'exports/makeup/' + fileName;

    const uploadRes = await cloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: Buffer.from(buffer)
    });

    return {
      success: true,
      fileID: uploadRes.fileID,
      fileName: fileName,
      memberCount: sortedMembers.length,
      trainingCount: normalTrainings.length
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: err.message || '导出补训记录失败'
    };
  }
};
