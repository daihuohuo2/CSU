var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

function getStatusRank(status) {
  if (status === '在队') return 0;
  if (status === '离队') return 1;
  return 2;
}

var POSITION_RANK = {
  '班长': 0,
  '副班长': 1,
  '办公室主任': 2,
  '特勤部部长': 3,
  '宣传部部长': 4,
  '财务部部长': 5
};

function parseGradeValue(grade) {
  var text = String(grade || '').trim();
  var match = text.match(/\d+/);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  var value = parseInt(match[0], 10);
  if (value < 100) {
    value += 2000;
  }
  return value;
}

function getPositionRank(position) {
  var positions = storage.normalizePositions(position);
  var bestRank = Number.MAX_SAFE_INTEGER;

  positions.forEach(function(item) {
    if (Object.prototype.hasOwnProperty.call(POSITION_RANK, item)) {
      bestRank = Math.min(bestRank, POSITION_RANK[item]);
    }
  });

  return bestRank;
}

function compareMembers(a, b, groupByStatus) {
  if (groupByStatus) {
    var statusDiff = getStatusRank(a.status) - getStatusRank(b.status);
    if (statusDiff !== 0) {
      return statusDiff;
    }
  }

  var gradeDiff = parseGradeValue(a.grade) - parseGradeValue(b.grade);
  if (gradeDiff !== 0) {
    return gradeDiff;
  }

  var positionDiff = getPositionRank(a.position) - getPositionRank(b.position);
  if (positionDiff !== 0) {
    return positionDiff;
  }

  var joinDateDiff = String(a.joinDate || '').localeCompare(String(b.joinDate || ''));
  if (joinDateDiff !== 0) {
    return joinDateDiff;
  }

  var studentIdDiff = String(a.studentId || '').localeCompare(String(b.studentId || ''));
  if (studentIdDiff !== 0) {
    return studentIdDiff;
  }

  return String(a.name || '').localeCompare(String(b.name || ''));
}

Page({
  data: {
    list: [],
    filteredList: [],
    keyword: '',
    currentStatus: '',
    isAdmin: false
  },

  onShow: async function() {
    this.setData({ isAdmin: storage.isAdmin() });
    await this.loadData();
  },

  onPullDownRefresh: async function() {
    this.setData({ isAdmin: storage.isAdmin() });

    try {
      await this.loadData();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  loadData: async function() {
    try {
      var list = storage.enrichMembers(await storage.getList(storage.KEYS.MEMBERS));
      this.setData({ list: list });
      this.applyFilter();
    } catch (err) {
      console.error(err);
      util.showToast('加载成员失败');
    }
  },

  onSearch: function(e) {
    this.setData({ keyword: e.detail.value });
    this.applyFilter();
  },

  filterStatus: function(e) {
    this.setData({ currentStatus: e.currentTarget.dataset.status });
    this.applyFilter();
  },

  applyFilter: function() {
    var keyword = this.data.keyword.toLowerCase();
    var status = this.data.currentStatus;
    var filtered = this.data.list.filter(function(item) {
      var name = String(item.name || '').toLowerCase();
      var studentId = String(item.studentId || '');
      var matchKeyword = !keyword || name.indexOf(keyword) > -1 || studentId.indexOf(keyword) > -1;
      var matchStatus = !status || item.status === status;
      return matchKeyword && matchStatus;
    });

    filtered = filtered.slice().sort(function(a, b) {
      return compareMembers(a, b, !status);
    });

    this.setData({ filteredList: filtered });
  },

  goDetail: function(e) {
    wx.navigateTo({ url: '/pages/member/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  goAdd: function() {
    wx.navigateTo({ url: '/pages/member/edit/edit' });
  }
});
