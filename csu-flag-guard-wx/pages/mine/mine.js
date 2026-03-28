var storage = require('../../utils/storage');
var util = require('../../utils/util');

Page({
  data: {
    userInfo: null,
    isAdmin: false,
    isCadre: false,
    memberInfo: null,
    makeupPendingCount: 0,
    makeupUpcomingCount: 0,
    makeupBadgeText: '暂无补训',
    makeupBadgeType: 'normal',
    authResolved: false
  },

  onShow: async function() {
    var requestId = Date.now();
    this.currentProfileRequestId = requestId;
    var userInfo = storage.getUserInfo();
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    this.setData({
      userInfo: userInfo,
      isAdmin: userInfo.role === 'admin',
      authResolved: true
    });

    try {
      var memberInfo = storage.enrichMember(await storage.getCurrentMember());
      var makeupPendingCount = 0;
      var makeupUpcomingCount = 0;
      var makeupBadgeText = '暂无补训';
      var makeupBadgeType = 'normal';

      if (memberInfo) {
        var makeupSummary = await storage.getMemberMakeupSummary(memberInfo.id);
        makeupPendingCount = Number(makeupSummary.pendingCount || 0);
        makeupUpcomingCount = Number(makeupSummary.upcomingCount || 0);

        if (makeupPendingCount > 0) {
          makeupBadgeText = makeupPendingCount + ' 条待补训';
          makeupBadgeType = 'danger';
        } else if (makeupUpcomingCount > 0) {
          makeupBadgeText = makeupUpcomingCount + ' 条待参加';
          makeupBadgeType = 'scheduled';
        }
      }

      if (this.currentProfileRequestId !== requestId) {
        return;
      }

      this.setData({
        userInfo: userInfo,
        isAdmin: userInfo.role === 'admin',
        isCadre: memberInfo ? storage.hasAdminPosition(memberInfo.position) : false,
        memberInfo: memberInfo,
        makeupPendingCount: makeupPendingCount,
        makeupUpcomingCount: makeupUpcomingCount,
        makeupBadgeText: makeupBadgeText,
        makeupBadgeType: makeupBadgeType
      });
    } catch (err) {
      console.error(err);
      if (this.currentProfileRequestId !== requestId) {
        return;
      }
      this.setData({
        memberInfo: null,
        isCadre: false,
        makeupPendingCount: 0,
        makeupUpcomingCount: 0,
        makeupBadgeText: '暂无补训',
        makeupBadgeType: 'normal'
      });
    }
  },

  goTraining: function() {
    wx.navigateTo({ url: '/pages/training/list/list?mode=mine' });
  },

  goFlag: function() {
    wx.navigateTo({ url: '/pages/flag/list/list?mode=mine' });
  },

  goMakeupList: function() {
    wx.navigateTo({ url: '/pages/training/makeup/list/list' });
  },

  switchRole: function() {
    if (!this.data.isCadre) {
      util.showToast('仅干部可切换身份');
      return;
    }

    var userInfo = this.data.userInfo;
    userInfo.role = userInfo.role === 'admin' ? 'member' : 'admin';
    storage.setUserInfo(userInfo);
    this.setData({
      userInfo: userInfo,
      isAdmin: userInfo.role === 'admin'
    });
    util.showToast('已切换为' + (userInfo.role === 'admin' ? '管理员' : '普通成员'), 'success');
  },

  resetData: function() {
    if (!this.data.isAdmin) {
      util.showToast('仅管理员可清除本地缓存');
      return;
    }

    wx.showModal({
      title: '确认清除',
      content: '将清除本地缓存与登录状态，不会影响云数据库中的业务数据，确定吗？',
      success: async function(res) {
        if (res.confirm) {
          try {
            await storage.resetData();
            util.showToast('本地缓存已清除', 'success');
            setTimeout(function() {
              wx.reLaunch({ url: '/pages/login/login' });
            }, 1500);
          } catch (err) {
            console.error(err);
            util.showToast('清除本地缓存失败');
          }
        }
      }
    });
  },

  deduplicateMembers: function() {
    if (!this.data.isAdmin) {
      util.showToast('仅管理员可进行人员去重');
      return;
    }

    wx.showModal({
      title: '确认人员去重',
      content: '将查找成员数据库中信息完全相同的重复成员，并删除重复记录，仅保留一份。确定继续吗？',
      success: async function(res) {
        if (res.confirm) {
          try {
            var result = await storage.deduplicateMembers();
            wx.showModal({
              title: '去重完成',
              content: '共处理 ' + result.groupCount + ' 组重复成员，删除 ' + result.removedCount + ' 条重复记录。',
              showCancel: false
            });
          } catch (err) {
            console.error(err);
            util.showToast(err.message || '人员去重失败');
          }
        }
      }
    });
  },

  handleLogout: function() {
    wx.showModal({
      title: '确认退出',
      content: '确定退出登录吗？',
      success: function(res) {
        if (res.confirm) {
          storage.clearUserInfo();
          util.showToast('已退出', 'success');
          setTimeout(function() {
            wx.reLaunch({ url: '/pages/index/index' });
          }, 1500);
        }
      }
    });
  }
});
