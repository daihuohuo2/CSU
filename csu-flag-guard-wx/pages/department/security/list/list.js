var storage = require('../../../../utils/storage');
var util = require('../../../../utils/util');
var makeupHelper = require('../../../../utils/makeup');

Page({
  data: {
    isAdmin: false,
    stats: {
      totalMembers: 0,
      pendingCount: 0,
      upcomingCount: 0,
      totalCount: 0
    }
  },

  onShow: async function() {
    if (!storage.isAdmin()) {
      util.showToast('仅管理员可访问');
      setTimeout(function() {
        wx.navigateBack({
          fail: function() {
            wx.reLaunch({ url: '/pages/index/index' });
          }
        });
      }, 1200);
      return;
    }

    this.setData({ isAdmin: true });
    await this.loadStats();
  },

  loadStats: async function() {
    try {
      var members = storage.enrichMembers(await storage.getList(storage.KEYS.MEMBERS))
        .filter(storage.isMemberActive);
      var trainings = await storage.getList(storage.KEYS.TRAININGS);
      var summaries = makeupHelper.buildMemberMakeupSummaries(members, trainings);
      var stats = {
        totalMembers: summaries.length,
        pendingCount: 0,
        upcomingCount: 0,
        totalCount: 0
      };

      summaries.forEach(function(item) {
        stats.pendingCount += item.makeupPendingCount;
        stats.upcomingCount += item.makeupUpcomingCount;
        stats.totalCount += item.makeupTotalCount;
      });

      this.setData({ stats: stats });
    } catch (err) {
      console.error(err);
      util.showToast('加载特勤部数据失败');
    }
  },

  goMakeupModule: function() {
    wx.navigateTo({ url: '/pages/department/security/makeup/list/list' });
  },

  goMakeupScheduleManage: function() {
    wx.navigateTo({ url: '/pages/training/list/list?type=补训' });
  }
});
