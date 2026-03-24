var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

Page({
  data: {
    id: '',
    detail: null,
    isAdmin: false
  },

  onLoad: function(options) {
    this.setData({ id: options.id, isAdmin: storage.isAdmin() });
  },

  onShow: async function() {
    try {
      var detail = await storage.getById(storage.KEYS.TUTORIALS, this.data.id);
      this.setData({ detail: detail });
    } catch (err) {
      console.error(err);
      util.showToast('加载教程失败');
    }
  },

  goEdit: function() {
    wx.navigateTo({ url: '/pages/tutorial/edit/edit?id=' + this.data.id });
  },

  handleDelete: function() {
    var that = this;
    wx.showModal({
      title: '确认删除',
      content: '确定删除该教程吗？',
      success: async function(res) {
        if (!res.confirm) return;

        try {
          await storage.remove(storage.KEYS.TUTORIALS, that.data.id);
          util.showToast('已删除', 'success');
          setTimeout(function() {
            wx.navigateBack();
          }, 1500);
        } catch (err) {
          console.error(err);
          util.showToast('删除失败');
        }
      }
    });
  }
});
