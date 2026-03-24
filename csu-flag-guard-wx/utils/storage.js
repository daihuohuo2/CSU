var mockData = require('../mock/data');

var POSITION_OPTIONS = [
  '班长',
  '副班长',
  '办公室主任',
  '特勤部部长',
  '财务部部长',
  '宣传部部长',
  '擎旗手',
  '撒旗手',
  '升旗手',
  '指挥员',
  '队员'
];

var DEPARTMENT_OPTIONS = [
  '办公室成员',
  '财务部成员',
  '特勤部成员',
  '宣传部成员'
];

var ADMIN_POSITIONS = [
  '班长',
  '副班长',
  '办公室主任',
  '特勤部部长',
  '财务部部长',
  '宣传部部长'
];

var LEGACY_POSITION_MAP = {
  '队长': '班长',
  '副队长': '副班长',
  '旗手': '擎旗手',
  '护旗手': '升旗手'
};

var KEYS = {
  MEMBERS: 'fg_members',
  TRAININGS: 'fg_trainings',
  FLAG_CEREMONIES: 'fg_flag_ceremonies',
  TUTORIALS: 'fg_tutorials',
  USER_INFO: 'fg_user_info'
};

function initMockData() {
  try {
    var m = wx.getStorageSync(KEYS.MEMBERS);
    if (!m || m.length === 0) {
      wx.setStorageSync(KEYS.MEMBERS, mockData.members);
    }
  } catch (e) {
    wx.setStorageSync(KEYS.MEMBERS, mockData.members);
  }
  try {
    var t = wx.getStorageSync(KEYS.TRAININGS);
    if (!t || t.length === 0) {
      wx.setStorageSync(KEYS.TRAININGS, mockData.trainings);
    }
  } catch (e) {
    wx.setStorageSync(KEYS.TRAININGS, mockData.trainings);
  }
  try {
    var f = wx.getStorageSync(KEYS.FLAG_CEREMONIES);
    if (!f || f.length === 0) {
      wx.setStorageSync(KEYS.FLAG_CEREMONIES, mockData.flagCeremonies);
    }
  } catch (e) {
    wx.setStorageSync(KEYS.FLAG_CEREMONIES, mockData.flagCeremonies);
  }
  try {
    var tu = wx.getStorageSync(KEYS.TUTORIALS);
    if (!tu || tu.length === 0) {
      wx.setStorageSync(KEYS.TUTORIALS, mockData.tutorials);
    }
  } catch (e) {
    wx.setStorageSync(KEYS.TUTORIALS, mockData.tutorials);
  }
}

function getList(key) {
  return wx.getStorageSync(key) || [];
}

function getById(key, id) {
  var list = getList(key);
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i];
  }
  return null;
}

function add(key, item) {
  var list = getList(key);
  list.unshift(item);
  wx.setStorageSync(key, list);
  return item;
}

function update(key, id, data) {
  var list = getList(key);
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      Object.keys(data).forEach(function (k) {
        list[i][k] = data[k];
      });
      wx.setStorageSync(key, list);
      return list[i];
    }
  }
  return null;
}

function remove(key, id) {
  var list = getList(key);
  list = list.filter(function (item) { return item.id !== id; });
  wx.setStorageSync(key, list);
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

function hasAdminPosition(position) {
  var positions = normalizePositions(position);
  return positions.some(function(item) {
    return ADMIN_POSITIONS.indexOf(item) !== -1;
  });
}

function enrichMember(member) {
  if (!member) return null;
  var positions = normalizePositions(member.position);
  return Object.assign({}, member, {
    position: positions,
    positionText: positions.join('、')
  });
}

function enrichMembers(members) {
  return (members || []).map(enrichMember);
}

function getUserInfo() {
  return wx.getStorageSync(KEYS.USER_INFO) || null;
}

function setUserInfo(info) {
  wx.setStorageSync(KEYS.USER_INFO, info);
}

function clearUserInfo() {
  wx.removeStorageSync(KEYS.USER_INFO);
}

function isAdmin() {
  var user = getUserInfo();
  return user && user.role === 'admin';
}

function loginByCredentials(studentId, password) {
  var members = getList(KEYS.MEMBERS);
  for (var i = 0; i < members.length; i++) {
    if (members[i].studentId === studentId && members[i].password === password) {
      var role = hasAdminPosition(members[i].position) ? 'admin' : 'member';
      return {
        name: members[i].name,
        role: role,
        studentId: members[i].studentId,
        memberId: members[i].id
      };
    }
  }
  return null;
}

module.exports = {
  KEYS: KEYS,
  POSITION_OPTIONS: POSITION_OPTIONS,
  DEPARTMENT_OPTIONS: DEPARTMENT_OPTIONS,
  ADMIN_POSITIONS: ADMIN_POSITIONS,
  initMockData: initMockData,
  getList: getList,
  getById: getById,
  add: add,
  update: update,
  remove: remove,
  normalizePositions: normalizePositions,
  getPositionText: getPositionText,
  hasAdminPosition: hasAdminPosition,
  enrichMember: enrichMember,
  enrichMembers: enrichMembers,
  getUserInfo: getUserInfo,
  setUserInfo: setUserInfo,
  clearUserInfo: clearUserInfo,
  isAdmin: isAdmin,
  loginByCredentials: loginByCredentials
};
