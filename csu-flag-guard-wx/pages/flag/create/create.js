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
    typeOptions: ['升旗', '降旗'],
    members: []
  },

  onLoad: function() {
    var members = storage.getList(storage.KEYS.MEMBERS);
    members.forEach(function(m) { m.checked = true; });
    this.setData({ members: members });
  },

  onInput: function(e) {
    var obj = {};
    obj[e.currentTarget.dataset.field] = e.detail.value;
    this.setData(obj);
  },

  onTypePick: function(e) {
    this.setData({ type: this.data.typeOptions[e.detail.value] });
  },

  onDatePick: function(e) {
    this.setData({ date: e.detail.value });
  },

  toggleMember: function(e) {
    var obj = {};
    obj['members[' + e.currentTarget.dataset.index + '].checked'] = e.detail.value;
    this.setData(obj);
  },

  handleSubmit: function() {
    if (!this.data.title.trim()) { util.showToast('请输入任务标题'); return; }
    if (!this.data.type) { util.showToast('请选择任务类型'); return; }
    if (!this.data.date) { util.showToast('请选择日期'); return; }

    var selected = this.data.members.filter(function(m) { return m.checked; });
    if (selected.length === 0) { util.showToast('请至少选择一名成员'); return; }

    var attendance = selected.map(function(m) {
      return { memberId: m.id, name: m.name, status: '正常' };
    });

    var item = {
      id: util.generateId('f'),
      title: this.data.title.trim(),
      type: this.data.type,
      date: this.data.date,
      time: this.data.time || '',
      location: this.data.location || '',
      description: this.data.description || '',
      createdBy: 'admin',
      attendance: attendance
    };

    storage.add(storage.KEYS.FLAG_CEREMONIES, item);
    util.showToast('创建成功', 'success');
    setTimeout(function() { wx.navigateBack(); }, 1500);
  }
});
