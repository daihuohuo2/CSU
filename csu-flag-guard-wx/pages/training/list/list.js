var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

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
    this.setData({ isMineMode: isMineMode });

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
    this.setData({ filteredList: filtered });
  },

  goDetail: function(e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/training/detail/detail?id=' + id });
  },

  goCreate: function() {
    wx.navigateTo({ url: '/pages/training/create/create' });
  }
});
