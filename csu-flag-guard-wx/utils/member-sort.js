var storage = require('./storage');

var CADRE_ORDER = {
  '班长': 0,
  '副班长': 1,
  '办公室主任': 2,
  '特勤部部长': 3,
  '宣传部部长': 4,
  '财务部部长': 5
};

var SPECIAL_ORDER = {
  '擎旗手': 0,
  '撒旗手': 1,
  '升旗手': 2,
  '指挥员': 3
};

function parseGradeValue(grade) {
  var text = String(grade || '').trim();
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

function getRoleCategory(position) {
  var positions = storage.normalizePositions(position);

  if (positions.some(function(item) {
    return Object.prototype.hasOwnProperty.call(CADRE_ORDER, item);
  })) {
    return 0;
  }

  if (positions.some(function(item) {
    return Object.prototype.hasOwnProperty.call(SPECIAL_ORDER, item);
  })) {
    return 1;
  }

  return 2;
}

function getPositionOrder(position) {
  var positions = storage.normalizePositions(position);
  var category = getRoleCategory(position);
  var bestRank = Number.MAX_SAFE_INTEGER;

  positions.forEach(function(item) {
    if (category === 0 && Object.prototype.hasOwnProperty.call(CADRE_ORDER, item)) {
      bestRank = Math.min(bestRank, CADRE_ORDER[item]);
    }

    if (category === 1 && Object.prototype.hasOwnProperty.call(SPECIAL_ORDER, item)) {
      bestRank = Math.min(bestRank, SPECIAL_ORDER[item]);
    }
  });

  return bestRank;
}

function compareMembersForAssignment(a, b) {
  var gradeDiff = parseGradeValue(a.grade) - parseGradeValue(b.grade);
  if (gradeDiff !== 0) {
    return gradeDiff;
  }

  var categoryDiff = getRoleCategory(a.position) - getRoleCategory(b.position);
  if (categoryDiff !== 0) {
    return categoryDiff;
  }

  var positionDiff = getPositionOrder(a.position) - getPositionOrder(b.position);
  if (positionDiff !== 0) {
    return positionDiff;
  }

  var joinDateDiff = String(a.joinDate || '').localeCompare(String(b.joinDate || ''));
  if (joinDateDiff !== 0) {
    return joinDateDiff;
  }

  var studentIdDiff = String(a.studentId || '').localeCompare(String(b.studentId || ''));
  if (studentIdDiff !== 0) {
    return studentIdDiff;
  }

  return String(a.name || '').localeCompare(String(b.name || ''));
}

function sortMembersForAssignment(list) {
  return (list || []).slice().sort(compareMembersForAssignment);
}

module.exports = {
  compareMembersForAssignment: compareMembersForAssignment,
  sortMembersForAssignment: sortMembersForAssignment
};
