var storage = require('../../utils/storage');

Page({
  data: {
    userInfo: null,
    isAdmin: false
  },

  onShow: function () {
    var userInfo = storage.getUserInfo();
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({
      userInfo: userInfo,
      isAdmin: userInfo.role === 'admin'
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

  goTutorial: function () {
    wx.navigateTo({ url: '/pages/tutorial/list/list' });
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
