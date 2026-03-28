var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

Page({
  data: {
    list: [],
    filteredList: [],
    categories: storage.TUTORIAL_CATEGORY_OPTIONS || [],
    currentCategory: '',
    isAdmin: false,
    canManageSpecialTutorials: false,
    canAddTutorial: false,
    specialCategory: storage.SPECIAL_TUTORIAL_CATEGORY || ''
  },

  onShow: async function() {
    var currentMember = await storage.getCurrentMember();
    var isAdmin = storage.isAdmin();
    var canManageSpecialTutorials = !!(currentMember && storage.hasSpecialPosition(currentMember.position));

    this.setData({
      isAdmin: isAdmin,
      canManageSpecialTutorials: canManageSpecialTutorials,
      canAddTutorial: isAdmin || canManageSpecialTutorials,
      specialCategory: storage.SPECIAL_TUTORIAL_CATEGORY || ''
    });

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
    var currentCategory = this.data.currentCategory;
    var filteredList = this.data.list;

    if (currentCategory) {
      filteredList = filteredList.filter(function(item) {
        return item.category === currentCategory;
      });
    }

    this.setData({ filteredList: filteredList });
  },

  goDetail: function(e) {
    wx.navigateTo({
      url: '/pages/tutorial/detail/detail?id=' + e.currentTarget.dataset.id
    });
  },

  goAdd: function() {
    if (!this.data.canAddTutorial) {
      util.showToast('当前无新增教程权限');
      return;
    }

    var url = '/pages/tutorial/edit/edit';
    if (!this.data.isAdmin) {
      url += '?category=' + encodeURIComponent(this.data.specialCategory);
    }

    wx.navigateTo({ url: url });
  }
});
