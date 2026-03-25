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
      text: '待补训'
    };
  }

  if (makeupDate && makeupDate > currentDay) {
    return {
      type: 'scheduled',
      text: '待参加'
    };
  }

  return {
    type: 'assigned',
    text: '已登记补训'
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

function buildLeaveMakeupItems(trainings, memberId, options) {
  var items = [];
  var trainingMap = buildTrainingMap(trainings);
  var today = options && options.today ? options.today : getToday();

  (trainings || []).forEach(function(training) {
    (training.attendance || []).forEach(function(record, index) {
      if (record.memberId !== memberId || record.status !== '请假') {
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
  if (!training || training.type !== '补训') {
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
    var dateCompare = compareAsc(a.date || '', b.date || '');
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return compareAsc(a.time || '', b.time || '');
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

    var pendingCompare = b.makeupPendingCount - a.makeupPendingCount;
    if (pendingCompare !== 0) {
      return pendingCompare;
    }

    var upcomingCompare = b.makeupUpcomingCount - a.makeupUpcomingCount;
    if (upcomingCompare !== 0) {
      return upcomingCompare;
    }

    var studentIdCompare = compareAsc(a.studentId || '', b.studentId || '');
    if (studentIdCompare !== 0) {
      return studentIdCompare;
    }

    return compareAsc(a.name || '', b.name || '');
  });
}

module.exports = {
  buildLeaveMakeupItems: buildLeaveMakeupItems,
  getPendingMakeupCount: getPendingMakeupCount,
  getUpcomingMakeupCount: getUpcomingMakeupCount,
  getAvailableMakeupTrainings: getAvailableMakeupTrainings,
  buildMemberMakeupSummaries: buildMemberMakeupSummaries,
  getToday: getToday,
  getMakeupStatus: getMakeupStatus,
  stripMakeupFields: stripMakeupFields
};
