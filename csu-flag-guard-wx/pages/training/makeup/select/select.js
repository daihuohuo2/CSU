var storage = require('../../../../utils/storage');
var util = require('../../../../utils/util');
var makeupHelper = require('../../../../utils/makeup');

var LEAVE_STATUS = '\u8bf7\u5047';

async function updateTrainingAttendance(training, attendance) {
  await storage.update(storage.KEYS.TRAININGS, training.id, {
    _docId: training._docId,
    attendance: attendance
  });
}

Page({
  data: {
    leaveTrainingId: '',
    attendanceIndex: -1,
    memberInfo: null,
    leaveItem: null,
    availableTrainings: [],
    currentSelectionId: '',
    today: '',
    isLoading: true,
    isSubmitting: false
  },

  onLoad: function(options) {
    this.setData({
      leaveTrainingId: options.leaveTrainingId || '',
      attendanceIndex: Number(options.attendanceIndex || -1)
    });
  },

  onShow: async function() {
    await this.loadData();
  },

  loadData: async function() {
    var userInfo = storage.getUserInfo();
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    this.setData({ isLoading: true });

    try {
      var memberInfo = storage.enrichMember(await storage.getCurrentMember());
      if (!memberInfo) {
        this.setData({ isLoading: false });
        util.showToast('\u672a\u627e\u5230\u5f53\u524d\u6210\u5458\u6863\u6848');
        return;
      }

      var trainings = await storage.getList(storage.KEYS.TRAININGS);
      var leaveItems = makeupHelper.buildLeaveMakeupItems(trainings, memberInfo.id);
      var leaveItem = null;

      for (var i = 0; i < leaveItems.length; i++) {
        if (
          leaveItems[i].leaveTrainingId === this.data.leaveTrainingId &&
          leaveItems[i].attendanceIndex === this.data.attendanceIndex
        ) {
          leaveItem = leaveItems[i];
          break;
        }
      }

      if (!leaveItem) {
        this.setData({ isLoading: false });
        util.showToast('\u672a\u627e\u5230\u5bf9\u5e94\u8bf7\u5047\u8bb0\u5f55');
        setTimeout(function() {
          wx.navigateBack();
        }, 1500);
        return;
      }

      var today = makeupHelper.getToday();
      var availableTrainings = makeupHelper.getAvailableMakeupTrainings(trainings, {
        today: today,
        excludeTrainingId: leaveItem.leaveTrainingId
      });

      this.setData({
        memberInfo: memberInfo,
        leaveItem: leaveItem,
        availableTrainings: availableTrainings,
        currentSelectionId: leaveItem.makeupTrainingId || '',
        today: today,
        isLoading: false
      });
    } catch (err) {
      console.error(err);
      this.setData({ isLoading: false });
      util.showToast('\u52a0\u8f7d\u8865\u8bad\u65e5\u7a0b\u5931\u8d25');
    }
  },

  selectMakeupTraining: async function(e) {
    if (this.data.isSubmitting) {
      return;
    }

    var trainingId = e.currentTarget.dataset.id;
    var selectedTraining = null;
    for (var i = 0; i < this.data.availableTrainings.length; i++) {
      if (this.data.availableTrainings[i].id === trainingId) {
        selectedTraining = this.data.availableTrainings[i];
        break;
      }
    }

    if (!selectedTraining) {
      util.showToast('\u8865\u8bad\u65e5\u7a0b\u4e0d\u5b58\u5728');
      return;
    }

    if (!selectedTraining.date || selectedTraining.date <= this.data.today) {
      util.showToast('\u53ea\u80fd\u9009\u62e9\u4eca\u5929\u4e4b\u540e\u7684\u8865\u8bad\u65e5\u7a0b');
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      var trainings = await storage.getList(storage.KEYS.TRAININGS);
      var trainingDetail = makeupHelper.findTrainingById(trainings, this.data.leaveTrainingId);
      if (!trainingDetail) {
        throw new Error('\u539f\u8bf7\u5047\u8bb0\u5f55\u4e0d\u5b58\u5728');
      }

      var attendance = (trainingDetail.attendance || []).slice();
      var currentRecord = attendance[this.data.attendanceIndex];
      if (!currentRecord || currentRecord.memberId !== this.data.memberInfo.id || currentRecord.status !== LEAVE_STATUS) {
        throw new Error('\u8bf7\u5047\u8bb0\u5f55\u5df2\u53d8\u5316\uff0c\u8bf7\u8fd4\u56de\u5237\u65b0\u540e\u91cd\u8bd5');
      }

      var previousMakeupTrainingId = currentRecord.makeupTrainingId || '';
      attendance[this.data.attendanceIndex] = makeupHelper.assignMakeupTraining(currentRecord, selectedTraining);

      await updateTrainingAttendance(trainingDetail, attendance);

      if (previousMakeupTrainingId && previousMakeupTrainingId !== selectedTraining.id && !makeupHelper.hasLinkedMakeupRecord(trainings, this.data.memberInfo.id, previousMakeupTrainingId, {
        excludeLeaveTrainingId: trainingDetail.id,
        excludeAttendanceIndex: this.data.attendanceIndex
      })) {
        var previousMakeupTraining = makeupHelper.findTrainingById(trainings, previousMakeupTrainingId);
        if (previousMakeupTraining) {
          var removed = makeupHelper.removeMakeupAttendanceMember(previousMakeupTraining.attendance, this.data.memberInfo.id);
          if (removed.changed) {
            await updateTrainingAttendance(previousMakeupTraining, removed.attendance);
          }
        }
      }

      var ensured = makeupHelper.ensureMakeupAttendanceMember(selectedTraining.attendance, this.data.memberInfo);
      if (ensured.changed) {
        await updateTrainingAttendance(selectedTraining, ensured.attendance);
      }

      this.setData({
        currentSelectionId: selectedTraining.id,
        isSubmitting: false
      });
      util.showToast('\u8865\u8bad\u5df2\u767b\u8bb0', 'success');
      setTimeout(function() {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error(err);
      this.setData({ isSubmitting: false });
      util.showToast(err.message || '\u767b\u8bb0\u8865\u8bad\u5931\u8d25');
    }
  },

  clearMakeupTraining: async function() {
    if (this.data.isSubmitting || !this.data.currentSelectionId) {
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      var trainings = await storage.getList(storage.KEYS.TRAININGS);
      var trainingDetail = makeupHelper.findTrainingById(trainings, this.data.leaveTrainingId);
      if (!trainingDetail) {
        throw new Error('\u539f\u8bf7\u5047\u8bb0\u5f55\u4e0d\u5b58\u5728');
      }

      var attendance = (trainingDetail.attendance || []).slice();
      var currentRecord = attendance[this.data.attendanceIndex];
      if (!currentRecord || currentRecord.memberId !== this.data.memberInfo.id || currentRecord.status !== LEAVE_STATUS) {
        throw new Error('\u8bf7\u5047\u8bb0\u5f55\u5df2\u53d8\u5316\uff0c\u8bf7\u8fd4\u56de\u5237\u65b0\u540e\u91cd\u8bd5');
      }

      var previousMakeupTrainingId = currentRecord.makeupTrainingId || '';
      attendance[this.data.attendanceIndex] = makeupHelper.stripMakeupFields(currentRecord);

      await updateTrainingAttendance(trainingDetail, attendance);

      if (previousMakeupTrainingId && !makeupHelper.hasLinkedMakeupRecord(trainings, this.data.memberInfo.id, previousMakeupTrainingId, {
        excludeLeaveTrainingId: trainingDetail.id,
        excludeAttendanceIndex: this.data.attendanceIndex
      })) {
        var previousMakeupTraining = makeupHelper.findTrainingById(trainings, previousMakeupTrainingId);
        if (previousMakeupTraining) {
          var removed = makeupHelper.removeMakeupAttendanceMember(previousMakeupTraining.attendance, this.data.memberInfo.id);
          if (removed.changed) {
            await updateTrainingAttendance(previousMakeupTraining, removed.attendance);
          }
        }
      }

      this.setData({ isSubmitting: false });
      util.showToast('\u5df2\u53d6\u6d88\u8865\u8bad\u767b\u8bb0', 'success');
      setTimeout(function() {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error(err);
      this.setData({ isSubmitting: false });
      util.showToast(err.message || '\u53d6\u6d88\u8865\u8bad\u5931\u8d25');
    }
  }
});
