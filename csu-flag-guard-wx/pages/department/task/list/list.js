var storage = require('../../../../utils/storage');
var util = require('../../../../utils/util');
var officeTaskHelper = require('../../../../utils/office-task');

function formatTask(task) {
  var dueDate = task.dueDate || '未设置';
  return Object.assign({}, task, {
    displayDueDate: dueDate,
    progressText: (task.completedCount || 0) + '/' + (task.totalCount || 0)
  });
}

Page({
  data: {
    isAdmin: false,
    isLoading: true,
    pendingTasks: [],
    completedTasks: []
  },

  onShow: async function() {
    if (!storage.isAdmin()) {
      util.showToast('仅管理员可访问');
      setTimeout(function() {
        wx.navigateBack({
          fail: function() {
            wx.reLaunch({ url: '/pages/index/index' });
          }
        });
      }, 1200);
      return;
    }

    this.setData({ isAdmin: true });
    await this.loadData();
  },

  onPullDownRefresh: async function() {
    try {
      await this.loadData();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  loadData: async function() {
    this.setData({ isLoading: true });

    try {
      var result = await officeTaskHelper.listTasks({
        departmentKey: 'office'
      });

      this.setData({
        pendingTasks: (result.pendingTasks || []).map(formatTask),
        completedTasks: (result.completedTasks || []).map(formatTask),
        isLoading: false
      });
    } catch (err) {
      console.error(err);
      this.setData({ isLoading: false });
      util.showToast(err.message || '加载办公室任务失败');
    }
  },

  goCreate: function() {
    wx.navigateTo({
      url: '/pages/department/task/edit/edit'
    });
  },

  goDetail: function(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }

    wx.navigateTo({
      url: '/pages/department/task/detail/detail?id=' + id + '&mode=admin'
    });
  }
});
