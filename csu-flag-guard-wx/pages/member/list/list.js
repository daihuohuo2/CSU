var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

var SEARCH_DEBOUNCE_MS = 250;
var PAGE_SIZE = 30;

Page({
  data: {
    list: [],
    filteredList: [],
    keyword: '',
    currentStatus: '',
    isAdmin: false,
    isBatchMode: false,
    selectedIds: [],
    selectedMap: {},
    isBatchSubmitting: false,
    isLoading: false,
    isLoadingMore: false,
    page: 0,
    hasMore: false,
    total: 0
  },

  onShow: async function() {
    this.pendingReload = false;
    this.setData({ isAdmin: storage.isAdmin() });
    await this.reloadList();
  },

  onUnload: function() {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  },

  onPullDownRefresh: async function() {
    this.setData({ isAdmin: storage.isAdmin() });

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
      var result = await storage.queryMembersPage({
        page: nextPage,
        pageSize: PAGE_SIZE,
        status: this.data.currentStatus,
        keyword: this.data.keyword
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
        isLoadingMore: false,
        selectedIds: reset ? [] : this.data.selectedIds,
        selectedMap: reset ? {} : this.data.selectedMap
      });
    } catch (err) {
      console.error(err);
      this.setData({
        isLoading: false,
        isLoadingMore: false
      });
      util.showToast(err.message || '加载成员失败');
    }

    if (this.pendingReload) {
      this.pendingReload = false;
      setTimeout(function() {
        this.reloadList();
      }.bind(this), 0);
    }
  },

  onSearch: function(e) {
    this.setData({ keyword: e.detail.value });

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(function() {
      this.reloadList();
    }.bind(this), SEARCH_DEBOUNCE_MS);
  },

  filterStatus: function(e) {
    this.setData({ currentStatus: e.currentTarget.dataset.status });
    this.reloadList();
  },

  enterBatchMode: function() {
    this.setData({
      isBatchMode: true,
      selectedIds: [],
      selectedMap: {}
    });
  },

  exitBatchMode: function() {
    this.setData({
      isBatchMode: false,
      selectedIds: [],
      selectedMap: {},
      isBatchSubmitting: false
    });
  },

  toggleBatchMode: function() {
    if (this.data.isBatchMode) {
      this.exitBatchMode();
      return;
    }
    this.enterBatchMode();
  },

  toggleSelectMember: function(e) {
    if (!this.data.isBatchMode) {
      return;
    }

    var id = e.currentTarget.dataset.id;
    var selectedIds = this.data.selectedIds.slice();
    var index = selectedIds.indexOf(id);

    if (index === -1) {
      selectedIds.push(id);
    } else {
      selectedIds.splice(index, 1);
    }

    this.updateSelectionState(selectedIds);
  },

  updateSelectionState: function(selectedIds) {
    var selectedMap = {};
    (selectedIds || []).forEach(function(id) {
      selectedMap[id] = true;
    });

    this.setData({
      selectedIds: selectedIds,
      selectedMap: selectedMap
    });
  },

  handleMemberTap: function(e) {
    if (this.data.isBatchMode) {
      this.toggleSelectMember(e);
      return;
    }

    this.goDetail(e);
  },

  confirmBatchUpdateStatus: function(status) {
    var that = this;
    var selectedIds = this.data.selectedIds.slice();

    if (!selectedIds.length) {
      util.showToast('请先选择成员');
      return;
    }

    wx.showModal({
      title: '确认批量调整',
      content: '确定将所选成员批量设为“' + status + '”吗？',
      success: async function(res) {
        if (!res.confirm) return;

        that.setData({ isBatchSubmitting: true });

        try {
          await storage.batchUpdateMemberStatus(selectedIds, status);
          util.showToast('批量调整成功', 'success');
          that.exitBatchMode();
          await that.reloadList();
        } catch (err) {
          console.error(err);
          util.showToast(err.message || '批量调整失败');
        } finally {
          that.setData({ isBatchSubmitting: false });
        }
      }
    });
  },

  batchSetActive: function() {
    this.confirmBatchUpdateStatus('在队');
  },

  batchSetInactive: function() {
    this.confirmBatchUpdateStatus('离队');
  },

  goDetail: function(e) {
    wx.navigateTo({ url: '/pages/member/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  goAdd: function() {
    wx.navigateTo({ url: '/pages/member/edit/edit' });
  }
});
