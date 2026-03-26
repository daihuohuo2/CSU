var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var chronicleHelper = require('../../../utils/chronicle');

Page({
  data: {
    id: '',
    detail: null,
    isAdmin: false,
    isLoading: true
  },

  onLoad: function(options) {
    var id = chronicleHelper.normalizeText(options.id);
    this.setData({
      id: id,
      isAdmin: storage.isAdmin()
    });
  },

  onShow: async function() {
    if (!this.data.isAdmin) {
      util.showToast('仅管理员可查看人物志');
      setTimeout(function() {
        wx.navigateBack();
      }, 1200);
      return;
    }

    await this.loadData();
  },

  onPullDownRefresh: async function() {
    await this.loadData();
    wx.stopPullDownRefresh();
  },

  loadData: async function() {
    if (!this.data.id) {
      util.showToast('缺少人物志参数');
      return;
    }

    this.setData({ isLoading: true });

    try {
      var entry = await chronicleHelper.fetchChronicleById(this.data.id);
      if (!entry) {
        this.setData({
          detail: null,
          isLoading: false
        });
        util.showToast('未找到人物志');
        return;
      }

      var resolvedEntries = await chronicleHelper.resolveChronicleEntries([entry]);
      var detail = resolvedEntries[0] || chronicleHelper.enrichChronicle(entry);

      this.setData({
        detail: detail,
        isLoading: false
      });

      wx.setNavigationBarTitle({
        title: detail.personName || '人物志'
      });
    } catch (err) {
      console.error(err);
      this.setData({
        detail: null,
        isLoading: false
      });
      util.showToast('加载人物志失败');
    }
  },

  goEdit: function() {
    if (!this.data.detail) {
      return;
    }

    wx.navigateTo({
      url: '/pages/chronicle/edit/edit?id=' + this.data.detail.id + '&year=' + this.data.detail.gradeYear
    });
  },

  previewCover: function() {
    var coverImage = this.data.detail && this.data.detail.coverImage;
    if (!coverImage || !coverImage.tempFileURL) {
      return;
    }

    wx.previewImage({
      current: coverImage.tempFileURL,
      urls: [coverImage.tempFileURL]
    });
  },

  previewImage: function(e) {
    var index = Number(e.currentTarget.dataset.index);
    var detail = this.data.detail || {};
    var currentImage = detail.images && detail.images[index];
    var urls = detail.previewUrls || [];

    if (!currentImage || !currentImage.tempFileURL || !urls.length) {
      return;
    }

    wx.previewImage({
      current: currentImage.tempFileURL,
      urls: urls
    });
  }
});
