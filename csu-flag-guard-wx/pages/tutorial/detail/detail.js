var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

Page({
  data: {
    id: '',
    detail: null,
    isAdmin: false,
    canManage: false,
    currentMember: null
  },

  onLoad: function(options) {
    this.setData({ id: options.id || '' });
  },

  onShow: async function() {
    try {
      var currentMember = await storage.getCurrentMember();
      var detail = await storage.getById(storage.KEYS.TUTORIALS, this.data.id);
      var isAdmin = storage.isAdmin();
      var canManage = !!(detail && (isAdmin || (currentMember && storage.canManageTutorial(currentMember.position, detail.category))));

      this.setData({
        detail: detail,
        isAdmin: isAdmin,
        canManage: canManage,
        currentMember: currentMember
      });
    } catch (err) {
      console.error(err);
      util.showToast('加载教程失败');
    }
  },

  goEdit: function() {
    if (!this.data.canManage) {
      util.showToast('当前无编辑教程权限');
      return;
    }

    wx.navigateTo({ url: '/pages/tutorial/edit/edit?id=' + this.data.id });
  },

  handleDelete: function() {
    var that = this;

    if (!this.data.canManage) {
      util.showToast('当前无删除教程权限');
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: '确定删除该教程吗？',
      success: async function(res) {
        if (!res.confirm) return;

        try {
          await storage.remove(storage.KEYS.TUTORIALS, that.data.id, {
            _docId: that.data.detail && that.data.detail._docId ? that.data.detail._docId : ''
          });
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
