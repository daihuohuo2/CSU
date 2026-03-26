var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

function parseDateTimeValue(date, time) {
  var dateText = date ? String(date).trim() : '';
  if (!dateText) {
    return 0;
  }

  var timeText = time ? String(time).trim() : '00:00';
  var normalized = (dateText + ' ' + timeText).replace(/\./g, '-').replace('T', ' ');
  var timestamp = new Date(normalized).getTime();

  if (!isNaN(timestamp)) {
    return timestamp;
  }

  var dateMatch = dateText.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!dateMatch) {
    return 0;
  }

  var timeMatch = timeText.match(/(\d{1,2}):(\d{1,2})/);
  var hour = timeMatch ? Number(timeMatch[1]) : 0;
  var minute = timeMatch ? Number(timeMatch[2]) : 0;

  return new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    hour,
    minute
  ).getTime();
}

function sortTrainingsBySchedule(list) {
  return (list || []).slice().sort(function(a, b) {
    var aTime = parseDateTimeValue(a.date, a.time);
    var bTime = parseDateTimeValue(b.date, b.time);

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    var aUpdatedAt = Number(a.updatedAt || a.createdAt || 0);
    var bUpdatedAt = Number(b.updatedAt || b.createdAt || 0);
    return bUpdatedAt - aUpdatedAt;
  });
}

Page({
  data: {
    list: [],
    filteredList: [],
    currentType: '',
    typeOptions: storage.TRAINING_TYPE_OPTIONS.slice(),
    isAdmin: false,
    isMineMode: false,
    currentMemberId: ''
  },

  onLoad: function(options) {
    var isMineMode = !!(options && options.mode === 'mine');
    var presetType = options && options.type ? String(options.type) : '';
    this.setData({
      isMineMode: isMineMode,
      currentType: presetType
    });

    if (isMineMode) {
      wx.setNavigationBarTitle({
        title: '我的训练记录'
      });
    }
  },

  onShow: async function() {
    try {
      var currentMember = await storage.getCurrentMember();
      this.setData({
        isAdmin: storage.isAdmin(),
        currentMemberId: currentMember ? currentMember.id : ''
      });
      await this.loadData();
    } catch (err) {
      console.error(err);
      util.showToast('加载训练失败');
    }
  },

  loadData: async function() {
    try {
      var list = await storage.getList(storage.KEYS.TRAININGS);
      if (this.data.isMineMode) {
        var currentMemberId = this.data.currentMemberId;
        if (!currentMemberId) {
          list = [];
        } else {
          list = list.filter(function(item) {
            var attendance = item.attendance || [];
            return attendance.some(function(record) {
              return record.memberId === currentMemberId;
            });
          });
        }
      }
      list.forEach(function(item) {
        item.stats = util.calcAttendanceStats(item.attendance || []);
      });
      this.setData({ list: list });
      this.applyFilter();
    } catch (err) {
      console.error(err);
      util.showToast('加载训练失败');
    }
  },

  filterType: function(e) {
    this.setData({ currentType: e.currentTarget.dataset.type });
    this.applyFilter();
  },

  applyFilter: function() {
    var type = this.data.currentType;
    var filtered = this.data.list;
    if (type) {
      filtered = filtered.filter(function(item) {
        return item.type === type;
      });
    }
    this.setData({ filteredList: sortTrainingsBySchedule(filtered) });
  },

  goDetail: function(e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/training/detail/detail?id=' + id });
  },

  goCreate: function() {
    wx.navigateTo({ url: '/pages/training/create/create' });
  }
});
