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
    hasAudienceAttendance: false,
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

  onShow: async function() {
    await this.loadData();
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
      hasAudienceAttendance: groups.audienceAttendance.length > 0,
      queueAttendance: groups.queueAttendance,
      audienceAttendance: groups.audienceAttendance
    });
  },

  loadData: async function() {
    try {
      var detail = await storage.getById(storage.KEYS.FLAG_CEREMONIES, this.data.id);
      if (detail) {
        this.updateDetailState(detail);
      }
    } catch (err) {
      console.error(err);
      util.showToast('加载任务失败');
    }
  },

  changeStatus: async function(e) {
    var index = e.currentTarget.dataset.index;
    var status = e.currentTarget.dataset.status;
    var detail = this.data.detail;
    detail.attendance[index].status = status;

    try {
      await storage.update(storage.KEYS.FLAG_CEREMONIES, this.data.id, { attendance: detail.attendance });
      this.updateDetailState(detail);
      util.showToast('已更新', 'success');
    } catch (err) {
      console.error(err);
      util.showToast('更新失败');
    }
  },

  handleDelete: function() {
    var that = this;
    wx.showModal({
      title: '确认删除',
      content: '确定删除此升降旗任务吗？',
      success: async function(res) {
        if (res.confirm) {
          try {
            await storage.remove(storage.KEYS.FLAG_CEREMONIES, that.data.id);
            util.showToast('已删除', 'success');
            setTimeout(function() { wx.navigateBack(); }, 1500);
          } catch (err) {
            console.error(err);
            util.showToast('删除失败');
          }
        }
      }
    });
  }
});
