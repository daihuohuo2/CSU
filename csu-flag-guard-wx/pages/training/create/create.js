var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

Page({
  data: {
    title: '',
    type: '',
    date: '',
    time: '',
    location: '',
    description: '',
    typeOptions: ['日常训练', '专项训练', '彩排'],
    members: []
  },

  onLoad: async function() {
    try {
      var members = storage.enrichMembers(await storage.getList(storage.KEYS.MEMBERS));
      members.forEach(function(m) {
        m.checked = true;
      });
      this.setData({ members: members });
    } catch (err) {
      console.error(err);
      util.showToast('加载成员失败');
    }
  },

  onInput: function(e) {
    var field = e.currentTarget.dataset.field;
    var obj = {};
    obj[field] = e.detail.value;
    this.setData(obj);
  },

  onTypePick: function(e) {
    this.setData({ type: this.data.typeOptions[e.detail.value] });
  },

  onDatePick: function(e) {
    this.setData({ date: e.detail.value });
  },

  toggleMember: function(e) {
    var index = e.currentTarget.dataset.index;
    var key = 'members[' + index + '].checked';
    var obj = {};
    obj[key] = e.detail.value;
    this.setData(obj);
  },

  handleSubmit: async function() {
    if (!this.data.title.trim()) {
      util.showToast('请输入训练标题');
      return;
    }
    if (!this.data.type) {
      util.showToast('请选择训练类型');
      return;
    }
    if (!this.data.date) {
      util.showToast('请选择日期');
      return;
    }

    var selectedMembers = this.data.members.filter(function(m) { return m.checked; });
    if (selectedMembers.length === 0) {
      util.showToast('请至少选择一名成员');
      return;
    }

    var attendance = selectedMembers.map(function(m) {
      return { memberId: m.id, name: m.name, status: '已到' };
    });

    var userInfo = storage.getUserInfo();
    var training = {
      id: util.generateId('t'),
      title: this.data.title.trim(),
      type: this.data.type,
      date: this.data.date,
      time: this.data.time || '',
      location: this.data.location || '',
      description: this.data.description || '',
      createdBy: userInfo ? userInfo.name : 'admin',
      attendance: attendance
    };

    try {
      await storage.add(storage.KEYS.TRAININGS, training);
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
