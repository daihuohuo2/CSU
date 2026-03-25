var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

Page({
  data: {
    isAdmin: false,
    departments: [
      {
        key: 'office',
        name: '办公室',
        desc: '日常行政与资料管理',
        icon: '🗂️',
        bgColor: '#F5F0FF',
        color: '#6B4EFF'
      },
      {
        key: 'security',
        name: '特勤部',
        desc: '值勤安排与任务保障',
        icon: '🛡️',
        bgColor: '#FFF3F0',
        color: '#C94B2C'
      },
      {
        key: 'finance',
        name: '财务部',
        desc: '经费记录与物资统筹',
        icon: '💼',
        bgColor: '#EEF8F2',
        color: '#1D8A52'
      },
      {
        key: 'publicity',
        name: '宣传部',
        desc: '内容宣传与活动展示',
        icon: '📣',
        bgColor: '#FFF7E8',
        color: '#B7791F'
      }
    ]
  },

  onShow: function() {
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
  },

  handleDepartmentTap: function(e) {
    var key = e.currentTarget.dataset.key;
    var name = e.currentTarget.dataset.name;
    if (key === 'security') {
      wx.navigateTo({ url: '/pages/department/security/list/list' });
      return;
    }

    util.showToast(name + '模块待完善');
  }
});
