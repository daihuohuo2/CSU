var storage = require('../../../utils/storage');

Page({
  data: {
    list: [],
    filteredList: [],
    categories: [],
    currentCategory: '',
    isAdmin: false
  },

  onShow: function() {
    this.setData({ isAdmin: storage.isAdmin() });
    this.loadData();
  },

  loadData: function() {
    var list = storage.getList(storage.KEYS.TUTORIALS);
    // 提取分类
    var catMap = {};
    list.forEach(function(item) {
      if (item.category) catMap[item.category] = true;
    });
    this.setData({
      list: list,
      categories: Object.keys(catMap)
    });
    this.applyFilter();
  },

  filterCategory: function(e) {
    this.setData({ currentCategory: e.currentTarget.dataset.category });
    this.applyFilter();
  },

  applyFilter: function() {
    var cat = this.data.currentCategory;
    var filtered = this.data.list;
    if (cat) {
      filtered = filtered.filter(function(item) { return item.category === cat; });
    }
    this.setData({ filteredList: filtered });
  },

  goDetail: function(e) {
    wx.navigateTo({ url: '/pages/tutorial/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  goAdd: function() {
    wx.navigateTo({ url: '/pages/tutorial/edit/edit' });
  }
});
