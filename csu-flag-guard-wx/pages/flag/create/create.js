var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var memberSorter = require('../../../utils/member-sort');

Page({
  data: {
    title: '',
    type: '',
    isRaiseFlag: false,
    date: '',
    time: '',
    location: '',
    description: '',
    typeOptions: ['升旗', '降旗'],
    members: [],
    audienceMembers: [],
    queueMemberCount: 0
  },

  onLoad: async function() {
    try {
      var members = memberSorter.sortMembersForAssignment(
        storage.enrichMembers(await storage.getList(storage.KEYS.MEMBERS))
          .filter(storage.isMemberActive)
      ).map(function(member) {
        return Object.assign({}, member, { checked: false });
      });

      this.setData({
        members: members,
        audienceMembers: this.getAudienceMembers(members),
        queueMemberCount: this.getQueueMemberCount(members)
      });
    } catch (err) {
      console.error(err);
      util.showToast('加载成员失败');
    }
  },

  getAudienceMembers: function(members) {
    return members.filter(function(member) {
      return !member.checked;
    });
  },

  getQueueMemberCount: function(members) {
    return members.filter(function(member) {
      return member.checked;
    }).length;
  },

  onInput: function(e) {
    var obj = {};
    obj[e.currentTarget.dataset.field] = e.detail.value;
    this.setData(obj);
  },

  onTypePick: function(e) {
    var type = this.data.typeOptions[e.detail.value];
    this.setData({
      type: type,
      isRaiseFlag: type === '升旗'
    });
  },

  onDatePick: function(e) {
    this.setData({ date: e.detail.value });
  },

  toggleMember: function(e) {
    var index = e.currentTarget.dataset.index;
    var members = this.data.members.slice();
    members[index] = Object.assign({}, members[index], {
      checked: e.detail.value
    });

    this.setData({
      members: members,
      audienceMembers: this.getAudienceMembers(members),
      queueMemberCount: this.getQueueMemberCount(members)
    });
  },

  handleSubmit: async function() {
    if (!this.data.title.trim()) {
      util.showToast('请输入任务标题');
      return;
    }
    if (!this.data.type) {
      util.showToast('请选择任务类型');
      return;
    }
    if (!this.data.date) {
      util.showToast('请选择日期');
      return;
    }

    var queueMembers = this.data.members.filter(function(member) {
      return member.checked;
    });
    if (queueMembers.length === 0) {
      util.showToast('请至少选择一名上岗成员');
      return;
    }

    var isRaiseFlag = this.data.type === '升旗';
    var audienceMembers = isRaiseFlag ? this.getAudienceMembers(this.data.members) : [];
    var attendanceMembers = isRaiseFlag ? queueMembers.concat(audienceMembers) : queueMembers;
    var attendance = attendanceMembers.map(function(member) {
      return {
        memberId: member.id,
        name: member.name,
        status: '正常'
      };
    });

    var userInfo = storage.getUserInfo();
    var item = {
      id: util.generateId('f'),
      title: this.data.title.trim(),
      type: this.data.type,
      date: this.data.date,
      time: this.data.time || '',
      location: this.data.location || '',
      description: this.data.description || '',
      createdBy: userInfo ? userInfo.name : 'admin',
      queueMemberIds: queueMembers.map(function(member) { return member.id; }),
      audienceMemberIds: isRaiseFlag ? audienceMembers.map(function(member) { return member.id; }) : [],
      attendance: attendance
    };

    try {
      await storage.add(storage.KEYS.FLAG_CEREMONIES, item);
      util.showToast('创建成功', 'success');
      setTimeout(function() {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error(err);
      util.showToast('创建失败');
    }
  }
});
