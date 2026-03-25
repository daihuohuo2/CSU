var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var chronicleHelper = require('../../../utils/chronicle');

Page({
  data: {
    grades: chronicleHelper.buildGradeOptions(),
    isAdmin: false,
    isLoading: true
  },

  onShow: async function() {
    var isAdmin = storage.isAdmin();
    this.setData({ isAdmin: isAdmin });
    if (!isAdmin) {
      util.showToast('仅管理员可查看人物志');
      setTimeout(function() {
        wx.navigateBack();
      }, 1200);
      return;
    }

    await this.loadData();
  },

  loadData: async function() {
    this.setData({ isLoading: true });
    var countMap = {};

    try {
      var rows = await chronicleHelper.fetchAllChronicles();
      rows.forEach(function(item) {
        var year = chronicleHelper.normalizeText(item.gradeYear);
        if (!year) {
          return;
        }
        countMap[year] = (countMap[year] || 0) + 1;
      });
    } catch (err) {
      console.error(err);
      util.showToast('加载人物志失败');
    }

    var grades = chronicleHelper.buildGradeOptions().map(function(item) {
      return Object.assign({}, item, {
        count: countMap[item.year] || 0
      });
    });

    this.setData({
      grades: grades,
      isLoading: false
    });
  },

  goGrade: function(e) {
    var year = e.currentTarget.dataset.year;
    wx.navigateTo({
      url: '/pages/chronicle/grade/grade?year=' + year
    });
  }
});
