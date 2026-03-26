var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

var PAGE_SIZE = 20;

Page({
  data: {
    list: [],
    filteredList: [],
    currentType: '',
    typeOptions: storage.TRAINING_TYPE_OPTIONS.slice(),
    isAdmin: false,
    isMineMode: false,
    currentMemberId: '',
    isLoading: false,
    isLoadingMore: false,
    page: 0,
    hasMore: false,
    total: 0
  },

  onLoad: function(options) {
    var isMineMode = !!(options && options.mode === 'mine');
    var presetType = options && options.type ? String(options.type) : '';
    this.setData({
      isMineMode: isMineMode,
      currentType: presetType
    });

    if (isMineMode) {
      wx.setNavigationBarTitle({
        title: '我的训练记录'
      });
    }
  },

  onShow: async function() {
    this.pendingReload = false;

    try {
      var currentMember = await storage.getCurrentMember();
      this.setData({
        isAdmin: storage.isAdmin(),
        currentMemberId: currentMember ? currentMember.id : ''
      });
      await this.reloadList();
    } catch (err) {
      console.error(err);
      util.showToast('加载训练失败');
    }
  },

  onPullDownRefresh: async function() {
    try {
      await this.reloadList();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  onReachBottom: async function() {
    if (!this.data.hasMore || this.data.isLoading || this.data.isLoadingMore) {
      return;
    }

    await this.loadData({ reset: false });
  },

  reloadList: async function() {
    await this.loadData({ reset: true });
  },

  loadData: async function(options) {
    var reset = !options || options.reset !== false;

    if (this.data.isLoading || this.data.isLoadingMore) {
      if (reset) {
        this.pendingReload = true;
      }
      return;
    }

    this.setData(reset ? {
      isLoading: true
    } : {
      isLoadingMore: true
    });

    var nextPage = reset ? 1 : this.data.page + 1;

    try {
      var result = await storage.queryTrainingsPage({
        page: nextPage,
        pageSize: PAGE_SIZE,
        type: this.data.currentType,
        isMineMode: this.data.isMineMode,
        memberId: this.data.currentMemberId
      });

      var mergedList = reset
        ? (result.list || [])
        : this.data.list.concat(result.list || []);

      this.setData({
        list: mergedList,
        filteredList: mergedList,
        page: result.page || nextPage,
        hasMore: !!result.hasMore,
        total: Number(result.total || 0),
        isLoading: false,
        isLoadingMore: false
      });
    } catch (err) {
      console.error(err);
      this.setData({
        isLoading: false,
        isLoadingMore: false
      });
      util.showToast(err.message || '加载训练失败');
    }

    if (this.pendingReload) {
      this.pendingReload = false;
      setTimeout(function() {
        this.reloadList();
      }.bind(this), 0);
    }
  },

  filterType: function(e) {
    this.setData({ currentType: e.currentTarget.dataset.type });
    this.reloadList();
  },

  goDetail: function(e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/training/detail/detail?id=' + id });
  },

  goCreate: function() {
    wx.navigateTo({ url: '/pages/training/create/create' });
  }
});
