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
    isActiveMember: false,
    banners: [
      { title: '中南大学国旗护卫队招新啦', color: 'linear-gradient(135deg, #C41A1A, #E8536D)', image: '', url: '' },
      { title: '国旗班荣获校级优秀社团', color: 'linear-gradient(135deg, #D4463A, #C41A1A)', image: '', url: '' },
      { title: '升旗仪式精彩瞬间', color: 'linear-gradient(135deg, #8B0000, #C41A1A)', image: '', url: '' }
    ]
  },

  onShow: async function () {
    var requestId = Date.now();
    this.currentProfileRequestId = requestId;
    var userInfo = storage.getUserInfo();
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
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

  onBannerTap: function (e) {
    var index = e.currentTarget.dataset.index;
    var banner = this.data.banners[index];
    if (banner && banner.url) {
      // 预留：跳转到微信公众号文章
      // wx.navigateTo({ url: '/pages/webview/webview?url=' + encodeURIComponent(banner.url) });
      wx.showToast({ title: '即将跳转公众号文章', icon: 'none' });
    } else {
      wx.showToast({ title: '文章链接待配置', icon: 'none' });
    }
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
