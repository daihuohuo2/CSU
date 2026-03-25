var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

Page({
  data: {
    list: [],
    filteredList: [],
    currentType: '',
    typeOptions: storage.TRAINING_TYPE_OPTIONS.slice(),
    isAdmin: false
  },

  onShow: async function() {
    this.setData({ isAdmin: storage.isAdmin() });
    await this.loadData();
  },

  loadData: async function() {
    try {
      var list = await storage.getList(storage.KEYS.TRAININGS);
      list.forEach(function(item) {
        item.stats = util.calcAttendanceStats(item.attendance || []);
      });
      this.setData({ list: list });
      this.applyFilter();
    } catch (err) {
      console.error(err);
      util.showToast('加载训练失败');
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
      filtered = filtered.filter(function(item) {
        return item.type === type;
      });
    }
    this.setData({ filteredList: filtered });
  },

  goDetail: function(e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/training/detail/detail?id=' + id });
  },

  goCreate: function() {
    wx.navigateTo({ url: '/pages/training/create/create' });
  }
});
