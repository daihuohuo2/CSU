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

  onShow: function() {
    var detail = storage.getById(storage.KEYS.MEMBERS, this.data.id);
    this.setData({ detail: detail });
  },

  goEdit: function() {
    wx.navigateTo({ url: '/pages/member/edit/edit?id=' + this.data.id });
  },

  handleDelete: function() {
    var that = this;
    wx.showModal({
      title: '确认删除',
      content: '确定删除该成员档案吗？',
      success: function(res) {
        if (res.confirm) {
          storage.remove(storage.KEYS.MEMBERS, that.data.id);
          util.showToast('已删除', 'success');
          setTimeout(function() { wx.navigateBack(); }, 1500);
        }
      }
    });
  }
});
