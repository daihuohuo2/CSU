var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var memberSorter = require('../../../utils/member-sort');

var LEGACY_QUEUE_MEMBER_IDS = ['m001', 'm002', 'm003'];
var NORMAL_STATUS = '正常';
var LATE_STATUS = '迟到';
var ABSENT_STATUS = '缺席';
var LEAVE_STATUS = '请假';

function isRaiseFlagTask(detail) {
  return !!detail && String(detail.type || '').indexOf('升') !== -1;
}

function buildMemberMap(members) {
  var map = {};
  (members || []).forEach(function(member) {
    if (member && member.id) {
      map[member.id] = member;
    }
  });
  return map;
}

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
    this.setData({
      id: options.id,
      isAdmin: storage.isAdmin()
    });
  },

  onShow: async function() {
    await this.loadData();
  },

  goEdit: function() {
    if (!this.data.isAdmin) {
      return;
    }

    wx.navigateTo({
      url: '/pages/flag/create/create?id=' + encodeURIComponent(this.data.id)
    });
  },

  sortAttendanceByMemberOrder: function(attendance, memberMap) {
    var map = memberMap || {};
    return (attendance || []).slice().sort(function(a, b) {
      var memberA = map[a.memberId] || {
        id: a.memberId,
        name: a.name || '',
        grade: '',
        joinDate: '',
        studentId: '',
        position: []
      };
      var memberB = map[b.memberId] || {
        id: b.memberId,
        name: b.name || '',
        grade: '',
        joinDate: '',
        studentId: '',
        position: []
      };

      var compare = memberSorter.compareMembersForAssignment(memberA, memberB);
      if (compare !== 0) {
        return compare;
      }

      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  },

  buildAttendanceGroups: function(detail, memberMap) {
    var queueAttendance = [];
    var audienceAttendance = [];
    var effectiveMemberMap = memberMap || this.memberMap || {};
    var attendance = this.sortAttendanceByMemberOrder((detail && detail.attendance) || [], effectiveMemberMap);
    var queueIds = (detail && detail.queueMemberIds) || [];
    var audienceIds = (detail && detail.audienceMemberIds) || [];
    var hasExplicitGroups = queueIds.length > 0 || audienceIds.length > 0;

    if (!hasExplicitGroups) {
      queueIds = LEGACY_QUEUE_MEMBER_IDS;
    }

    attendance.forEach(function(item, index) {
      var originalIndex = ((detail && detail.attendance) || []).findIndex(function(sourceItem) {
        return sourceItem.memberId === item.memberId;
      });
      var record = Object.assign({ originalIndex: originalIndex > -1 ? originalIndex : index }, item);
      if (queueIds.indexOf(item.memberId) !== -1) {
        queueAttendance.push(record);
      } else {
        audienceAttendance.push(record);
      }
    });

    return {
      isRaiseFlag: isRaiseFlagTask(detail),
      queueAttendance: queueAttendance,
      audienceAttendance: audienceAttendance
    };
  },

  updateDetailState: function(detail, memberMap) {
    var groups = this.buildAttendanceGroups(detail, memberMap);
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
      var result = await Promise.all([
        storage.getById(storage.KEYS.FLAG_CEREMONIES, this.data.id),
        storage.getList(storage.KEYS.MEMBERS)
      ]);
      var detail = result[0];
      var memberMap = buildMemberMap(storage.enrichMembers(result[1] || []));
      this.memberMap = memberMap;
      if (detail) {
        this.updateDetailState(detail, memberMap);
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
      await storage.update(storage.KEYS.FLAG_CEREMONIES, this.data.id, {
        _docId: detail._docId || '',
        title: detail.title,
        type: detail.type,
        date: detail.date,
        time: detail.time || '',
        location: detail.location || '',
        description: detail.description || '',
        queueMemberIds: detail.queueMemberIds || [],
        audienceMemberIds: detail.audienceMemberIds || [],
        attendance: detail.attendance
      });
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
            await storage.remove(storage.KEYS.FLAG_CEREMONIES, that.data.id, {
              _docId: that.data.detail && that.data.detail._docId
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
      }
    });
  }
});
