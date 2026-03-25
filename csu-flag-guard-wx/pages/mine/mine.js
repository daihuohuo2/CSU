var storage = require('../../utils/storage');
var util = require('../../utils/util');
var makeupHelper = require('../../utils/makeup');

Page({
  data: {
    userInfo: null,
    isAdmin: false,
    memberInfo: null,
    makeupPendingCount: 0,
    makeupUpcomingCount: 0,
    makeupBadgeText: '暂无补训',
    makeupBadgeType: 'normal'
  },

  onShow: async function() {
    var userInfo = storage.getUserInfo();
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    try {
      var memberInfo = storage.enrichMember(await storage.getCurrentMember());
      var makeupPendingCount = 0;
      var makeupUpcomingCount = 0;
      var makeupBadgeText = '暂无补训';
      var makeupBadgeType = 'normal';

      if (memberInfo) {
        var trainings = await storage.getList(storage.KEYS.TRAININGS);
        var makeupItems = makeupHelper.buildLeaveMakeupItems(trainings, memberInfo.id);
        makeupPendingCount = makeupHelper.getPendingMakeupCount(makeupItems);
        makeupUpcomingCount = makeupHelper.getUpcomingMakeupCount(makeupItems);

        if (makeupPendingCount > 0) {
          makeupBadgeText = makeupPendingCount + ' 条待补训';
          makeupBadgeType = 'danger';
        } else if (makeupUpcomingCount > 0) {
          makeupBadgeText = makeupUpcomingCount + ' 条待参加';
          makeupBadgeType = 'scheduled';
        }
      }

      this.setData({
        userInfo: userInfo,
        isAdmin: userInfo.role === 'admin',
        memberInfo: memberInfo,
        makeupPendingCount: makeupPendingCount,
        makeupUpcomingCount: makeupUpcomingCount,
        makeupBadgeText: makeupBadgeText,
        makeupBadgeType: makeupBadgeType
      });
    } catch (err) {
      console.error(err);
      util.showToast('加载个人信息失败');
    }
  },

  goTraining: function() {
    wx.navigateTo({ url: '/pages/training/list/list' });
  },

  goFlag: function() {
    wx.navigateTo({ url: '/pages/flag/list/list' });
  },

  goMakeupList: function() {
    wx.navigateTo({ url: '/pages/training/makeup/list/list' });
  },

  switchRole: function() {
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
    wx.showModal({
      title: '确认重置',
      content: '将清除云端数据并恢复为初始 Mock 数据，确定吗？',
      success: async function(res) {
        if (res.confirm) {
          try {
            await storage.resetData();
            storage.clearUserInfo();
            util.showToast('数据已重置', 'success');
            setTimeout(function() {
              wx.reLaunch({ url: '/pages/login/login' });
            }, 1500);
          } catch (err) {
            console.error(err);
            util.showToast('重置失败，请检查云开发配置');
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
