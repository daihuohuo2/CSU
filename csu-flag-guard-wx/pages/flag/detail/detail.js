var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

Page({
  data: {
    id: '',
    detail: null,
    stats: {},
    isAdmin: false,
    statusColors: {
      '正常': '#07C160',
      '迟到': '#FFA500',
      '缺席': '#EE0000',
      '请假': '#576B95'
    }
  },

  onLoad: function(options) {
    this.setData({ id: options.id, isAdmin: storage.isAdmin() });
  },

  onShow: function() {
    this.loadData();
  },

  loadData: function() {
    var detail = storage.getById(storage.KEYS.FLAG_CEREMONIES, this.data.id);
    if (detail) {
      this.setData({
        detail: detail,
        stats: util.calcAttendanceStats(detail.attendance || [])
      });
    }
  },

  changeStatus: function(e) {
    var index = e.currentTarget.dataset.index;
    var status = e.currentTarget.dataset.status;
    var detail = this.data.detail;
    detail.attendance[index].status = status;
    storage.update(storage.KEYS.FLAG_CEREMONIES, this.data.id, { attendance: detail.attendance });
    this.setData({
      detail: detail,
      stats: util.calcAttendanceStats(detail.attendance)
    });
    util.showToast('已更新', 'success');
  },

  handleDelete: function() {
    var that = this;
    wx.showModal({
      title: '确认删除',
      content: '确定删除此升降旗任务吗？',
      success: function(res) {
        if (res.confirm) {
          storage.remove(storage.KEYS.FLAG_CEREMONIES, that.data.id);
          util.showToast('已删除', 'success');
          setTimeout(function() { wx.navigateBack(); }, 1500);
        }
      }
    });
  }
});
