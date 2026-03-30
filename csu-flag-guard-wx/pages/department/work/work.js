var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var memberSorter = require('../../../utils/member-sort');
var officeTaskHelper = require('../../../utils/office-task');

var DEPARTMENT_META = {
  '办公室成员': {
    title: '办公室',
    subtitle: '负责日常行政、资料整理与沟通协调工作',
    icon: '🏢',
    bgColor: '#F5F0FF',
    color: '#6B4EFF',
    key: 'office'
  },
  '特勤部成员': {
    title: '特勤部',
    subtitle: '负责值勤安排、现场保障与任务执行支持',
    icon: '🛡️',
    bgColor: '#FFF3F0',
    color: '#C94B2C',
    key: 'security'
  },
  '财务部成员': {
    title: '财务部',
    subtitle: '负责经费登记、物资采购与账目管理',
    icon: '💰',
    bgColor: '#EEF8F2',
    color: '#1D8A52',
    key: 'finance'
  },
  '宣传部成员': {
    title: '宣传部',
    subtitle: '负责宣传策划、内容发布与活动展示',
    icon: '📚',
    bgColor: '#FFF7E8',
    color: '#B7791F',
    key: 'publicity'
  }
};

function formatTask(task) {
  return Object.assign({}, task, {
    displayDueDate: task.dueDate || '未设置'
  });
}

Page({
  data: {
    loading: true,
    isAdmin: false,
    memberInfo: null,
    departmentMeta: null,
    members: [],
    pendingTasks: [],
    completedTasks: [],
    isOfficeDepartment: false
  },

  onShow: async function() {
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

    try {
      var memberInfo = storage.enrichMember(await storage.getCurrentMember());
      var department = memberInfo && memberInfo.department;
      var departmentMeta = department ? (DEPARTMENT_META[department] || null) : null;

      if (!departmentMeta && department) {
        departmentMeta = {
          title: department.replace('成员', ''),
          subtitle: '当前部门页面正在整理中，可后续补充专属内容与工作入口',
          icon: '🏳️',
          bgColor: '#F5F5F5',
          color: '#666666',
          key: ''
        };
      }

      var members = [];
      var pendingTasks = [];
      var completedTasks = [];
      var isOfficeDepartment = !!(departmentMeta && departmentMeta.key === 'office');

      if (department) {
        members = memberSorter.sortMembersForAssignment(
          storage.enrichMembers(await storage.getList(storage.KEYS.MEMBERS))
            .filter(storage.isMemberActive)
            .filter(function(item) {
              return item.department === department;
            })
        );
      }

      if (isOfficeDepartment && memberInfo && memberInfo.id) {
        try {
          var taskResult = await officeTaskHelper.listTasks({
            departmentKey: 'office',
            memberId: memberInfo.id
          });
          pendingTasks = (taskResult.pendingTasks || []).map(formatTask);
          completedTasks = (taskResult.completedTasks || []).map(formatTask);
        } catch (taskErr) {
          console.error(taskErr);
          util.showToast(taskErr.message || '加载办公室任务失败');
        }
      }

      this.setData({
        loading: false,
        isAdmin: false,
        memberInfo: memberInfo,
        departmentMeta: departmentMeta,
        members: members,
        pendingTasks: pendingTasks,
        completedTasks: completedTasks,
        isOfficeDepartment: isOfficeDepartment
      });
    } catch (err) {
      console.error(err);
      this.setData({ loading: false });
      util.showToast('加载部门信息失败');
    }
  },

  goTaskDetail: function(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }

    wx.navigateTo({
      url: '/pages/department/task/detail/detail?id=' + id + '&mode=member'
    });
  }
});
