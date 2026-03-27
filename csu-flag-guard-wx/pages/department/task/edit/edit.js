var storage = require('../../../../utils/storage');
var util = require('../../../../utils/util');
var memberSorter = require('../../../../utils/member-sort');
var officeTaskHelper = require('../../../../utils/office-task');

var OFFICE_DEPARTMENT = '办公室成员';

Page({
  data: {
    isAdmin: false,
    isLoading: true,
    isSubmitting: false,
    title: '',
    dueDate: '',
    members: [],
    selectedCount: 0
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
    this.setData({ isLoading: true });

    try {
      var members = memberSorter.sortMembersForAssignment(
        storage.enrichMembers(await storage.getList(storage.KEYS.MEMBERS))
          .filter(storage.isMemberActive)
          .filter(function(member) {
            return member.department === OFFICE_DEPARTMENT;
          })
      ).map(function(member) {
        return Object.assign({}, member, {
          checked: false
        });
      });

      this.setData({
        members: members,
        selectedCount: 0,
        isLoading: false
      });
    } catch (err) {
      console.error(err);
      this.setData({ isLoading: false });
      util.showToast('加载办公室成员失败');
    }
  },

  onTitleInput: function(e) {
    this.setData({
      title: e.detail.value
    });
  },

  onDatePick: function(e) {
    this.setData({
      dueDate: e.detail.value
    });
  },

  toggleMember: function(e) {
    var index = Number(e.currentTarget.dataset.index);
    var members = this.data.members.slice();
    var item = members[index];
    if (!item) {
      return;
    }

    members[index] = Object.assign({}, item, {
      checked: !!e.detail.value
    });

    var selectedCount = members.filter(function(member) {
      return member.checked;
    }).length;

    this.setData({
      members: members,
      selectedCount: selectedCount
    });
  },

  handleSubmit: async function() {
    if (this.data.isSubmitting) {
      return;
    }

    var title = officeTaskHelper.normalizeText(this.data.title);
    if (!title) {
      util.showToast('请输入任务名称');
      return;
    }

    if (!this.data.dueDate) {
      util.showToast('请选择截止日期');
      return;
    }

    var assignees = this.data.members.filter(function(member) {
      return member.checked;
    }).map(function(member) {
      return {
        memberId: member.id,
        name: member.name
      };
    });

    if (!assignees.length) {
      util.showToast('请至少选择一名成员');
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      var userInfo = storage.getUserInfo();
      await officeTaskHelper.createTask({
        id: util.generateId('task'),
        title: title,
        dueDate: this.data.dueDate,
        assignees: assignees,
        createdBy: userInfo ? userInfo.name : 'admin'
      });

      util.showToast('任务发布成功', 'success');
      setTimeout(function() {
        wx.navigateBack();
      }, 1200);
    } catch (err) {
      console.error(err);
      util.showToast(err.message || '发布任务失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
