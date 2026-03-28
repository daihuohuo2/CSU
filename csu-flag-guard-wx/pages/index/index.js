var storage = require('../../utils/storage');

Page({
  data: {
    userInfo: null,
    isAdmin: false,
    memberInfo: null,
    authResolved: false,
    isProfileLoading: false
  },

  onShow: async function () {
    var requestId = Date.now();
    this.currentProfileRequestId = requestId;
    var userInfo = storage.getUserInfo();
    if (!userInfo) {
      this.setData({
        userInfo: null,
        isAdmin: false,
        memberInfo: null,
        authResolved: true,
        isProfileLoading: false
      });
      return;
    }

    this.setData({
      userInfo: userInfo,
      isAdmin: userInfo.role === 'admin',
      authResolved: true,
      isProfileLoading: true
    });

    try {
      var memberInfo = storage.enrichMember(await storage.getCurrentMember());
      if (this.currentProfileRequestId !== requestId) {
        return;
      }

      this.setData({
        memberInfo: memberInfo,
        isProfileLoading: false
      });
    } catch (err) {
      console.error(err);
      if (this.currentProfileRequestId !== requestId) {
        return;
      }
      this.setData({
        memberInfo: null,
        isProfileLoading: false
      });
    }
  },

  goLogin: function () {
    if (storage.getUserInfo()) {
      wx.navigateTo({ url: '/pages/mine/mine' });
      return;
    }
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
