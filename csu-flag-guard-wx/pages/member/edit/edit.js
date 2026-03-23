var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

Page({
  data: {
    isEdit: false,
    editId: '',
    form: {
      name: '', gender: '', studentId: '', college: '', major: '',
      grade: '', className: '', phone: '', wechat: '',
      joinDate: '', position: '', status: '在队', remark: ''
    },
    genderOptions: ['男', '女'],
    positionOptions: ['队长', '副队长', '旗手', '护旗手', '队员'],
    statusOptions: ['在队', '离队']
  },

  onLoad: function(options) {
    if (options.id) {
      var member = storage.getById(storage.KEYS.MEMBERS, options.id);
      if (member) {
        this.setData({
          isEdit: true,
          editId: options.id,
          form: {
            name: member.name || '',
            gender: member.gender || '',
            studentId: member.studentId || '',
            college: member.college || '',
            major: member.major || '',
            grade: member.grade || '',
            className: member.className || '',
            phone: member.phone || '',
            wechat: member.wechat || '',
            joinDate: member.joinDate || '',
            position: member.position || '',
            status: member.status || '在队',
            remark: member.remark || ''
          }
        });
        wx.setNavigationBarTitle({ title: '编辑成员' });
      }
    }
  },

  onInput: function(e) {
    var obj = {};
    obj['form.' + e.currentTarget.dataset.field] = e.detail.value;
    this.setData(obj);
  },

  onGenderPick: function(e) {
    this.setData({ 'form.gender': this.data.genderOptions[e.detail.value] });
  },

  onPositionPick: function(e) {
    this.setData({ 'form.position': this.data.positionOptions[e.detail.value] });
  },

  onStatusPick: function(e) {
    this.setData({ 'form.status': this.data.statusOptions[e.detail.value] });
  },

  onJoinDatePick: function(e) {
    this.setData({ 'form.joinDate': e.detail.value });
  },

  handleSubmit: function() {
    var form = this.data.form;
    if (!form.name.trim()) { util.showToast('请输入姓名'); return; }
    if (!form.gender) { util.showToast('请选择性别'); return; }
    if (!form.studentId.trim()) { util.showToast('请输入学号'); return; }

    if (this.data.isEdit) {
      storage.update(storage.KEYS.MEMBERS, this.data.editId, form);
      util.showToast('修改成功', 'success');
    } else {
      var member = Object.assign({}, form, { id: util.generateId('m') });
      storage.add(storage.KEYS.MEMBERS, member);
      util.showToast('新增成功', 'success');
    }
    setTimeout(function() { wx.navigateBack(); }, 1500);
  }
});
