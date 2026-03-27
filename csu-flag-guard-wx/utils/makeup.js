var TRAINING_TYPE_MAKEUP = '\u8865\u8bad';
var ATTENDANCE_STATUS_LEAVE = '\u8bf7\u5047';
var ATTENDANCE_STATUS_UNRECORDED = '\u672a\u8bb0\u5f55';

function compareAsc(a, b) {
  if (a === b) {
    return 0;
  }
  return a > b ? 1 : -1;
}

function compareDesc(a, b) {
  if (a === b) {
    return 0;
  }
  return a > b ? -1 : 1;
}

function parseChineseNumber(text) {
  var raw = String(text || '').trim().replace(/两/g, '二').replace(/〇/g, '零');
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
  var text = String(time || '').trim();
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

function parseDateTimeValue(date, time) {
  var dateText = String(date || '').trim();
  if (!dateText) {
    return 0;
  }

  var normalized = (dateText + ' ' + String(time || '').trim()).replace(/\./g, '-').replace('T', ' ');
  var directTimestamp = new Date(normalized).getTime();
  if (!isNaN(directTimestamp)) {
    return directTimestamp;
  }

  var dateMatch = dateText.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!dateMatch) {
    return 0;
  }

  var parsedTime = parseTimeText(time);
  return new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    parsedTime.hour,
    parsedTime.minute
  ).getTime();
}

function normalizeGradeValue(grade) {
  if (grade === undefined || grade === null || grade === '') {
    return Number.MAX_SAFE_INTEGER;
  }

  var value = Number(grade);
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

function buildTrainingMap(trainings) {
  var map = {};
  (trainings || []).forEach(function(training) {
    map[training.id] = training;
  });
  return map;
}

function findTrainingById(trainings, trainingId) {
  for (var i = 0; i < (trainings || []).length; i++) {
    if (trainings[i].id === trainingId) {
      return trainings[i];
    }
  }
  return null;
}

function getToday() {
  var now = new Date();
  var year = now.getFullYear();
  var month = (now.getMonth() + 1).toString().padStart(2, '0');
  var day = now.getDate().toString().padStart(2, '0');
  return year + '-' + month + '-' + day;
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
    return {
      type: 'pending',
      text: '\u5f85\u8865\u8bad'
    };
  }

  if (makeupDate && makeupDate > currentDay) {
    return {
      type: 'scheduled',
      text: '\u5f85\u53c2\u52a0'
    };
  }

  return {
    type: 'assigned',
    text: '\u5df2\u767b\u8bb0\u8865\u8bad'
  };
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

function assignMakeupTraining(record, training) {
  return Object.assign({}, record, {
    makeupTrainingId: training.id,
    makeupTrainingTitle: training.title,
    makeupTrainingDate: training.date,
    makeupTrainingTime: training.time || '',
    makeupTrainingLocation: training.location || '',
    makeupAssignedAt: Date.now()
  });
}

function ensureMakeupAttendanceMemberByOptions(attendance, member, options) {
  var list = (attendance || []).slice();
  var index = -1;
  var settings = Object.assign({
    status: ATTENDANCE_STATUS_UNRECORDED,
    overwriteStatus: false
  }, options || {});

  for (var i = 0; i < list.length; i++) {
    if (list[i].memberId === member.id) {
      index = i;
      break;
    }
  }

  if (index === -1) {
    list.push({
      memberId: member.id,
      name: member.name,
      status: settings.status
    });
    return {
      attendance: list,
      changed: true
    };
  }

  var current = list[index] || {};
  var nextRecord = current;
  var changed = false;

  if (current.name !== member.name) {
    nextRecord = Object.assign({}, nextRecord, {
      name: member.name
    });
    changed = true;
  }

  if (settings.overwriteStatus && current.status !== settings.status) {
    nextRecord = Object.assign({}, nextRecord, {
      status: settings.status
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

function ensureMakeupAttendanceMember(attendance, member) {
  return ensureMakeupAttendanceMemberByOptions(attendance, member, {
    status: ATTENDANCE_STATUS_UNRECORDED,
    overwriteStatus: false
  });
}

function ensureMakeupAttendanceMemberStatus(attendance, member, status) {
  return ensureMakeupAttendanceMemberByOptions(attendance, member, {
    status: status || ATTENDANCE_STATUS_UNRECORDED,
    overwriteStatus: true
  });
}

function removeMakeupAttendanceMember(attendance, memberId) {
  var changed = false;
  var list = (attendance || []).filter(function(item) {
    var shouldKeep = item.memberId !== memberId;
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
      if (record.memberId !== memberId) {
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

function hasLinkedMakeupRecord(trainings, memberId, makeupTrainingId, options) {
  return countLinkedMakeupRecords(trainings, memberId, makeupTrainingId, options) > 0;
}

function buildLeaveMakeupItems(trainings, memberId, options) {
  var items = [];
  var trainingMap = buildTrainingMap(trainings);
  var today = options && options.today ? options.today : getToday();

  (trainings || []).forEach(function(training) {
    (training.attendance || []).forEach(function(record, index) {
      if (record.memberId !== memberId || record.status !== ATTENDANCE_STATUS_LEAVE) {
        return;
      }

      var makeupTraining = record.makeupTrainingId ? trainingMap[record.makeupTrainingId] : null;
      var status = getMakeupStatus(record, makeupTraining, today);

      items.push({
        id: training.id + '_' + index,
        leaveTrainingId: training.id,
        leaveTrainingTitle: training.title,
        leaveTrainingType: training.type,
        leaveTrainingDate: training.date,
        leaveTrainingTime: training.time || '',
        leaveTrainingLocation: training.location || '',
        attendanceIndex: index,
        makeupTrainingId: record.makeupTrainingId || '',
        makeupTrainingTitle: makeupTraining ? makeupTraining.title : (record.makeupTrainingTitle || ''),
        makeupTrainingDate: makeupTraining ? makeupTraining.date : (record.makeupTrainingDate || ''),
        makeupTrainingTime: makeupTraining ? (makeupTraining.time || '') : (record.makeupTrainingTime || ''),
        makeupTrainingLocation: makeupTraining ? (makeupTraining.location || '') : (record.makeupTrainingLocation || ''),
        isPending: status.type === 'pending',
        isScheduled: status.type === 'scheduled',
        statusType: status.type,
        statusText: status.text
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

function getPendingMakeupCount(items) {
  return (items || []).filter(function(item) {
    return item.isPending;
  }).length;
}

function getUpcomingMakeupCount(items) {
  return (items || []).filter(function(item) {
    return item.isScheduled;
  }).length;
}

function isEligibleMakeupTraining(training, options) {
  if (!training || training.type !== TRAINING_TYPE_MAKEUP) {
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

function getAvailableMakeupTrainings(trainings, options) {
  return (trainings || []).filter(function(training) {
    return isEligibleMakeupTraining(training, options);
  }).sort(function(a, b) {
    return parseDateTimeValue(a.date, a.time) - parseDateTimeValue(b.date, b.time);
  });
}

function buildMemberMakeupSummaries(members, trainings, options) {
  var today = options && options.today ? options.today : getToday();

  return (members || []).map(function(member) {
    var items = buildLeaveMakeupItems(trainings, member.id, { today: today });
    var pendingCount = getPendingMakeupCount(items);
    var upcomingCount = getUpcomingMakeupCount(items);
    var totalCount = items.length;

    return Object.assign({}, member, {
      makeupItems: items,
      makeupPendingCount: pendingCount,
      makeupUpcomingCount: upcomingCount,
      makeupCompletedCount: totalCount - pendingCount - upcomingCount,
      makeupTotalCount: totalCount
    });
  }).sort(function(a, b) {
    var pendingCompare = b.makeupPendingCount - a.makeupPendingCount;
    if (pendingCompare !== 0) {
      return pendingCompare;
    }

    var upcomingCompare = b.makeupUpcomingCount - a.makeupUpcomingCount;
    if (upcomingCompare !== 0) {
      return upcomingCompare;
    }

    if (a.makeupTotalCount !== b.makeupTotalCount) {
      return b.makeupTotalCount - a.makeupTotalCount;
    }

    var gradeCompare = normalizeGradeValue(a.grade) - normalizeGradeValue(b.grade);
    if (gradeCompare !== 0) {
      return gradeCompare;
    }

    var joinDateCompare = compareAsc(a.joinDate || '', b.joinDate || '');
    if (joinDateCompare !== 0) {
      return joinDateCompare;
    }

    var studentIdCompare = compareAsc(a.studentId || '', b.studentId || '');
    if (studentIdCompare !== 0) {
      return studentIdCompare;
    }

    return compareAsc(a.name || '', b.name || '');
  });
}

module.exports = {
  assignMakeupTraining: assignMakeupTraining,
  buildLeaveMakeupItems: buildLeaveMakeupItems,
  buildMemberMakeupSummaries: buildMemberMakeupSummaries,
  countLinkedMakeupRecords: countLinkedMakeupRecords,
  ensureMakeupAttendanceMember: ensureMakeupAttendanceMember,
  ensureMakeupAttendanceMemberStatus: ensureMakeupAttendanceMemberStatus,
  findTrainingById: findTrainingById,
  getAvailableMakeupTrainings: getAvailableMakeupTrainings,
  getMakeupStatus: getMakeupStatus,
  getPendingMakeupCount: getPendingMakeupCount,
  getToday: getToday,
  getUpcomingMakeupCount: getUpcomingMakeupCount,
  hasLinkedMakeupRecord: hasLinkedMakeupRecord,
  isEligibleMakeupTraining: isEligibleMakeupTraining,
  removeMakeupAttendanceMember: removeMakeupAttendanceMember,
  stripMakeupFields: stripMakeupFields
};
