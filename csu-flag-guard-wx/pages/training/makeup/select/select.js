var storage = require('../../../../utils/storage');
var util = require('../../../../utils/util');
var makeupHelper = require('../../../../utils/makeup');

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
        util.showToast('未找到当前成员档案');
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
        util.showToast('未找到对应请假记录');
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
      util.showToast('加载补训日程失败');
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
      util.showToast('补训日程不存在');
      return;
    }

    if (!selectedTraining.date || selectedTraining.date <= this.data.today) {
      util.showToast('只能选择今天之后的补训日程');
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      var trainingDetail = await storage.getById(storage.KEYS.TRAININGS, this.data.leaveTrainingId);
      if (!trainingDetail) {
        throw new Error('原请假记录不存在');
      }

      var attendance = (trainingDetail.attendance || []).slice();
      var currentRecord = attendance[this.data.attendanceIndex];
      if (!currentRecord || currentRecord.memberId !== this.data.memberInfo.id || currentRecord.status !== '请假') {
        throw new Error('请假记录已变化，请返回刷新后重试');
      }

      attendance[this.data.attendanceIndex] = Object.assign({}, currentRecord, {
        makeupTrainingId: selectedTraining.id,
        makeupTrainingTitle: selectedTraining.title,
        makeupTrainingDate: selectedTraining.date,
        makeupTrainingTime: selectedTraining.time || '',
        makeupTrainingLocation: selectedTraining.location || '',
        makeupAssignedAt: Date.now()
      });

      await storage.update(storage.KEYS.TRAININGS, this.data.leaveTrainingId, {
        _docId: trainingDetail._docId,
        attendance: attendance
      });

      this.setData({
        currentSelectionId: selectedTraining.id,
        isSubmitting: false
      });
      util.showToast('补训已登记', 'success');
      setTimeout(function() {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error(err);
      this.setData({ isSubmitting: false });
      util.showToast(err.message || '登记补训失败');
    }
  },

  clearMakeupTraining: async function() {
    if (this.data.isSubmitting || !this.data.currentSelectionId) {
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      var trainingDetail = await storage.getById(storage.KEYS.TRAININGS, this.data.leaveTrainingId);
      if (!trainingDetail) {
        throw new Error('原请假记录不存在');
      }

      var attendance = (trainingDetail.attendance || []).slice();
      var currentRecord = attendance[this.data.attendanceIndex];
      if (!currentRecord || currentRecord.memberId !== this.data.memberInfo.id || currentRecord.status !== '请假') {
        throw new Error('请假记录已变化，请返回刷新后重试');
      }

      attendance[this.data.attendanceIndex] = makeupHelper.stripMakeupFields(currentRecord);

      await storage.update(storage.KEYS.TRAININGS, this.data.leaveTrainingId, {
        _docId: trainingDetail._docId,
        attendance: attendance
      });

      this.setData({ isSubmitting: false });
      util.showToast('已取消补训登记', 'success');
      setTimeout(function() {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error(err);
      this.setData({ isSubmitting: false });
      util.showToast(err.message || '取消补训失败');
    }
  }
});
