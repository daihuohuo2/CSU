var storage = require('../../../../../utils/storage');
var util = require('../../../../../utils/util');
var makeupHelper = require('../../../../../utils/makeup');

Page({
  data: {
    memberId: '',
    isAdmin: false,
    memberInfo: null,
    items: [],
    summary: {
      totalCount: 0,
      pendingCount: 0,
      upcomingCount: 0,
      completedCount: 0
    },
    isLoading: true
  },

  onLoad: function(options) {
    this.setData({
      memberId: options.memberId || ''
    });
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
    await this.loadData();
  },

  loadData: async function() {
    this.setData({ isLoading: true });

    try {
      var memberInfo = storage.enrichMember(await storage.getById(storage.KEYS.MEMBERS, this.data.memberId));
      if (!memberInfo) {
        this.setData({ isLoading: false });
        util.showToast('未找到成员信息');
        return;
      }

      var trainings = await storage.getList(storage.KEYS.TRAININGS);
      var items = makeupHelper.buildLeaveMakeupItems(trainings, memberInfo.id);
      var summary = {
        totalCount: items.length,
        pendingCount: makeupHelper.getPendingMakeupCount(items),
        upcomingCount: makeupHelper.getUpcomingMakeupCount(items),
        completedCount: 0
      };
      summary.completedCount = summary.totalCount - summary.pendingCount - summary.upcomingCount;

      this.setData({
        memberInfo: memberInfo,
        items: items,
        summary: summary,
        isLoading: false
      });
    } catch (err) {
      console.error(err);
      this.setData({ isLoading: false });
      util.showToast('加载成员补训详情失败');
    }
  }
});
