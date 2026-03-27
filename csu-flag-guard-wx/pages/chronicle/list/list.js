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
    await this.loadData();
  },

  loadData: async function() {
    this.setData({ isLoading: true });
    var countMap = {};

    try {
      try {
        countMap = await storage.queryChronicleGradeSummary();
      } catch (queryErr) {
        console.warn('listQuery chronicleGradeSummary unavailable, fallback to local query', queryErr);
        var rows = await chronicleHelper.fetchAllChronicles();
        rows.forEach(function(item) {
          var year = chronicleHelper.normalizeText(item.gradeYear);
          if (!year) {
            return;
          }
          countMap[year] = (countMap[year] || 0) + 1;
        });
      }
    } catch (err) {
      console.error(err);
      util.showToast(err.message || '加载人物志失败');
    }

    var grades = chronicleHelper.buildGradeOptions().map(function(item) {
      return Object.assign({}, item, {
        count: Number(countMap[item.year] || 0)
      });
    });

    if (!this.data.isAdmin) {
      grades = grades.filter(function(item) {
        return item.count > 0;
      });
    }

    this.setData({
      grades: grades,
      isLoading: false
    });
  },

  goGrade: function(e) {
    var year = e.currentTarget.dataset.year;
    if (!year) {
      return;
    }

    wx.navigateTo({
      url: '/pages/chronicle/grade/grade?year=' + year
    });
  }
});
