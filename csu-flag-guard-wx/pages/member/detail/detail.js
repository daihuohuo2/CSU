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
      var detail = await storage.getById(storage.KEYS.MEMBERS, this.data.id);
      this.setData({ detail: storage.enrichMember(detail) });
    } catch (err) {
      console.error(err);
      util.showToast('加载成员失败');
    }
  },

  goEdit: function() {
    wx.navigateTo({ url: '/pages/member/edit/edit?id=' + this.data.id });
  },

  handleDelete: function() {
    var that = this;
    wx.showModal({
      title: '确认删除',
      content: '确定删除该成员档案吗？',
      success: async function(res) {
        if (res.confirm) {
          try {
            await storage.remove(storage.KEYS.MEMBERS, that.data.id, {
              _docId: that.data.detail && that.data.detail._docId ? that.data.detail._docId : ''
            });
            util.showToast('已删除', 'success');
            setTimeout(function() { wx.navigateBack(); }, 1500);
          } catch (err) {
            console.error(err);
            util.showToast(err.message || '删除失败');
          }
        }
      }
    });
  }
});
