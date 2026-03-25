var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var makeupHelper = require('../../../utils/makeup');

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

Page({
  data: {
    id: '',
    detail: null,
    stats: {},
    isAdmin: false,
    isMakeupTraining: false,
    isJoiningMakeup: false,
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

  onLoad: function(options) {
    this.setData({
      id: options.id,
      isAdmin: storage.isAdmin()
    });
  },

  onShow: async function() {
    await this.loadData();
  },

  loadData: async function() {
    try {
      var detail = await storage.getById(storage.KEYS.TRAININGS, this.data.id);
      if (detail) {
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
      await storage.update(storage.KEYS.TRAININGS, this.data.id, {
        _docId: detail._docId,
        attendance: detail.attendance
      });

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

  bindPendingLeaveRecord: async function(leaveItem, memberInfo) {
    this.setData({ isJoiningMakeup: true });

    try {
      var trainings = await storage.getList(storage.KEYS.TRAININGS);
      var currentTraining = makeupHelper.findTrainingById(trainings, this.data.id);
      var leaveTraining = makeupHelper.findTrainingById(trainings, leaveItem.leaveTrainingId);

      if (!currentTraining) {
        throw new Error('\u672a\u627e\u5230\u5f53\u524d\u8865\u8bad\u65e5\u7a0b');
      }
      if (!makeupHelper.isEligibleMakeupTraining(currentTraining, { today: makeupHelper.getToday() })) {
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

      var ensured = makeupHelper.ensureMakeupAttendanceMember(currentTraining.attendance, memberInfo);
      if (ensured.changed) {
        await this.updateTrainingAttendance(currentTraining, ensured.attendance);
      }

      await this.loadData();
      this.setData({ isJoiningMakeup: false });
      util.showToast('\u5df2\u767b\u8bb0\u8865\u8bad', 'success');
    } catch (err) {
      console.error(err);
      this.setData({ isJoiningMakeup: false });
      util.showToast(err.message || '\u767b\u8bb0\u8865\u8bad\u5931\u8d25');
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

      var trainings = await storage.getList(storage.KEYS.TRAININGS);
      var pendingItems = makeupHelper.buildLeaveMakeupItems(trainings, memberInfo.id, {
        today: today
      }).filter(function(item) {
        return item.isPending;
      });

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
          that.bindPendingLeaveRecord(pendingItems[res.tapIndex], memberInfo);
        }
      });
    } catch (err) {
      console.error(err);
      util.showToast('\u52a0\u8f7d\u8865\u8bad\u8bb0\u5f55\u5931\u8d25');
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
            await storage.remove(storage.KEYS.TRAININGS, that.data.id);
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
