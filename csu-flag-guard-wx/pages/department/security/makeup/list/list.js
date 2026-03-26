var storage = require('../../../../../utils/storage');
var util = require('../../../../../utils/util');
var makeupHelper = require('../../../../../utils/makeup');

Page({
  data: {
    isAdmin: false,
    summaries: [],
    isLoading: true,
    isExporting: false
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
      var result = null;
      try {
        result = await storage.getActiveMemberMakeupSummaries();
      } catch (queryErr) {
        console.warn('listQuery activeMemberMakeupSummaries unavailable, fallback to local query', queryErr);
        var members = storage.enrichMembers(await storage.getList(storage.KEYS.MEMBERS))
          .filter(storage.isMemberActive);
        var trainings = await storage.getList(storage.KEYS.TRAININGS);
        result = {
          summaries: makeupHelper.buildMemberMakeupSummaries(members, trainings)
        };
      }
      var summaries = result.summaries || [];

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
  },

  handleExport: async function() {
    if (this.data.isExporting) {
      return;
    }

    this.setData({ isExporting: true });
    wx.showLoading({
      title: '导出中...',
      mask: true
    });

    try {
      var res = await wx.cloud.callFunction({
        name: 'makeupExport'
      });
      var result = res.result || {};

      if (!result.success || !result.fileID) {
        throw new Error(result.message || '导出失败');
      }

      var downloadRes = await wx.cloud.downloadFile({
        fileID: result.fileID
      });

      if (!downloadRes || !downloadRes.tempFilePath) {
        throw new Error('下载导出文件失败');
      }

      wx.hideLoading();
      this.setData({ isExporting: false });

      wx.openDocument({
        filePath: downloadRes.tempFilePath,
        fileType: 'xlsx',
        showMenu: true,
        fail: function(err) {
          console.error(err);
          util.showToast('打开导出文件失败');
        }
      });
    } catch (err) {
      console.error(err);
      wx.hideLoading();
      this.setData({ isExporting: false });
      util.showToast(err.message || '导出补训记录失败');
    }
  }
});
