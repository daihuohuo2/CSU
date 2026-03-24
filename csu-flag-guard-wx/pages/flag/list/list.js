var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

Page({
  data: {
    list: [],
    filteredList: [],
    currentType: '',
    isAdmin: false
  },

  onShow: async function() {
    this.setData({ isAdmin: storage.isAdmin() });
    await this.loadData();
  },

  loadData: async function() {
    try {
      var list = await storage.getList(storage.KEYS.FLAG_CEREMONIES);
      list.forEach(function(item) {
        item.stats = util.calcAttendanceStats(item.attendance || []);
      });
      this.setData({ list: list });
      this.applyFilter();
    } catch (err) {
      console.error(err);
      util.showToast('加载任务失败');
    }
  },

  filterType: function(e) {
    this.setData({ currentType: e.currentTarget.dataset.type });
    this.applyFilter();
  },

  applyFilter: function() {
    var type = this.data.currentType;
    var filtered = this.data.list;
    if (type) {
      filtered = filtered.filter(function(item) { return item.type === type; });
    }
    this.setData({ filteredList: filtered });
  },

  goDetail: function(e) {
    wx.navigateTo({ url: '/pages/flag/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  goCreate: function() {
    wx.navigateTo({ url: '/pages/flag/create/create' });
  }
});
