var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

var DEPARTMENT_META = {
  '办公室成员': {
    title: '办公室',
    subtitle: '负责日常行政、资料整理与沟通协调工作',
    icon: '🗂️',
    bgColor: '#F5F0FF',
    color: '#6B4EFF'
  },
  '特勤部成员': {
    title: '特勤部',
    subtitle: '负责值勤安排、现场保障与任务执行支持',
    icon: '🛡️',
    bgColor: '#FFF3F0',
    color: '#C94B2C'
  },
  '财务部成员': {
    title: '财务部',
    subtitle: '负责经费登记、物资采购与账目管理',
    icon: '💼',
    bgColor: '#EEF8F2',
    color: '#1D8A52'
  },
  '宣传部成员': {
    title: '宣传部',
    subtitle: '负责宣传策划、内容发布与活动展示',
    icon: '📣',
    bgColor: '#FFF7E8',
    color: '#B7791F'
  }
};

Page({
  data: {
    loading: true,
    isAdmin: false,
    memberInfo: null,
    departmentMeta: null
  },

  onShow: function() {
    var userInfo = storage.getUserInfo();
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    if (userInfo.role === 'admin') {
      util.showToast('请使用部门管理入口');
      setTimeout(function() {
        wx.navigateBack({
          fail: function() {
            wx.reLaunch({ url: '/pages/index/index' });
          }
        });
      }, 1200);
      return;
    }

    var memberInfo = null;
    if (userInfo.memberId) {
      memberInfo = storage.enrichMember(storage.getById(storage.KEYS.MEMBERS, userInfo.memberId));
    }

    var department = memberInfo && memberInfo.department;
    var departmentMeta = null;
    if (department) {
      departmentMeta = DEPARTMENT_META[department] || {
        title: department.replace('成员', ''),
        subtitle: '当前部门页面正在整理中，可后续补充专属内容与工作入口',
        icon: '🏷️',
        bgColor: '#F5F5F5',
        color: '#666666'
      };
    }

    this.setData({
      loading: false,
      isAdmin: false,
      memberInfo: memberInfo,
      departmentMeta: departmentMeta
    });
  }
});
