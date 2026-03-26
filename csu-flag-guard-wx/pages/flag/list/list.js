var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

Page({
  data: {
    list: [],
    filteredList: [],
    currentType: '',
    isAdmin: false,
    isMineMode: false,
    currentMemberId: ''
  },

  onLoad: async function(options) {
    var isMineMode = !!(options && options.mode === 'mine');
    this.setData({ isMineMode: isMineMode });

    if (isMineMode) {
      wx.setNavigationBarTitle({
        title: '我的升降旗记录'
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
      util.showToast('加载任务失败');
    }
  },

  loadData: async function() {
    try {
      var list = await storage.getList(storage.KEYS.FLAG_CEREMONIES);
      if (this.data.isMineMode) {
        var currentMemberId = this.data.currentMemberId;
        if (!currentMemberId) {
          list = [];
        } else {
          list = list.filter(function(item) {
            var attendance = item.attendance || [];
            var queueMemberIds = item.queueMemberIds || [];
            var audienceMemberIds = item.audienceMemberIds || [];

            return attendance.some(function(record) {
              return record.memberId === currentMemberId;
            }) || queueMemberIds.indexOf(currentMemberId) !== -1 || audienceMemberIds.indexOf(currentMemberId) !== -1;
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
      util.showToast('加载任务失败');
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
      filtered = filtered.filter(function(item) { return item.type === type; });
    }
    this.setData({ filteredList: filtered });
  },

  goDetail: function(e) {
    wx.navigateTo({ url: '/pages/flag/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  goCreate: function() {
    wx.navigateTo({ url: '/pages/flag/create/create' });
  }
});
