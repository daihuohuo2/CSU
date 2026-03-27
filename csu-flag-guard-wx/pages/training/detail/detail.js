var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var makeupHelper = require('../../../utils/makeup');
var memberSorter = require('../../../utils/member-sort');

var ARRIVED_STATUS = '\u5df2\u5230';
var LEAVE_STATUS = '\u8bf7\u5047';
var MAKEUP_TYPE = '\u8865\u8bad';

function buildPendingLeaveActionText(item) {
  var parts = [];
  if (item.leaveTrainingDate) {
    parts.push(item.leaveTrainingDate);
  }
  if (item.leaveTrainingTitle) {
    parts.push(item.leaveTrainingTitle);
  }
  return parts.join(' ').trim() || '\u8bf7\u5047\u8bb0\u5f55';
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
    isMakeupTraining: false,
    isJoiningMakeup: false,
    isRecordingMakeup: false,
    showRecordMakeupPanel: false,
    recordMakeupMembers: [],
    recordMakeupItems: [],
    selectedRecordMemberId: '',
    selectedRecordMemberName: '',
    selectedRecordMemberPendingCount: 0,
    statusKeys: {
      arrived: '\u5df2\u5230',
      late: '\u8fdf\u5230',
      absent: '\u7f3a\u52e4',
      leave: '\u8bf7\u5047'
    },
    statusColors: {
      '\u5df2\u5230': '#07C160',
      '\u8fdf\u5230': '#FFA500',
      '\u7f3a\u52e4': '#EE0000',
      '\u8bf7\u5047': '#576B95',
      '\u672a\u8bb0\u5f55': '#CCCCCC'
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
        storage.getList(storage.KEYS.MEMBERS)
      ]);
      var detail = result[0];
      var members = storage.enrichMembers(result[1] || []);
      if (detail) {
        detail.attendance = this.sortAttendanceByMemberOrder(detail.attendance || [], buildMemberMap(members));
        var stats = util.calcAttendanceStats(detail.attendance || []);
        this.setData({
          detail: detail,
          stats: stats,
          isMakeupTraining: detail.type === MAKEUP_TYPE
        });
      }
    } catch (err) {
      console.error(err);
      util.showToast('\u52a0\u8f7d\u8bad\u7ec3\u5931\u8d25');
    }
  },

  updateTrainingAttendance: async function(training, attendance) {
    await storage.update(storage.KEYS.TRAININGS, training.id, {
      _docId: training._docId,
      title: training.title,
      type: training.type,
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
      util.showToast('\u5df2\u66f4\u65b0', 'success');
    } catch (err) {
      console.error(err);
      util.showToast('\u66f4\u65b0\u5931\u8d25');
    }
  },

  bindLeaveRecordToCurrentMakeupTraining: async function(leaveItem, memberInfo, options) {
    var settings = Object.assign({
      requireFuture: false,
      markArrived: false,
      successText: '\u5df2\u767b\u8bb0\u8865\u8bad',
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
        throw new Error('\u672a\u627e\u5230\u5f53\u524d\u8865\u8bad\u65e5\u7a0b');
      }
      if (settings.requireFuture && !makeupHelper.isEligibleMakeupTraining(currentTraining, { today: makeupHelper.getToday() })) {
        throw new Error('\u53ea\u80fd\u9009\u62e9\u4eca\u5929\u4e4b\u540e\u7684\u8865\u8bad\u65e5\u7a0b');
      }
      if (!leaveTraining) {
        throw new Error('\u539f\u8bf7\u5047\u8bb0\u5f55\u4e0d\u5b58\u5728');
      }

      var attendance = (leaveTraining.attendance || []).slice();
      var currentRecord = attendance[leaveItem.attendanceIndex];

      if (!currentRecord || currentRecord.memberId !== memberInfo.id || currentRecord.status !== LEAVE_STATUS) {
        throw new Error('\u8bf7\u5047\u8bb0\u5f55\u5df2\u53d8\u5316\uff0c\u8bf7\u8fd4\u56de\u5237\u65b0\u540e\u91cd\u8bd5');
      }
      if (currentRecord.makeupTrainingId && currentRecord.makeupTrainingId !== currentTraining.id) {
        throw new Error('\u8be5\u8bf7\u5047\u8bb0\u5f55\u5df2\u5173\u8054\u5176\u4ed6\u8865\u8bad');
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
      util.showToast(err.message || '\u767b\u8bb0\u8865\u8bad\u5931\u8d25');
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
      util.showToast('\u53ea\u80fd\u9009\u62e9\u4eca\u5929\u4e4b\u540e\u7684\u8865\u8bad\u65e5\u7a0b');
      return;
    }

    try {
      var memberInfo = storage.enrichMember(await storage.getCurrentMember());
      if (!memberInfo) {
        util.showToast('\u672a\u627e\u5230\u5f53\u524d\u6210\u5458\u6863\u6848');
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
        util.showToast('\u65e0\u9700\u8865\u8bad');
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
            successText: '\u5df2\u767b\u8bb0\u8865\u8bad',
            loadingKey: 'isJoiningMakeup'
          });
        }
      });
    } catch (err) {
      console.error(err);
      util.showToast('\u52a0\u8f7d\u8865\u8bad\u8bb0\u5f55\u5931\u8d25');
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
        util.showToast('\u5f53\u524d\u6ca1\u6709\u5f85\u8865\u8bad\u6210\u5458');
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
      util.showToast('\u52a0\u8f7d\u8865\u767b\u4fe1\u606f\u5931\u8d25');
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
      util.showToast('\u8bf7\u5148\u9009\u62e9\u6210\u5458');
      return;
    }

    var index = Number(e.currentTarget.dataset.index);
    var leaveItem = this.data.recordMakeupItems[index];
    if (!leaveItem) {
      util.showToast('\u672a\u627e\u5230\u5f85\u8865\u767b\u8bb0\u5f55');
      return;
    }

    var success = await this.bindLeaveRecordToCurrentMakeupTraining(leaveItem, selectedMember, {
      requireFuture: false,
      markArrived: true,
      successText: '\u5df2\u8865\u767b\u8865\u8bad',
      loadingKey: 'isRecordingMakeup'
    });

    if (success && this.data.showRecordMakeupPanel) {
      this.closeRecordMakeupPanel();
    }
  },

  handleDelete: function() {
    var that = this;
    wx.showModal({
      title: '\u786e\u8ba4\u5220\u9664',
      content: '\u786e\u5b9a\u5220\u9664\u6b64\u8bad\u7ec3\u8bb0\u5f55\u5417\uff1f\u5220\u9664\u540e\u4e0d\u53ef\u6062\u590d\u3002',
      success: async function(res) {
        if (res.confirm) {
          try {
            await storage.remove(storage.KEYS.TRAININGS, that.data.id, {
              _docId: that.data.detail && that.data.detail._docId
            });
            util.showToast('\u5df2\u5220\u9664', 'success');
            setTimeout(function() {
              wx.navigateBack();
            }, 1500);
          } catch (err) {
            console.error(err);
            util.showToast('\u5220\u9664\u5931\u8d25');
          }
        }
      }
    });
  }
});
