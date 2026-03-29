const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const FETCH_LIMIT = 100;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const ATTENDANCE_STATUS_LEAVE = '请假';
const ATTENDANCE_STATUS_UNRECORDED = '\u672a\u8bb0\u5f55';
const ATTENDANCE_STATUS_ARRIVED = '\u5df2\u5230';
const TRAINING_TYPE_MAKEUP = '\u8865\u8bad';

const POSITION_RANK = {
  '班长': 0,
  '副班长': 1,
  '办公室主任': 2,
  '特勤部部长': 3,
  '宣传部部长': 4,
  '财务部部长': 5
};

const LEGACY_POSITION_MAP = {
  '队长': '班长',
  '副队长': '副班长',
  '旗手': '擎旗手',
  '护旗手': '升旗手'
};

const LEGACY_TRAINING_TYPE_MAP = {
  '日常训练': '例训',
  '专项训练': '补训',
  '彩排': '补训'
};

function normalizeText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function clampPageSize(pageSize) {
  var size = Number(pageSize || DEFAULT_PAGE_SIZE);
  if (!size || size < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(size, MAX_PAGE_SIZE);
}

function normalizePage(page) {
  var value = Number(page || 1);
  if (!value || value < 1) {
    return 1;
  }
  return Math.floor(value);
}

function normalizePositions(position) {
  var list = Array.isArray(position) ? position.slice() : (position ? [position] : []);
  var normalized = [];

  list.forEach(function(item) {
    var mapped = LEGACY_POSITION_MAP[item] || item;
    if (mapped && normalized.indexOf(mapped) === -1) {
      normalized.push(mapped);
    }
  });

  return normalized;
}

function getPositionText(position) {
  return normalizePositions(position).join('、');
}

function enrichMember(member) {
  var positions = normalizePositions(member.position);
  return Object.assign({}, member, {
    _docId: member._id || member._docId || '',
    position: positions,
    positionText: getPositionText(positions),
    password: member.password || '123456'
  });
}

function normalizeTrainingType(type, title) {
  var rawType = normalizeText(type);
  var rawTitle = normalizeText(title);

  if (LEGACY_TRAINING_TYPE_MAP[rawType]) {
    return LEGACY_TRAINING_TYPE_MAP[rawType];
  }

  if (rawType === '例训' || rawType === '补训') {
    return rawType;
  }

  if (rawTitle.indexOf('补训') !== -1) {
    return '补训';
  }

  if (rawTitle.indexOf('例训') !== -1) {
    return '例训';
  }

  return rawType;
}

function enrichTraining(training) {
  return Object.assign({}, training, {
    _docId: training._id || training._docId || '',
    type: normalizeTrainingType(training.type, training.title),
    stats: calcAttendanceStats(training.attendance || [])
  });
}

function enrichFlag(flag) {
  return Object.assign({}, flag, {
    _docId: flag._id || flag._docId || '',
    stats: calcAttendanceStats(flag.attendance || [], 'flag')
  });
}

function parseGradeValue(grade) {
  var text = normalizeText(grade);
  var match = text.match(/\d+/);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  var value = parseInt(match[0], 10);
  if (value < 100) {
    value += 2000;
  }
  return value;
}

function getMemberStatusRank(status) {
  if (status === '在队') return 0;
  if (status === '离队') return 1;
  return 2;
}

function getPositionRank(position) {
  var positions = normalizePositions(position);
  var bestRank = Number.MAX_SAFE_INTEGER;

  positions.forEach(function(item) {
    if (Object.prototype.hasOwnProperty.call(POSITION_RANK, item)) {
      bestRank = Math.min(bestRank, POSITION_RANK[item]);
    }
  });

  return bestRank;
}

function compareMembers(a, b, groupByStatus) {
  if (groupByStatus) {
    var statusDiff = getMemberStatusRank(a.status) - getMemberStatusRank(b.status);
    if (statusDiff !== 0) {
      return statusDiff;
    }
  }

  var gradeDiff = parseGradeValue(a.grade) - parseGradeValue(b.grade);
  if (gradeDiff !== 0) {
    return gradeDiff;
  }

  var positionDiff = getPositionRank(a.position) - getPositionRank(b.position);
  if (positionDiff !== 0) {
    return positionDiff;
  }

  var joinDateDiff = normalizeText(a.joinDate).localeCompare(normalizeText(b.joinDate));
  if (joinDateDiff !== 0) {
    return joinDateDiff;
  }

  var studentIdDiff = normalizeText(a.studentId).localeCompare(normalizeText(b.studentId));
  if (studentIdDiff !== 0) {
    return studentIdDiff;
  }

  return normalizeText(a.name).localeCompare(normalizeText(b.name));
}

function parseDateTimeValue(date, time) {
  var dateText = normalizeText(date);
  if (!dateText) {
    return 0;
  }

  var timeText = normalizeText(time) || '00:00';
  var normalized = (dateText + ' ' + timeText).replace(/\./g, '-').replace('T', ' ');
  var timestamp = new Date(normalized).getTime();

  if (!isNaN(timestamp)) {
    return timestamp;
  }

  var dateMatch = dateText.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!dateMatch) {
    return 0;
  }

  var parsedTime = parseTimeText(timeText);
  var hour = parsedTime.hour;
  var minute = parsedTime.minute;

  return new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    hour,
    minute
  ).getTime();
}

function parseChineseNumber(text) {
  var raw = normalizeText(text).replace(/两/g, '二').replace(/〇/g, '零');
  if (!raw) {
    return 0;
  }

  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  var digitMap = {
    '零': 0,
    '一': 1,
    '二': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '七': 7,
    '八': 8,
    '九': 9
  };

  if (raw === '十') {
    return 10;
  }

  if (raw.indexOf('十') !== -1) {
    var parts = raw.split('十');
    var tens = parts[0] ? (digitMap[parts[0]] || 0) : 1;
    var ones = parts[1] ? (digitMap[parts[1]] || 0) : 0;
    return tens * 10 + ones;
  }

  return digitMap[raw] || 0;
}

function parseTimeText(time) {
  var text = normalizeText(time);
  if (!text) {
    return { hour: 0, minute: 0 };
  }

  var startText = text.split(/[到至\-~—]/)[0];
  var colonMatch = startText.match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/);
  if (colonMatch) {
    return {
      hour: Number(colonMatch[1]),
      minute: Number(colonMatch[2])
    };
  }

  var hour = 0;
  var minute = 0;
  var hourMatch = startText.match(/([零〇一二两三四五六七八九十\d]{1,3})\s*[点时]/);
  if (hourMatch) {
    hour = parseChineseNumber(hourMatch[1]);
  }

  if (/半/.test(startText)) {
    minute = 30;
  } else if (/三刻/.test(startText)) {
    minute = 45;
  } else if (/一刻/.test(startText)) {
    minute = 15;
  } else {
    var minuteMatch = startText.match(/[点时]\s*([零〇一二两三四五六七八九十\d]{1,3})\s*分?/);
    if (minuteMatch) {
      minute = parseChineseNumber(minuteMatch[1]);
    }
  }

  if (/(下午|晚上|傍晚)/.test(startText) && hour > 0 && hour < 12) {
    hour += 12;
  } else if (/中午/.test(startText) && hour > 0 && hour < 11) {
    hour += 12;
  } else if (/凌晨/.test(startText) && hour === 12) {
    hour = 0;
  }

  return {
    hour: hour,
    minute: minute
  };
}

function compareScheduleDesc(a, b) {
  var aTime = parseDateTimeValue(a.date, a.time);
  var bTime = parseDateTimeValue(b.date, b.time);

  if (aTime !== bTime) {
    return bTime - aTime;
  }

  var aUpdatedAt = Number(a.updatedAt || a.createdAt || 0);
  var bUpdatedAt = Number(b.updatedAt || b.createdAt || 0);
  return bUpdatedAt - aUpdatedAt;
}

function calcAttendanceStats(attendance, mode) {
  var stats = mode === 'flag'
    ? { normal: 0, late: 0, absent: 0, leave: 0 }
    : { arrived: 0, late: 0, absent: 0, leave: 0 };

  (attendance || []).forEach(function(item) {
    var status = normalizeText(item.status);
    if (mode === 'flag') {
      if (status === '正常') stats.normal += 1;
      else if (status === '迟到') stats.late += 1;
      else if (status === '缺席') stats.absent += 1;
      else if (status === '请假') stats.leave += 1;
      return;
    }

    if (status === '已到') stats.arrived += 1;
    else if (status === '迟到') stats.late += 1;
    else if (status === '缺勤') stats.absent += 1;
    else if (status === '请假') stats.leave += 1;
  });

  return stats;
}

function getToday() {
  var now = new Date();
  var year = now.getFullYear();
  var month = String(now.getMonth() + 1).padStart(2, '0');
  var day = String(now.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function buildTrainingMap(trainings) {
  var map = {};
  (trainings || []).forEach(function(training) {
    map[training.id] = training;
  });
  return map;
}

function getMakeupStatus(record, makeupTraining, today) {
  var currentDay = today || getToday();
  var makeupTrainingId = record && record.makeupTrainingId ? record.makeupTrainingId : '';
  var makeupDate = '';

  if (makeupTraining && makeupTraining.date) {
    makeupDate = makeupTraining.date;
  } else if (record && record.makeupTrainingDate) {
    makeupDate = record.makeupTrainingDate;
  }

  if (!makeupTrainingId) {
    return 'pending';
  }

  if (makeupDate && makeupDate > currentDay) {
    return 'scheduled';
  }

  return 'assigned';
}

function getMakeupStatusText(status) {
  if (status === 'pending') {
    return '待补训';
  }

  if (status === 'scheduled') {
    return '待参加';
  }

  return '已登记补训';
}

function findTrainingById(trainings, trainingId) {
  for (var i = 0; i < (trainings || []).length; i++) {
    if (trainings[i] && trainings[i].id === trainingId) {
      return trainings[i];
    }
  }
  return null;
}

function isEligibleMakeupTraining(training, options) {
  if (!training) {
    return false;
  }

  if (normalizeTrainingType(training.type, training.title) !== TRAINING_TYPE_MAKEUP) {
    return false;
  }

  var today = options && options.today ? options.today : '';
  var excludeTrainingId = options && options.excludeTrainingId ? options.excludeTrainingId : '';

  if (!training.date || training.date <= today) {
    return false;
  }

  if (excludeTrainingId && training.id === excludeTrainingId) {
    return false;
  }

  return true;
}

function buildAvailableMakeupTrainings(trainings, options) {
  return (trainings || [])
    .filter(function(training) {
      return isEligibleMakeupTraining(training, options);
    })
    .map(enrichTraining)
    .sort(function(a, b) {
      return parseDateTimeValue(a.date, a.time) - parseDateTimeValue(b.date, b.time);
    });
}

function stripMakeupFields(record) {
  var cleaned = Object.assign({}, record);
  delete cleaned.makeupTrainingId;
  delete cleaned.makeupTrainingTitle;
  delete cleaned.makeupTrainingDate;
  delete cleaned.makeupTrainingTime;
  delete cleaned.makeupTrainingLocation;
  delete cleaned.makeupAssignedAt;
  return cleaned;
}

function assignMakeupTrainingToRecord(record, training) {
  return Object.assign({}, record, {
    makeupTrainingId: training.id,
    makeupTrainingTitle: training.title || '',
    makeupTrainingDate: training.date || '',
    makeupTrainingTime: training.time || '',
    makeupTrainingLocation: training.location || '',
    makeupAssignedAt: Date.now()
  });
}

function ensureMakeupAttendanceMember(attendance, member, status, overwriteStatus) {
  var list = (attendance || []).slice();
  var index = -1;

  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].memberId === member.id) {
      index = i;
      break;
    }
  }

  if (index === -1) {
    list.push({
      memberId: member.id,
      name: member.name || '',
      status: status || ATTENDANCE_STATUS_UNRECORDED
    });
    return {
      attendance: list,
      changed: true
    };
  }

  var current = list[index] || {};
  var nextRecord = current;
  var changed = false;

  if ((current.name || '') !== (member.name || '')) {
    nextRecord = Object.assign({}, nextRecord, {
      name: member.name || ''
    });
    changed = true;
  }

  if (overwriteStatus && current.status !== status) {
    nextRecord = Object.assign({}, nextRecord, {
      status: status
    });
    changed = true;
  }

  if (!changed) {
    return {
      attendance: list,
      changed: false
    };
  }

  list[index] = nextRecord;
  return {
    attendance: list,
    changed: true
  };
}

function removeMakeupAttendanceMember(attendance, memberId) {
  var changed = false;
  var list = (attendance || []).filter(function(item) {
    var shouldKeep = item && item.memberId !== memberId;
    if (!shouldKeep) {
      changed = true;
    }
    return shouldKeep;
  });

  return {
    attendance: list,
    changed: changed
  };
}

function countLinkedMakeupRecords(trainings, memberId, makeupTrainingId, options) {
  if (!memberId || !makeupTrainingId) {
    return 0;
  }

  var excludeLeaveTrainingId = options && options.excludeLeaveTrainingId ? options.excludeLeaveTrainingId : '';
  var excludeAttendanceIndex = options && typeof options.excludeAttendanceIndex === 'number'
    ? options.excludeAttendanceIndex
    : -1;
  var count = 0;

  (trainings || []).forEach(function(training) {
    (training.attendance || []).forEach(function(record, index) {
      if (!record || record.memberId !== memberId) {
        return;
      }

      if (record.status !== ATTENDANCE_STATUS_LEAVE) {
        return;
      }

      if (record.makeupTrainingId !== makeupTrainingId) {
        return;
      }

      if (training.id === excludeLeaveTrainingId && index === excludeAttendanceIndex) {
        return;
      }

      count += 1;
    });
  });

  return count;
}

async function updateTrainingAttendance(training, attendance) {
  await db.collection('trainings').doc(training._id).update({
    data: {
      attendance: attendance,
      updatedAt: Date.now()
    }
  });
}

function compareDesc(a, b) {
  if (a === b) {
    return 0;
  }
  return a > b ? -1 : 1;
}

function buildMemberMakeupItems(trainings, memberId, today) {
  var items = [];
  var trainingMap = buildTrainingMap(trainings);

  (trainings || []).forEach(function(training) {
    (training.attendance || []).forEach(function(record, index) {
      if (!record || record.memberId !== memberId || record.status !== ATTENDANCE_STATUS_LEAVE) {
        return;
      }

      var makeupTraining = record.makeupTrainingId ? trainingMap[record.makeupTrainingId] : null;
      var status = getMakeupStatus(record, makeupTraining, today);

      items.push({
        id: training.id + '_' + index,
        leaveTrainingId: training.id,
        leaveTrainingTitle: training.title || '',
        leaveTrainingType: normalizeTrainingType(training.type, training.title),
        leaveTrainingDate: training.date || '',
        leaveTrainingTime: training.time || '',
        leaveTrainingLocation: training.location || '',
        attendanceIndex: index,
        makeupTrainingId: record.makeupTrainingId || '',
        makeupTrainingTitle: makeupTraining ? (makeupTraining.title || '') : (record.makeupTrainingTitle || ''),
        makeupTrainingDate: makeupTraining ? (makeupTraining.date || '') : (record.makeupTrainingDate || ''),
        makeupTrainingTime: makeupTraining ? (makeupTraining.time || '') : (record.makeupTrainingTime || ''),
        makeupTrainingLocation: makeupTraining ? (makeupTraining.location || '') : (record.makeupTrainingLocation || ''),
        isPending: status === 'pending',
        isScheduled: status === 'scheduled',
        statusType: status,
        statusText: getMakeupStatusText(status)
      });
    });
  });

  return items.sort(function(a, b) {
    if (a.isPending !== b.isPending) {
      return a.isPending ? -1 : 1;
    }

    var dateCompare = compareDesc(a.leaveTrainingDate || '', b.leaveTrainingDate || '');
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return compareDesc(a.leaveTrainingTime || '', b.leaveTrainingTime || '');
  });
}

function isActiveMemberStatus(status) {
  var text = normalizeText(status);
  return !text || text === '鍦ㄩ槦' || text === '\u5728\u961f';
}

function compareMemberMakeupSummary(a, b) {
  if (a.makeupPendingCount !== b.makeupPendingCount) {
    return b.makeupPendingCount - a.makeupPendingCount;
  }

  if (a.makeupUpcomingCount !== b.makeupUpcomingCount) {
    return b.makeupUpcomingCount - a.makeupUpcomingCount;
  }

  if (a.makeupTotalCount !== b.makeupTotalCount) {
    return b.makeupTotalCount - a.makeupTotalCount;
  }

  var gradeDiff = parseGradeValue(a.grade) - parseGradeValue(b.grade);
  if (gradeDiff !== 0) {
    return gradeDiff;
  }

  var joinDateDiff = normalizeText(a.joinDate).localeCompare(normalizeText(b.joinDate));
  if (joinDateDiff !== 0) {
    return joinDateDiff;
  }

  var studentIdDiff = normalizeText(a.studentId).localeCompare(normalizeText(b.studentId));
  if (studentIdDiff !== 0) {
    return studentIdDiff;
  }

  return normalizeText(a.name).localeCompare(normalizeText(b.name));
}

function buildActiveMemberMakeupSummaries(members, trainings, options) {
  var settings = Object.assign({
    today: getToday(),
    pendingOnly: false
  }, options || {});

  return (members || [])
    .map(enrichMember)
    .filter(function(member) {
      return !!member && isActiveMemberStatus(member.status);
    })
    .map(function(member) {
      var items = buildMemberMakeupItems(trainings, member.id, settings.today);
      var pendingCount = 0;
      var upcomingCount = 0;

      items.forEach(function(item) {
        if (item.isPending) {
          pendingCount += 1;
        } else if (item.isScheduled) {
          upcomingCount += 1;
        }
      });

      return Object.assign({}, member, {
        makeupPendingCount: pendingCount,
        makeupUpcomingCount: upcomingCount,
        makeupCompletedCount: items.length - pendingCount - upcomingCount,
        makeupTotalCount: items.length
      });
    })
    .filter(function(member) {
      return !settings.pendingOnly || member.makeupPendingCount > 0;
    })
    .sort(compareMemberMakeupSummary);
}

function applyKeywordFilter(list, keyword) {
  var text = normalizeText(keyword).toLowerCase();
  if (!text) {
    return list.slice();
  }

  return list.filter(function(item) {
    var name = normalizeText(item.name).toLowerCase();
    var studentId = normalizeText(item.studentId).toLowerCase();
    return name.indexOf(text) !== -1 || studentId.indexOf(text) !== -1;
  });
}

function pickPage(list, page, pageSize) {
  var safePage = normalizePage(page);
  var safePageSize = clampPageSize(pageSize);
  var start = (safePage - 1) * safePageSize;
  var end = start + safePageSize;
  var sliced = list.slice(start, end);

  return {
    list: sliced,
    page: safePage,
    pageSize: safePageSize,
    total: list.length,
    hasMore: end < list.length
  };
}

function buildPageResult(list, page, pageSize) {
  return Object.assign({ success: true }, pickPage(list, page, pageSize));
}

async function fetchAll(collection, query) {
  var result = [];
  var offset = 0;
  var hasQuery = query && Object.keys(query).length > 0;

  while (true) {
    var ref = hasQuery ? collection.where(query) : collection;
    var res = await ref.skip(offset).limit(FETCH_LIMIT).get();
    var data = res.data || [];
    result = result.concat(data);

    if (data.length < FETCH_LIMIT) {
      break;
    }

    offset += data.length;
  }

  return result;
}

async function queryMembers(event) {
  var status = normalizeText(event.status);
  var keyword = normalizeText(event.keyword);
  var page = normalizePage(event.page);
  var pageSize = clampPageSize(event.pageSize);

  var query = {};
  if (status) {
    query.status = status;
  }

  var list = (await fetchAll(db.collection('members'), query))
    .map(enrichMember);

  list = applyKeywordFilter(list, keyword);
  list.sort(function(a, b) {
    return compareMembers(a, b, !status);
  });

  return buildPageResult(list, page, pageSize);
}

function isTrainingRelatedToMember(training, memberId) {
  if (!memberId) {
    return false;
  }

  return (training.attendance || []).some(function(record) {
    return record && record.memberId === memberId;
  });
}

async function queryTrainings(event) {
  var type = normalizeText(event.type);
  var memberId = normalizeText(event.memberId);
  var isMineMode = !!event.isMineMode;
  var page = normalizePage(event.page);
  var pageSize = clampPageSize(event.pageSize);

  var query = {};
  if (type) {
    query.type = type;
  }

  var list = (await fetchAll(db.collection('trainings'), query))
    .map(enrichTraining);

  if (type) {
    list = list.filter(function(item) {
      return item.type === type;
    });
  }

  if (isMineMode) {
    list = memberId ? list.filter(function(item) {
      return isTrainingRelatedToMember(item, memberId);
    }) : [];
  }

  list.sort(compareScheduleDesc);
  return buildPageResult(list, page, pageSize);
}

function isFlagRelatedToMember(flag, memberId) {
  if (!memberId) {
    return false;
  }

  var attendance = flag.attendance || [];
  var queueMemberIds = Array.isArray(flag.queueMemberIds) ? flag.queueMemberIds : [];
  var audienceMemberIds = Array.isArray(flag.audienceMemberIds) ? flag.audienceMemberIds : [];

  return attendance.some(function(record) {
    return record && record.memberId === memberId;
  }) || queueMemberIds.indexOf(memberId) !== -1 || audienceMemberIds.indexOf(memberId) !== -1;
}

async function queryFlags(event) {
  var type = normalizeText(event.type);
  var memberId = normalizeText(event.memberId);
  var isMineMode = !!event.isMineMode;
  var page = normalizePage(event.page);
  var pageSize = clampPageSize(event.pageSize);

  var query = {};
  if (type) {
    query.type = type;
  }

  var list = (await fetchAll(db.collection('flag_ceremonies'), query))
    .map(enrichFlag);

  if (isMineMode) {
    list = memberId ? list.filter(function(item) {
      return isFlagRelatedToMember(item, memberId);
    }) : [];
  }

  list.sort(compareScheduleDesc);
  return buildPageResult(list, page, pageSize);
}

function enrichChronicle(chronicle) {
  return Object.assign({}, chronicle, {
    _docId: chronicle._id || chronicle._docId || '',
    gradeYear: normalizeText(chronicle.gradeYear),
    personName: normalizeText(chronicle.personName) || '未命名人物',
    content: normalizeText(chronicle.content),
    coverFileId: normalizeText(chronicle.coverFileId || ''),
    coverImage: chronicle.coverImage || null,
    images: Array.isArray(chronicle.images) ? chronicle.images : []
  });
}

function compareChronicles(a, b) {
  var aOrder = Number(a.sortOrder || 0);
  var bOrder = Number(b.sortOrder || 0);
  if (aOrder !== bOrder) {
    return aOrder - bOrder;
  }

  var aTime = Number(a.createdAt || a.updatedAt || 0);
  var bTime = Number(b.createdAt || b.updatedAt || 0);
  if (aTime !== bTime) {
    return aTime - bTime;
  }

  return normalizeText(a.id || a._docId).localeCompare(normalizeText(b.id || b._docId));
}

async function queryChroniclesByGrade(event) {
  var gradeYear = normalizeText(event.gradeYear);
  var page = normalizePage(event.page);
  var pageSize = clampPageSize(event.pageSize);

  var list = (await fetchAll(db.collection('chronicles'), gradeYear ? {
    gradeYear: gradeYear
  } : {})).map(enrichChronicle);

  list.sort(compareChronicles);
  return buildPageResult(list, page, pageSize);
}

async function queryChronicleGradeSummary() {
  var list = (await fetchAll(db.collection('chronicles'))).map(enrichChronicle);
  var countMap = {};

  list.forEach(function(item) {
    var gradeYear = normalizeText(item.gradeYear);
    if (!gradeYear) {
      return;
    }

    countMap[gradeYear] = (countMap[gradeYear] || 0) + 1;
  });

  return {
    success: true,
    countMap: countMap
  };
}

function enrichMeetingRecord(record) {
  return Object.assign({}, record, {
    _docId: record._id || record._docId || '',
    departmentKey: normalizeText(record.departmentKey),
    name: normalizeText(record.name),
    fileName: normalizeText(record.fileName),
    fileID: normalizeText(record.fileID),
    uploadedBy: normalizeText(record.uploadedBy)
  });
}

async function queryMeetingRecords(event) {
  var departmentKey = normalizeText(event.departmentKey);
  var page = normalizePage(event.page);
  var pageSize = clampPageSize(event.pageSize);

  var list = (await fetchAll(db.collection('meeting_records'), departmentKey ? {
    departmentKey: departmentKey
  } : {})).map(enrichMeetingRecord);

  list.sort(function(a, b) {
    var aTime = Number(a.updatedAt || a.createdAt || 0);
    var bTime = Number(b.updatedAt || b.createdAt || 0);
    return bTime - aTime;
  });

  return buildPageResult(list, page, pageSize);
}

function getExtension(fileName) {
  var matched = normalizeText(fileName).match(/\.([^.]+)$/);
  return matched ? String(matched[1]).toLowerCase() : '';
}

function getFileTypeLabel(fileName) {
  var extension = getExtension(fileName);

  if (extension === 'pdf') {
    return 'PDF';
  }

  if (extension === 'doc' || extension === 'docx') {
    return 'Word';
  }

  if (extension === 'xls' || extension === 'xlsx') {
    return 'Excel';
  }

  if (extension === 'ppt' || extension === 'pptx') {
    return 'PPT';
  }

  return extension ? extension.toUpperCase() : '文件';
}

function enrichOfficeMaterial(record) {
  var fileName = normalizeText(record.fileName || record.name);
  return Object.assign({}, record, {
    _docId: record._id || record._docId || '',
    name: fileName,
    fileName: fileName,
    fileID: normalizeText(record.fileID),
    uploadedBy: normalizeText(record.uploadedBy),
    fileExt: getExtension(fileName),
    fileTypeLabel: getFileTypeLabel(fileName)
  });
}

async function queryOfficeMaterials(event) {
  var page = normalizePage(event.page);
  var pageSize = clampPageSize(event.pageSize);

  var list = (await fetchAll(db.collection('office_materials'))).map(enrichOfficeMaterial);
  list.sort(function(a, b) {
    var aTime = Number(a.updatedAt || a.createdAt || 0);
    var bTime = Number(b.updatedAt || b.createdAt || 0);
    return bTime - aTime;
  });

  return buildPageResult(list, page, pageSize);
}

async function queryMemberMakeupSummary(event) {
  var memberId = normalizeText(event.memberId);
  if (!memberId) {
    return {
      success: true,
      pendingCount: 0,
      upcomingCount: 0,
      totalCount: 0
    };
  }

  var today = getToday();
  var trainings = await fetchAll(db.collection('trainings'));
  var trainingMap = buildTrainingMap(trainings);
  var pendingCount = 0;
  var upcomingCount = 0;
  var totalCount = 0;

  trainings.forEach(function(training) {
    (training.attendance || []).forEach(function(record) {
      if (!record || record.memberId !== memberId || record.status !== ATTENDANCE_STATUS_LEAVE) {
        return;
      }

      totalCount += 1;

      var makeupTraining = record.makeupTrainingId ? trainingMap[record.makeupTrainingId] : null;
      var status = getMakeupStatus(record, makeupTraining, today);
      if (status === 'pending') {
        pendingCount += 1;
      } else if (status === 'scheduled') {
        upcomingCount += 1;
      }
    });
  });

  return {
    success: true,
    pendingCount: pendingCount,
    upcomingCount: upcomingCount,
    totalCount: totalCount
  };
}

async function queryMemberMakeupRecords(event) {
  var memberId = normalizeText(event.memberId);
  var pendingOnly = !!event.pendingOnly;
  if (!memberId) {
    return {
      success: true,
      items: [],
      summary: {
        totalCount: 0,
        pendingCount: 0,
        upcomingCount: 0,
        completedCount: 0
      }
    };
  }

  var today = getToday();
  var trainings = await fetchAll(db.collection('trainings'));
  var items = buildMemberMakeupItems(trainings, memberId, today);
  if (pendingOnly) {
    items = items.filter(function(item) {
      return item.isPending;
    });
  }
  var pendingCount = 0;
  var upcomingCount = 0;

  items.forEach(function(item) {
    if (item.isPending) {
      pendingCount += 1;
    } else if (item.isScheduled) {
      upcomingCount += 1;
    }
  });

  var totalCount = items.length;

  return {
    success: true,
    items: items,
    summary: {
      totalCount: totalCount,
      pendingCount: pendingCount,
      upcomingCount: upcomingCount,
      completedCount: totalCount - pendingCount - upcomingCount
    }
  };
}

async function queryActiveMemberMakeupSummaries(event) {
  var pendingOnly = !!event.pendingOnly;
  var today = getToday();
  var members = await fetchAll(db.collection('members'));
  var trainings = await fetchAll(db.collection('trainings'));

  return {
    success: true,
    summaries: buildActiveMemberMakeupSummaries(members, trainings, {
      today: today,
      pendingOnly: pendingOnly
    }),
    today: today
  };
}

async function queryMakeupSelectionData(event) {
  var memberId = normalizeText(event.memberId);
  var leaveTrainingId = normalizeText(event.leaveTrainingId);
  var attendanceIndex = Number(event.attendanceIndex);
  var today = getToday();

  if (!memberId || !leaveTrainingId || Number.isNaN(attendanceIndex) || attendanceIndex < 0) {
    return {
      success: true,
      leaveItem: null,
      availableTrainings: [],
      currentSelectionId: '',
      today: today
    };
  }

  var trainings = await fetchAll(db.collection('trainings'));
  var leaveItem = null;
  var items = buildMemberMakeupItems(trainings, memberId, today);

  for (var i = 0; i < items.length; i++) {
    if (items[i].leaveTrainingId === leaveTrainingId && items[i].attendanceIndex === attendanceIndex) {
      leaveItem = items[i];
      break;
    }
  }

  return {
    success: true,
    leaveItem: leaveItem,
    availableTrainings: leaveItem ? buildAvailableMakeupTrainings(trainings, {
      today: today,
      excludeTrainingId: leaveTrainingId
    }) : [],
    currentSelectionId: leaveItem && leaveItem.makeupTrainingId ? leaveItem.makeupTrainingId : '',
    today: today
  };
}

async function assignMakeupTrainingForMember(event) {
  var memberId = normalizeText(event.memberId);
  var memberName = normalizeText(event.memberName);
  var leaveTrainingId = normalizeText(event.leaveTrainingId);
  var selectedTrainingId = normalizeText(event.selectedTrainingId);
  var attendanceIndex = Number(event.attendanceIndex);
  var requireFuture = !!event.requireFuture;
  var markArrived = !!event.markArrived;
  var today = getToday();

  if (!memberId || !leaveTrainingId || !selectedTrainingId || Number.isNaN(attendanceIndex) || attendanceIndex < 0) {
    throw new Error('\u53c2\u6570\u4e0d\u5b8c\u6574');
  }

  var trainings = await fetchAll(db.collection('trainings'));
  var leaveTraining = findTrainingById(trainings, leaveTrainingId);
  var selectedTraining = findTrainingById(trainings, selectedTrainingId);

  if (!leaveTraining) {
    throw new Error('\u539f\u8bf7\u5047\u8bb0\u5f55\u4e0d\u5b58\u5728');
  }

  if (!selectedTraining) {
    throw new Error('\u8865\u8bad\u65e5\u7a0b\u4e0d\u5b58\u5728');
  }

  if (requireFuture && !isEligibleMakeupTraining(selectedTraining, { today: today })) {
    throw new Error('\u53ea\u80fd\u9009\u62e9\u4eca\u5929\u4e4b\u540e\u7684\u8865\u8bad\u65e5\u7a0b');
  }

  var leaveAttendance = (leaveTraining.attendance || []).slice();
  var currentRecord = leaveAttendance[attendanceIndex];
  if (!currentRecord || currentRecord.memberId !== memberId || currentRecord.status !== ATTENDANCE_STATUS_LEAVE) {
    throw new Error('\u8bf7\u5047\u8bb0\u5f55\u5df2\u53d8\u5316\uff0c\u8bf7\u8fd4\u56de\u5237\u65b0\u540e\u91cd\u8bd5');
  }

  var previousMakeupTrainingId = normalizeText(currentRecord.makeupTrainingId);
  leaveAttendance[attendanceIndex] = assignMakeupTrainingToRecord(currentRecord, selectedTraining);
  await updateTrainingAttendance(leaveTraining, leaveAttendance);

  if (previousMakeupTrainingId && previousMakeupTrainingId !== selectedTraining.id && countLinkedMakeupRecords(trainings, memberId, previousMakeupTrainingId, {
    excludeLeaveTrainingId: leaveTraining.id,
    excludeAttendanceIndex: attendanceIndex
  }) === 0) {
    var previousMakeupTraining = findTrainingById(trainings, previousMakeupTrainingId);
    if (previousMakeupTraining) {
      var removed = removeMakeupAttendanceMember(previousMakeupTraining.attendance, memberId);
      if (removed.changed) {
        await updateTrainingAttendance(previousMakeupTraining, removed.attendance);
      }
    }
  }

  var ensured = ensureMakeupAttendanceMember(
    selectedTraining.id === leaveTraining.id ? leaveAttendance : selectedTraining.attendance,
    {
      id: memberId,
      name: normalizeText(currentRecord.name) || memberName
    },
    markArrived ? ATTENDANCE_STATUS_ARRIVED : ATTENDANCE_STATUS_UNRECORDED,
    markArrived
  );
  if (ensured.changed) {
    await updateTrainingAttendance(selectedTraining, ensured.attendance);
  }

  return {
    success: true,
    currentSelectionId: selectedTraining.id
  };
}

async function clearMakeupTrainingForMember(event) {
  var memberId = normalizeText(event.memberId);
  var leaveTrainingId = normalizeText(event.leaveTrainingId);
  var attendanceIndex = Number(event.attendanceIndex);

  if (!memberId || !leaveTrainingId || Number.isNaN(attendanceIndex) || attendanceIndex < 0) {
    throw new Error('\u53c2\u6570\u4e0d\u5b8c\u6574');
  }

  var trainings = await fetchAll(db.collection('trainings'));
  var leaveTraining = findTrainingById(trainings, leaveTrainingId);
  if (!leaveTraining) {
    throw new Error('\u539f\u8bf7\u5047\u8bb0\u5f55\u4e0d\u5b58\u5728');
  }

  var leaveAttendance = (leaveTraining.attendance || []).slice();
  var currentRecord = leaveAttendance[attendanceIndex];
  if (!currentRecord || currentRecord.memberId !== memberId || currentRecord.status !== ATTENDANCE_STATUS_LEAVE) {
    throw new Error('\u8bf7\u5047\u8bb0\u5f55\u5df2\u53d8\u5316\uff0c\u8bf7\u8fd4\u56de\u5237\u65b0\u540e\u91cd\u8bd5');
  }

  var previousMakeupTrainingId = normalizeText(currentRecord.makeupTrainingId);
  leaveAttendance[attendanceIndex] = stripMakeupFields(currentRecord);
  await updateTrainingAttendance(leaveTraining, leaveAttendance);

  if (previousMakeupTrainingId && countLinkedMakeupRecords(trainings, memberId, previousMakeupTrainingId, {
    excludeLeaveTrainingId: leaveTraining.id,
    excludeAttendanceIndex: attendanceIndex
  }) === 0) {
    var previousMakeupTraining = findTrainingById(trainings, previousMakeupTrainingId);
    if (previousMakeupTraining) {
      var removed = removeMakeupAttendanceMember(previousMakeupTraining.attendance, memberId);
      if (removed.changed) {
        await updateTrainingAttendance(previousMakeupTraining, removed.attendance);
      }
    }
  }

  return {
    success: true
  };
}

async function removeTraining(event) {
  var id = normalizeText(event.id);
  var docId = normalizeText(event.docId);
  var collection = db.collection('trainings');
  var target = null;

  if (docId) {
    try {
      var docRes = await collection.doc(docId).get();
      if (docRes && docRes.data) {
        target = docRes.data;
      }
    } catch (err) {
      console.warn('removeTraining doc lookup failed, fallback to id lookup', err);
    }
  }

  if (!target && id) {
    var queryRes = await collection.where({ id: id }).limit(1).get();
    if (queryRes.data && queryRes.data.length) {
      target = queryRes.data[0];
    }
  }

  if (!target) {
    return {
      success: true
    };
  }

  var trainingId = normalizeText(target.id);
  var trainings = await fetchAll(collection);

  for (var i = 0; i < trainings.length; i++) {
    var training = trainings[i];
    if (!training || training._id === target._id) {
      continue;
    }

    var attendance = training.attendance || [];
    var nextAttendance = null;

    for (var j = 0; j < attendance.length; j++) {
      var record = attendance[j] || {};
      if (record.makeupTrainingId !== trainingId) {
        continue;
      }

      if (!nextAttendance) {
        nextAttendance = attendance.slice();
      }
      nextAttendance[j] = stripMakeupFields(record);
    }

    if (nextAttendance) {
      await updateTrainingAttendance(training, nextAttendance);
    }
  }

  await collection.doc(target._id).remove();

  return {
    success: true
  };
}

exports.main = async function(event) {
  try {
    var action = normalizeText(event.action);

    if (action === 'members') {
      return await queryMembers(event);
    }

    if (action === 'trainings') {
      return await queryTrainings(event);
    }

    if (action === 'flags') {
      return await queryFlags(event);
    }

    if (action === 'chroniclesByGrade') {
      return await queryChroniclesByGrade(event);
    }

    if (action === 'chronicleGradeSummary') {
      return await queryChronicleGradeSummary(event);
    }

    if (action === 'meetingRecords') {
      return await queryMeetingRecords(event);
    }

    if (action === 'officeMaterials') {
      return await queryOfficeMaterials(event);
    }

    if (action === 'memberMakeupSummary') {
      return await queryMemberMakeupSummary(event);
    }

    if (action === 'memberMakeupRecords') {
      return await queryMemberMakeupRecords(event);
    }

    if (action === 'activeMemberMakeupSummaries') {
      return await queryActiveMemberMakeupSummaries(event);
    }

    if (action === 'makeupSelectionData') {
      return await queryMakeupSelectionData(event);
    }

    if (action === 'assignMakeupTraining') {
      return await assignMakeupTrainingForMember(event);
    }

    if (action === 'clearMakeupTraining') {
      return await clearMakeupTrainingForMember(event);
    }

    if (action === 'removeTraining') {
      return await removeTraining(event);
    }

    throw new Error('Unsupported list query action');
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: err.message || 'List query failed'
    };
  }
};
