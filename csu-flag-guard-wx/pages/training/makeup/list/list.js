var storage = require('../../../../utils/storage');
var util = require('../../../../utils/util');
var makeupHelper = require('../../../../utils/makeup');

Page({
  data: {
    memberInfo: null,
    items: [],
    pendingCount: 0,
    upcomingCount: 0,
    isLoading: true
  },

  onShow: async function() {
    await this.loadData();
  },

  loadData: async function() {
    var userInfo = storage.getUserInfo();
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    this.setData({ isLoading: true });

    try {
      var memberInfo = storage.enrichMember(await storage.getCurrentMember());
      if (!memberInfo) {
        this.setData({
          memberInfo: null,
          items: [],
          pendingCount: 0,
          upcomingCount: 0,
          isLoading: false
        });
        util.showToast('未找到当前成员档案');
        return;
      }

      var result = null;
      try {
        result = await storage.getMemberMakeupRecords(memberInfo.id);
      } catch (queryErr) {
        console.warn('listQuery memberMakeupRecords unavailable, fallback to local query', queryErr);
        var trainings = await storage.getList(storage.KEYS.TRAININGS);
        var fallbackItems = makeupHelper.buildLeaveMakeupItems(trainings, memberInfo.id);
        result = {
          items: fallbackItems,
          summary: {
            pendingCount: makeupHelper.getPendingMakeupCount(fallbackItems),
            upcomingCount: makeupHelper.getUpcomingMakeupCount(fallbackItems)
          }
        };
      }
      var items = result.items || [];
      var summary = result.summary || {};

      this.setData({
        memberInfo: memberInfo,
        items: items,
        pendingCount: Number(summary.pendingCount || 0),
        upcomingCount: Number(summary.upcomingCount || 0),
        isLoading: false
      });
    } catch (err) {
      console.error(err);
      this.setData({ isLoading: false });
      util.showToast('加载补训记录失败');
    }
  },

  goSelect: function(e) {
    var leaveTrainingId = e.currentTarget.dataset.leaveTrainingId;
    var attendanceIndex = e.currentTarget.dataset.attendanceIndex;
    wx.navigateTo({
      url: '/pages/training/makeup/select/select?leaveTrainingId=' + leaveTrainingId + '&attendanceIndex=' + attendanceIndex
    });
  }
});
