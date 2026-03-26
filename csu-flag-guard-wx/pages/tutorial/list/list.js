var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

Page({
  data: {
    list: [],
    filteredList: [],
    categories: storage.TUTORIAL_CATEGORY_OPTIONS || [],
    currentCategory: '',
    isAdmin: false
  },

  onShow: async function() {
    this.setData({ isAdmin: storage.isAdmin() });
    await this.loadData();
  },

  loadData: async function() {
    try {
      var list = await storage.getList(storage.KEYS.TUTORIALS);

      this.setData({
        list: list,
        categories: storage.TUTORIAL_CATEGORY_OPTIONS || []
      });
      this.applyFilter();
    } catch (err) {
      console.error(err);
      util.showToast('加载教程失败');
    }
  },

  filterCategory: function(e) {
    this.setData({ currentCategory: e.currentTarget.dataset.category });
    this.applyFilter();
  },

  applyFilter: function() {
    var cat = this.data.currentCategory;
    var filtered = this.data.list;

    if (cat) {
      filtered = filtered.filter(function(item) {
        return item.category === cat;
      });
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
