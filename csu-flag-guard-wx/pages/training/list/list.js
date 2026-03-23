var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

Page({
  data: {
    list: [],
    filteredList: [],
    currentType: '',
    isAdmin: false
  },

  onShow: function() {
    this.setData({ isAdmin: storage.isAdmin() });
    this.loadData();
  },

  loadData: function() {
    var list = storage.getList(storage.KEYS.TRAININGS);
    // 为每条记录计算考勤统计
    list.forEach(function(item) {
      item.stats = util.calcAttendanceStats(item.attendance || []);
    });
    this.setData({ list: list });
    this.applyFilter();
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
