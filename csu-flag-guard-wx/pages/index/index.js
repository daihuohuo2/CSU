var storage = require('../../utils/storage');

Page({
  data: {
    userInfo: null,
    isAdmin: false,
    memberInfo: null
  },

  onShow: async function () {
    var userInfo = storage.getUserInfo();
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    var memberInfo = null;
    if (userInfo.memberId) {
      memberInfo = storage.enrichMember(await storage.getById(storage.KEYS.MEMBERS, userInfo.memberId));
    }

    this.setData({
      userInfo: userInfo,
      isAdmin: userInfo.role === 'admin',
      memberInfo: memberInfo
    });
  },

  goLogin: function () {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goMine: function () {
    wx.navigateTo({ url: '/pages/mine/mine' });
  },

  goTraining: function () {
    wx.navigateTo({ url: '/pages/training/list/list' });
  },

  goFlag: function () {
    wx.navigateTo({ url: '/pages/flag/list/list' });
  },

  goMember: function () {
    wx.navigateTo({ url: '/pages/member/list/list' });
  },

  goDepartment: function () {
    wx.navigateTo({ url: '/pages/department/list/list' });
  },

  goDepartmentWork: function () {
    wx.navigateTo({ url: '/pages/department/work/work' });
  },

  goTutorial: function () {
    wx.navigateTo({ url: '/pages/tutorial/list/list' });
  },

  goChronicle: function () {
    wx.navigateTo({ url: '/pages/chronicle/list/list' });
  },

  goTrainingCreate: function () {
    wx.navigateTo({ url: '/pages/training/create/create' });
  },

  goFlagCreate: function () {
    wx.navigateTo({ url: '/pages/flag/create/create' });
  },

  goMemberAdd: function () {
    wx.navigateTo({ url: '/pages/member/edit/edit' });
  },

  goTutorialAdd: function () {
    wx.navigateTo({ url: '/pages/tutorial/edit/edit' });
  }
});
