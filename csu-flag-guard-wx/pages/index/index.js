var storage = require('../../utils/storage');
var ACTIVE_STATUS_TEXT = '\u5728\u961f';

function isActiveMember(memberInfo) {
  if (!memberInfo) {
    return false;
  }

  var status = memberInfo.status ? String(memberInfo.status).trim() : '';
  return !status || status === ACTIVE_STATUS_TEXT;
}

Page({
  data: {
    userInfo: null,
    isAdmin: false,
    memberInfo: null,
    authResolved: false,
    isProfileLoading: false,
    memberAccessResolved: false,
    isActiveMember: false
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
        isProfileLoading: false,
        memberAccessResolved: true,
        isActiveMember: false
      });
      return;
    }

    this.setData({
      userInfo: userInfo,
      isAdmin: userInfo.role === 'admin',
      authResolved: true,
      isProfileLoading: true,
      memberAccessResolved: false
    });

    try {
      var memberInfo = storage.enrichMember(await storage.getCurrentMember());
      if (this.currentProfileRequestId !== requestId) {
        return;
      }

      this.setData({
        memberInfo: memberInfo,
        isProfileLoading: false,
        memberAccessResolved: true,
        isActiveMember: isActiveMember(memberInfo)
      });
    } catch (err) {
      console.error(err);
      if (this.currentProfileRequestId !== requestId) {
        return;
      }
      this.setData({
        memberInfo: null,
        isProfileLoading: false,
        memberAccessResolved: true,
        isActiveMember: false
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
    if (this.data.userInfo && this.data.memberAccessResolved && !this.data.isActiveMember) {
      return;
    }
    wx.navigateTo({ url: '/pages/department/list/list' });
  },

  goDepartmentWork: function () {
    if (this.data.userInfo && this.data.memberAccessResolved && !this.data.isActiveMember) {
      return;
    }
    wx.navigateTo({ url: '/pages/department/work/work' });
  },

  goTutorial: function () {
    if (this.data.userInfo && this.data.memberAccessResolved && !this.data.isActiveMember) {
      return;
    }
    wx.navigateTo({ url: '/pages/tutorial/list/list' });
  },

  goChronicle: function () {
    wx.navigateTo({ url: '/pages/chronicle/list/list' });
  },

  goBugReport: function () {
    if (!storage.getUserInfo()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/bug/report/report' });
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
