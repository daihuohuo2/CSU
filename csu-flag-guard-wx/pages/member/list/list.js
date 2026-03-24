var storage = require('../../../utils/storage');

Page({
  data: {
    list: [],
    filteredList: [],
    keyword: '',
    currentStatus: '',
    isAdmin: false
  },

  onShow: function() {
    this.setData({ isAdmin: storage.isAdmin() });
    this.loadData();
  },

  loadData: function() {
    var list = storage.enrichMembers(storage.getList(storage.KEYS.MEMBERS));
    this.setData({ list: list });
    this.applyFilter();
  },

  onSearch: function(e) {
    this.setData({ keyword: e.detail.value });
    this.applyFilter();
  },

  filterStatus: function(e) {
    this.setData({ currentStatus: e.currentTarget.dataset.status });
    this.applyFilter();
  },

  applyFilter: function() {
    var keyword = this.data.keyword.toLowerCase();
    var status = this.data.currentStatus;
    var filtered = this.data.list.filter(function(item) {
      var matchKeyword = !keyword || item.name.toLowerCase().indexOf(keyword) > -1 || item.studentId.indexOf(keyword) > -1;
      var matchStatus = !status || item.status === status;
      return matchKeyword && matchStatus;
    });
    this.setData({ filteredList: filtered });
  },

  goDetail: function(e) {
    wx.navigateTo({ url: '/pages/member/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  goAdd: function() {
    wx.navigateTo({ url: '/pages/member/edit/edit' });
  }
});
