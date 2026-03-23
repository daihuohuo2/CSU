var mockData = require('../mock/data');

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
      Object.keys(data).forEach(function(k) {
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
  list = list.filter(function(item) { return item.id !== id; });
  wx.setStorageSync(key, list);
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

module.exports = {
  KEYS: KEYS,
  initMockData: initMockData,
  getList: getList,
  getById: getById,
  add: add,
  update: update,
  remove: remove,
  getUserInfo: getUserInfo,
  setUserInfo: setUserInfo,
  clearUserInfo: clearUserInfo,
  isAdmin: isAdmin
};
