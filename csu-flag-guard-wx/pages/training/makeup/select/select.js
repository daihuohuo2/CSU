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
        util.showToast('\u672a\u627e\u5230\u5f53\u524d\u6210\u5458\u6863\u6848');
        return;
      }

      var selectionData = null;
      try {
        selectionData = await storage.getMakeupSelectionData(
          memberInfo.id,
          this.data.leaveTrainingId,
          this.data.attendanceIndex
        );
      } catch (queryErr) {
        console.warn('listQuery makeupSelectionData unavailable, fallback to local query', queryErr);
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

        selectionData = {
          leaveItem: leaveItem,
          availableTrainings: leaveItem ? makeupHelper.getAvailableMakeupTrainings(trainings, {
            today: makeupHelper.getToday(),
            excludeTrainingId: leaveItem.leaveTrainingId
          }) : [],
          currentSelectionId: leaveItem && leaveItem.makeupTrainingId ? leaveItem.makeupTrainingId : '',
          today: makeupHelper.getToday()
        };
      }
      var leaveItem = selectionData.leaveItem;

      if (!leaveItem) {
        this.setData({ isLoading: false });
        util.showToast('\u672a\u627e\u5230\u5bf9\u5e94\u8bf7\u5047\u8bb0\u5f55');
        setTimeout(function() {
          wx.navigateBack();
        }, 1500);
        return;
      }

      this.setData({
        memberInfo: memberInfo,
        leaveItem: leaveItem,
        availableTrainings: selectionData.availableTrainings || [],
        currentSelectionId: selectionData.currentSelectionId || leaveItem.makeupTrainingId || '',
        today: selectionData.today || '',
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
      await storage.assignMakeupTraining({
        memberId: this.data.memberInfo.id,
        memberName: this.data.memberInfo.name,
        leaveTrainingId: this.data.leaveTrainingId,
        attendanceIndex: this.data.attendanceIndex,
        selectedTrainingId: selectedTraining.id,
        requireFuture: true,
        markArrived: false
      });

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
      await storage.clearMakeupTraining({
        memberId: this.data.memberInfo.id,
        leaveTrainingId: this.data.leaveTrainingId,
        attendanceIndex: this.data.attendanceIndex
      });

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
