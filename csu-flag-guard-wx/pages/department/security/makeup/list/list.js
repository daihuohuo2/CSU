var storage = require('../../../../../utils/storage');
var util = require('../../../../../utils/util');
var makeupHelper = require('../../../../../utils/makeup');

Page({
  data: {
    isAdmin: false,
    summaries: [],
    isLoading: true
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
      var members = storage.enrichMembers(await storage.getList(storage.KEYS.MEMBERS))
        .filter(storage.isMemberActive);
      var trainings = await storage.getList(storage.KEYS.TRAININGS);
      var summaries = makeupHelper.buildMemberMakeupSummaries(members, trainings);

      this.setData({
        summaries: summaries,
        isLoading: false
      });
    } catch (err) {
      console.error(err);
      this.setData({ isLoading: false });
      util.showToast('加载补训总览失败');
    }
  },

  goDetail: function(e) {
    var memberId = e.currentTarget.dataset.memberId;
    wx.navigateTo({
      url: '/pages/department/security/makeup/detail/detail?memberId=' + memberId
    });
  }
});
