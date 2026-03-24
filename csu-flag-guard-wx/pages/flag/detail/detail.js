var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

var LEGACY_QUEUE_MEMBER_IDS = ['m001', 'm002', 'm003'];

Page({
  data: {
    id: '',
    detail: null,
    stats: {},
    isAdmin: false,
    isRaiseFlag: false,
    queueAttendance: [],
    audienceAttendance: [],
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

  isRaiseFlagTask: function(detail) {
    return !!detail && (detail.type === '升旗' || detail.type === '鍗囨棗');
  },

  buildAttendanceGroups: function(detail) {
    var queueAttendance = [];
    var audienceAttendance = [];
    var attendance = (detail && detail.attendance) || [];
    var queueIds = (detail && detail.queueMemberIds) || [];
    var audienceIds = (detail && detail.audienceMemberIds) || [];
    var hasExplicitGroups = queueIds.length > 0 || audienceIds.length > 0;

    if (!hasExplicitGroups) {
      queueIds = LEGACY_QUEUE_MEMBER_IDS;
    }

    attendance.forEach(function(item, index) {
      var record = Object.assign({ originalIndex: index }, item);
      if (queueIds.indexOf(item.memberId) !== -1) {
        queueAttendance.push(record);
      } else {
        audienceAttendance.push(record);
      }
    });

    return {
      isRaiseFlag: this.isRaiseFlagTask(detail),
      queueAttendance: queueAttendance,
      audienceAttendance: audienceAttendance
    };
  },

  updateDetailState: function(detail) {
    var groups = this.buildAttendanceGroups(detail);
    this.setData({
      detail: detail,
      stats: util.calcAttendanceStats((detail && detail.attendance) || []),
      isRaiseFlag: groups.isRaiseFlag,
      queueAttendance: groups.queueAttendance,
      audienceAttendance: groups.audienceAttendance
    });
  },

  loadData: function() {
    var detail = storage.getById(storage.KEYS.FLAG_CEREMONIES, this.data.id);
    if (detail) {
      this.updateDetailState(detail);
    }
  },

  changeStatus: function(e) {
    var index = e.currentTarget.dataset.index;
    var status = e.currentTarget.dataset.status;
    var detail = this.data.detail;
    detail.attendance[index].status = status;
    storage.update(storage.KEYS.FLAG_CEREMONIES, this.data.id, { attendance: detail.attendance });
    this.updateDetailState(detail);
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
