var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

Page({
  data: {
    id: '',
    detail: null,
    stats: {},
    isAdmin: false,
    statusColors: {
      '已到': '#07C160',
      '迟到': '#FFA500',
      '缺勤': '#EE0000',
      '请假': '#576B95'
    }
  },

  onLoad: function(options) {
    this.setData({
      id: options.id,
      isAdmin: storage.isAdmin()
    });
  },

  onShow: function() {
    this.loadData();
  },

  loadData: function() {
    var detail = storage.getById(storage.KEYS.TRAININGS, this.data.id);
    if (detail) {
      var stats = util.calcAttendanceStats(detail.attendance || []);
      this.setData({ detail: detail, stats: stats });
    }
  },

  changeStatus: function(e) {
    var index = e.currentTarget.dataset.index;
    var status = e.currentTarget.dataset.status;
    var detail = this.data.detail;
    detail.attendance[index].status = status;
    storage.update(storage.KEYS.TRAININGS, this.data.id, { attendance: detail.attendance });
    var stats = util.calcAttendanceStats(detail.attendance);
    this.setData({ detail: detail, stats: stats });
    util.showToast('已更新', 'success');
  },

  handleDelete: function() {
    var that = this;
    wx.showModal({
      title: '确认删除',
      content: '确定删除此训练记录吗？删除后不可恢复。',
      success: function(res) {
        if (res.confirm) {
          storage.remove(storage.KEYS.TRAININGS, that.data.id);
          util.showToast('已删除', 'success');
          setTimeout(function() {
            wx.navigateBack();
          }, 1500);
        }
      }
    });
  }
});
