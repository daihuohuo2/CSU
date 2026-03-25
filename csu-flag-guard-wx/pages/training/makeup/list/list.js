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

      var trainings = await storage.getList(storage.KEYS.TRAININGS);
      var items = makeupHelper.buildLeaveMakeupItems(trainings, memberInfo.id);

      this.setData({
        memberInfo: memberInfo,
        items: items,
        pendingCount: makeupHelper.getPendingMakeupCount(items),
        upcomingCount: makeupHelper.getUpcomingMakeupCount(items),
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
