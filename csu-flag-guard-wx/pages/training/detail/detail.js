var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var makeupHelper = require('../../../utils/makeup');
var memberSorter = require('../../../utils/member-sort');
var leaveApplicationHelper = require('../../../utils/leave-application');

var ARRIVED_STATUS = '已到';
var LEAVE_STATUS = '请假';
var MAKEUP_TYPE = '补训';

function buildPendingLeaveActionText(item) {
  var parts = [];
  if (item.leaveTrainingDate) {
    parts.push(item.leaveTrainingDate);
  }
  if (item.leaveTrainingTitle) {
    parts.push(item.leaveTrainingTitle);
  }
  return parts.join(' ').trim() || '请假记录';
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
    currentMember: null,
    isMakeupTraining: false,
    canApplyLeave: false,
    leaveButtonText: '\u8bf7\u5047\u7533\u8bf7',
    currentLeaveApplication: null,
    isJoiningMakeup: false,
    isRecordingMakeup: false,
    showRecordMakeupPanel: false,
    recordMakeupMembers: [],
    recordMakeupItems: [],
    selectedRecordMemberId: '',
    selectedRecordMemberName: '',
    selectedRecordMemberPendingCount: 0,
    statusKeys: {
      arrived: '已到',
      late: '迟到',
      absent: '缺勤',
      leave: '请假'
    },
    statusColors: {
      '已到': '#07C160',
      '迟到': '#FFA500',
      '缺勤': '#EE0000',
      '请假': '#576B95',
      '未记录': '#CCCCCC'
    }
  },

  getPendingLeaveItemsForMember: function(trainings, memberId, today) {
    return makeupHelper.buildLeaveMakeupItems(trainings, memberId, {
      today: today
    }).filter(function(item) {
      return item.isPending && !item.makeupTrainingId;
    });
  },

  closeRecordMakeupPanel: function() {
    this.setData({
      showRecordMakeupPanel: false,
      recordMakeupMembers: [],
      recordMakeupItems: [],
      recordMakeupTrainings: [],
      recordMakeupToday: '',
      selectedRecordMemberId: '',
      selectedRecordMemberName: '',
      selectedRecordMemberPendingCount: 0
    });
  },

  selectRecordMakeupMemberById: async function(memberId) {
    var selectedMember = null;
    for (var i = 0; i < this.data.recordMakeupMembers.length; i++) {
      if (this.data.recordMakeupMembers[i].id === memberId) {
        selectedMember = this.data.recordMakeupMembers[i];
        break;
      }
    }

    if (!selectedMember) {
      return;
    }

    var recordMakeupItems = [];
    try {
      var result = await storage.getMemberMakeupRecords(selectedMember.id, {
        pendingOnly: true
      });
      recordMakeupItems = (result.items || []).filter(function(item) {
        return item.isPending && !item.makeupTrainingId;
      });
    } catch (queryErr) {
      console.warn('listQuery memberMakeupRecords unavailable for record makeup panel, fallback to local query', queryErr);
      recordMakeupItems = this.getPendingLeaveItemsForMember(
        this.data.recordMakeupTrainings || [],
        selectedMember.id,
        this.data.recordMakeupToday || makeupHelper.getToday()
      );
    }

    this.setData({
      selectedRecordMemberId: selectedMember.id,
      selectedRecordMemberName: selectedMember.name,
      selectedRecordMemberPendingCount: selectedMember.makeupPendingCount || 0,
      recordMakeupItems: recordMakeupItems
    });
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

  noop: function() {},

  goEdit: function() {
    if (!this.data.isAdmin || this.data.isMakeupTraining) {
      return;
    }

    wx.navigateTo({
      url: '/pages/training/create/create?id=' + encodeURIComponent(this.data.id)
    });
  },

  goLeaveApply: function() {
    if (!this.data.canApplyLeave) {
      return;
    }

    wx.navigateTo({
      url: '/pages/training/leave/apply/apply?id=' + encodeURIComponent(this.data.id)
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

  loadData: async function() {
    try {
      var result = await Promise.all([
        storage.getById(storage.KEYS.TRAININGS, this.data.id),
        storage.getList(storage.KEYS.MEMBERS),
        storage.getCurrentMember()
      ]);
      var detail = result[0];
      var members = storage.enrichMembers(result[1] || []);
      var currentMember = storage.enrichMember(result[2]);
      if (detail) {
        detail.attendance = this.sortAttendanceByMemberOrder(detail.attendance || [], buildMemberMap(members));
        var stats = util.calcAttendanceStats(detail.attendance || []);
        var canApplyLeave = false;
        var leaveButtonText = '\u8bf7\u5047\u7533\u8bf7';
        var currentLeaveApplication = null;

        if (currentMember && detail.date && detail.date >= makeupHelper.getToday() && detail.type !== MAKEUP_TYPE) {
          var attendance = detail.attendance || [];
          var hasAttendance = attendance.some(function(item) {
            return item && item.memberId === currentMember.id;
          });

          if (hasAttendance) {
            canApplyLeave = true;
            try {
              currentLeaveApplication = await leaveApplicationHelper.getMemberTrainingApplication(detail.id, currentMember.id);
              if (currentLeaveApplication) {
                leaveButtonText = currentLeaveApplication.status === '\u5df2\u901a\u8fc7'
                  ? '\u8bf7\u5047\u5df2\u901a\u8fc7'
                  : '\u67e5\u770b\u8bf7\u5047\u7533\u8bf7';
              }
            } catch (leaveErr) {
              console.warn('load leave application failed', leaveErr);
            }
          }
        }

        this.setData({
          detail: detail,
          stats: stats,
          isMakeupTraining: detail.type === MAKEUP_TYPE,
          currentMember: currentMember,
          canApplyLeave: canApplyLeave,
          leaveButtonText: leaveButtonText,
          currentLeaveApplication: currentLeaveApplication
        });
      }
    } catch (err) {
      console.error(err);
      util.showToast('加载训练失败');
    }
  },

  updateTrainingAttendance: async function(training, attendance) {
    await storage.update(storage.KEYS.TRAININGS, training.id, {
      _docId: training._docId,
      title: training.title,
      type: training.type,
      date: training.date,
      time: training.time || '',
      location: training.location || '',
      description: training.description || '',
      attendance: attendance
    });
  },

  removeMemberFromMakeupTrainingIfUnused: async function(trainings, memberId, makeupTrainingId, excludeLeaveTrainingId, excludeAttendanceIndex) {
    if (!memberId || !makeupTrainingId) {
      return;
    }

    if (makeupHelper.hasLinkedMakeupRecord(trainings, memberId, makeupTrainingId, {
      excludeLeaveTrainingId: excludeLeaveTrainingId,
      excludeAttendanceIndex: excludeAttendanceIndex
    })) {
      return;
    }

    var makeupTraining = makeupHelper.findTrainingById(trainings, makeupTrainingId);
    if (!makeupTraining) {
      return;
    }

    var removed = makeupHelper.removeMakeupAttendanceMember(makeupTraining.attendance, memberId);
    if (!removed.changed) {
      return;
    }

    await this.updateTrainingAttendance(makeupTraining, removed.attendance);
  },

  changeStatus: async function(e) {
    var index = e.currentTarget.dataset.index;
    var status = e.currentTarget.dataset.status;
    var detail = this.data.detail;
    var previousRecord = detail.attendance[index] || {};
    var previousMakeupTrainingId = previousRecord.makeupTrainingId || '';
    var currentRecord = Object.assign({}, previousRecord, {
      status: status
    });

    if (status !== LEAVE_STATUS) {
      currentRecord = makeupHelper.stripMakeupFields(currentRecord);
    }

    detail.attendance[index] = currentRecord;

    try {
      await this.updateTrainingAttendance(detail, detail.attendance);

      if (status !== LEAVE_STATUS && previousMakeupTrainingId) {
        var trainings = await storage.getList(storage.KEYS.TRAININGS);
        await this.removeMemberFromMakeupTrainingIfUnused(
          trainings,
          previousRecord.memberId,
          previousMakeupTrainingId,
          this.data.id,
          index
        );
      }

      var stats = util.calcAttendanceStats(detail.attendance);
      this.setData({ detail: detail, stats: stats });
      util.showToast('已更新', 'success');
    } catch (err) {
      console.error(err);
      util.showToast('更新失败');
    }
  },

  bindLeaveRecordToCurrentMakeupTraining: async function(leaveItem, memberInfo, options) {
    var settings = Object.assign({
      requireFuture: false,
      markArrived: false,
      successText: '已登记补训',
      loadingKey: 'isJoiningMakeup'
    }, options || {});
    var loadingState = {};
    loadingState[settings.loadingKey] = true;
    this.setData(loadingState);

    try {
      var trainings = await storage.getList(storage.KEYS.TRAININGS);
      var currentTraining = makeupHelper.findTrainingById(trainings, this.data.id);
      var leaveTraining = makeupHelper.findTrainingById(trainings, leaveItem.leaveTrainingId);

      if (!currentTraining) {
        throw new Error('未找到当前补训日程');
      }
      if (settings.requireFuture && !makeupHelper.isEligibleMakeupTraining(currentTraining, { today: makeupHelper.getToday() })) {
        throw new Error('只能选择今天之后的补训日程');
      }
      if (!leaveTraining) {
        throw new Error('原请假记录不存在');
      }

      var attendance = (leaveTraining.attendance || []).slice();
      var currentRecord = attendance[leaveItem.attendanceIndex];

      if (!currentRecord || currentRecord.memberId !== memberInfo.id || currentRecord.status !== LEAVE_STATUS) {
        throw new Error('请假记录已变化，请返回刷新后重试');
      }
      if (currentRecord.makeupTrainingId && currentRecord.makeupTrainingId !== currentTraining.id) {
        throw new Error('该请假记录已关联其他补训');
      }

      var previousMakeupTrainingId = currentRecord.makeupTrainingId || '';
      attendance[leaveItem.attendanceIndex] = makeupHelper.assignMakeupTraining(currentRecord, currentTraining);

      await this.updateTrainingAttendance(leaveTraining, attendance);

      if (previousMakeupTrainingId && previousMakeupTrainingId !== currentTraining.id) {
        await this.removeMemberFromMakeupTrainingIfUnused(
          trainings,
          memberInfo.id,
          previousMakeupTrainingId,
          leaveTraining.id,
          leaveItem.attendanceIndex
        );
      }

      var currentTrainingAttendance = leaveTraining.id === currentTraining.id
        ? attendance
        : currentTraining.attendance;
      var ensured = settings.markArrived
        ? makeupHelper.ensureMakeupAttendanceMemberStatus(currentTrainingAttendance, memberInfo, ARRIVED_STATUS)
        : makeupHelper.ensureMakeupAttendanceMember(currentTrainingAttendance, memberInfo);
      if (ensured.changed) {
        await this.updateTrainingAttendance(currentTraining, ensured.attendance);
      }

      await this.loadData();
      loadingState[settings.loadingKey] = false;
      this.setData(loadingState);
      util.showToast(settings.successText, 'success');
      return true;
    } catch (err) {
      console.error(err);
      loadingState[settings.loadingKey] = false;
      this.setData(loadingState);
      util.showToast(err.message || '登记补训失败');
      return false;
    }
  },

  handleJoinMakeup: async function() {
    if (this.data.isJoiningMakeup) {
      return;
    }

    var detail = this.data.detail;
    if (!detail || detail.type !== MAKEUP_TYPE) {
      return;
    }

    var today = makeupHelper.getToday();
    if (!makeupHelper.isEligibleMakeupTraining(detail, { today: today })) {
      util.showToast('只能选择今天之后的补训日程');
      return;
    }

    try {
      var memberInfo = storage.enrichMember(await storage.getCurrentMember());
      if (!memberInfo) {
        util.showToast('未找到当前成员档案');
        return;
      }

      var pendingResult = null;
      try {
        pendingResult = await storage.getMemberMakeupRecords(memberInfo.id, {
          pendingOnly: true
        });
      } catch (queryErr) {
        console.warn('listQuery memberMakeupRecords unavailable in detail page, fallback to local query', queryErr);
        var trainings = await storage.getList(storage.KEYS.TRAININGS);
        pendingResult = {
          items: makeupHelper.buildLeaveMakeupItems(trainings, memberInfo.id, {
            today: today
          }).filter(function(item) {
            return item.isPending;
          })
        };
      }
      var pendingItems = pendingResult.items || [];

      if (!pendingItems.length) {
        util.showToast('无需补训');
        return;
      }

      var that = this;
      wx.showActionSheet({
        itemList: pendingItems.map(buildPendingLeaveActionText),
        success: function(res) {
          if (typeof res.tapIndex !== 'number' || !pendingItems[res.tapIndex]) {
            return;
          }
          that.bindLeaveRecordToCurrentMakeupTraining(pendingItems[res.tapIndex], memberInfo, {
            requireFuture: true,
            markArrived: false,
            successText: '已登记补训',
            loadingKey: 'isJoiningMakeup'
          });
        }
      });
    } catch (err) {
      console.error(err);
      util.showToast('加载补训记录失败');
    }
  },

  handleRecordMakeup: async function() {
    if (this.data.isRecordingMakeup || !this.data.isAdmin || !this.data.isMakeupTraining) {
      return;
    }

    try {
      var today = makeupHelper.getToday();
      var pendingMembers = [];
      var fallbackTrainings = [];
      try {
        var result = await storage.getActiveMemberMakeupSummaries({
          pendingOnly: true
        });
        pendingMembers = result.summaries || [];
        if (result.today) {
          today = result.today;
        }
      } catch (queryErr) {
        console.warn('listQuery activeMemberMakeupSummaries unavailable, fallback to local query', queryErr);
        var members = storage.enrichMembers(await storage.getList(storage.KEYS.MEMBERS));
        fallbackTrainings = await storage.getList(storage.KEYS.TRAININGS);
        pendingMembers = makeupHelper.buildMemberMakeupSummaries(members, fallbackTrainings, {
          today: today
        }).filter(function(member) {
          return member.makeupPendingCount > 0;
        });
      }

      if (!pendingMembers.length) {
        util.showToast('当前没有待补训成员');
        return;
      }

      this.setData({
        showRecordMakeupPanel: true,
        recordMakeupMembers: pendingMembers,
        recordMakeupTrainings: fallbackTrainings,
        recordMakeupToday: today
      });
      await this.selectRecordMakeupMemberById(pendingMembers[0].id);
    } catch (err) {
      console.error(err);
      util.showToast('加载补登信息失败');
    }
  },

  selectRecordMakeupMember: async function(e) {
    var memberId = e.currentTarget.dataset.memberId;
    if (!memberId || memberId === this.data.selectedRecordMemberId) {
      return;
    }

    await this.selectRecordMakeupMemberById(memberId);
  },

  submitRecordMakeup: async function(e) {
    if (this.data.isRecordingMakeup) {
      return;
    }

    var memberId = this.data.selectedRecordMemberId;
    var selectedMember = null;
    for (var i = 0; i < this.data.recordMakeupMembers.length; i++) {
      if (this.data.recordMakeupMembers[i].id === memberId) {
        selectedMember = this.data.recordMakeupMembers[i];
        break;
      }
    }

    if (!selectedMember) {
      util.showToast('请先选择成员');
      return;
    }

    var index = Number(e.currentTarget.dataset.index);
    var leaveItem = this.data.recordMakeupItems[index];
    if (!leaveItem) {
      util.showToast('未找到待补登记记录');
      return;
    }

    var success = await this.bindLeaveRecordToCurrentMakeupTraining(leaveItem, selectedMember, {
      requireFuture: false,
      markArrived: true,
      successText: '已补登补训',
      loadingKey: 'isRecordingMakeup'
    });

    if (success && this.data.showRecordMakeupPanel) {
      this.closeRecordMakeupPanel();
    }
  },

  handleDelete: function() {
    var that = this;
    wx.showModal({
      title: '确认删除',
      content: '确定删除此训练记录吗？删除后不可恢复。',
      success: async function(res) {
        if (res.confirm) {
          try {
            await storage.remove(storage.KEYS.TRAININGS, that.data.id, {
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
