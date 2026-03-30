var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var memberSorter = require('../../../utils/member-sort');

var DEPARTMENT_MAP = {
  office: {
    name: '办公室',
    departmentValue: '办公室成员',
    icon: '🗂️',
    bgColor: '#F5F0FF',
    color: '#6B4EFF',
    desc: '负责日常行政、资料整理和内部协调。'
  },
  finance: {
    name: '财务部',
    departmentValue: '财务部成员',
    icon: '💰',
    bgColor: '#EEF8F2',
    color: '#1D8A52',
    desc: '负责经费记录、物资台账与财务协助。'
  },
  publicity: {
    name: '宣传部',
    departmentValue: '宣传部成员',
    icon: '📰',
    bgColor: '#FFF7E8',
    color: '#B7791F',
    desc: '负责活动宣传、内容整理和形象展示。'
  }
};

Page({
  data: {
    isAdmin: false,
    departmentKey: '',
    departmentName: '',
    departmentValue: '',
    desc: '',
    icon: '',
    bgColor: '#F5F5F5',
    color: '#333333',
    members: [],
    showTaskModule: false,
    showMeetingModule: false,
    showMaterialModule: false
  },

  onLoad: function(options) {
    var departmentKey = options && options.key ? String(options.key) : '';
    var config = DEPARTMENT_MAP[departmentKey];

    if (!config) {
      util.showToast('未找到对应部门');
      setTimeout(function() {
        wx.navigateBack();
      }, 1200);
      return;
    }

    this.setData({
      departmentKey: departmentKey,
      departmentName: config.name,
      departmentValue: config.departmentValue,
      desc: config.desc,
      icon: config.icon,
      bgColor: config.bgColor,
      color: config.color,
      showTaskModule: departmentKey === 'office',
      showMeetingModule: departmentKey === 'office',
      showMaterialModule: departmentKey === 'office'
    });

    wx.setNavigationBarTitle({
      title: config.name
    });
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
    await this.loadMembers();
  },

  loadMembers: async function() {
    try {
      var members = memberSorter.sortMembersForAssignment(
        storage.enrichMembers(await storage.getList(storage.KEYS.MEMBERS))
          .filter(storage.isMemberActive)
          .filter(function(member) {
            return member.department === this.data.departmentValue;
          }.bind(this))
      );

      this.setData({ members: members });
    } catch (err) {
      console.error(err);
      util.showToast('加载部门成员失败');
    }
  },

  goMeetingRecords: function() {
    if (this.data.departmentKey !== 'office') {
      return;
    }

    wx.navigateTo({
      url: '/pages/department/meeting/list/list'
    });
  },

  goOfficeTasks: function() {
    if (this.data.departmentKey !== 'office') {
      return;
    }

    wx.navigateTo({
      url: '/pages/department/task/list/list'
    });
  },

  goBaseMaterials: function() {
    if (this.data.departmentKey !== 'office') {
      return;
    }

    wx.navigateTo({
      url: '/pages/department/material/list/list'
    });
  }
});
