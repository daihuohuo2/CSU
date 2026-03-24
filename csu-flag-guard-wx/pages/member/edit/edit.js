var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

function buildPositionOptions(selectedPositions) {
  return storage.POSITION_OPTIONS.map(function(label) {
    return {
      label: label,
      checked: selectedPositions.indexOf(label) !== -1
    };
  });
}

Page({
  data: {
    isEdit: false,
    editId: '',
    form: {
      name: '', gender: '', studentId: '', college: '', major: '',
      grade: '', className: '', department: '', phone: '', wechat: '',
      joinDate: '', position: [], status: '在队', remark: ''
    },
    positionSummary: '',
    genderOptions: ['男', '女'],
    departmentOptions: storage.DEPARTMENT_OPTIONS,
    positionOptions: buildPositionOptions([]),
    statusOptions: ['在队', '离队']
  },

  syncPositionOptions: function(positions) {
    this.setData({
      positionOptions: buildPositionOptions(positions),
      positionSummary: storage.getPositionText(positions)
    });
  },

  onLoad: function(options) {
    if (options.id) {
      var member = storage.getById(storage.KEYS.MEMBERS, options.id);
      if (member) {
        var positions = storage.normalizePositions(member.position);
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
            department: member.department || '',
            phone: member.phone || '',
            wechat: member.wechat || '',
            joinDate: member.joinDate || '',
            position: positions,
            status: member.status || '在队',
            remark: member.remark || ''
          }
        });
        this.syncPositionOptions(positions);
        wx.setNavigationBarTitle({ title: '编辑成员' });
        return;
      }
    }
    this.syncPositionOptions(this.data.form.position);
  },

  onInput: function(e) {
    var obj = {};
    obj['form.' + e.currentTarget.dataset.field] = e.detail.value;
    this.setData(obj);
  },

  onGenderPick: function(e) {
    this.setData({ 'form.gender': this.data.genderOptions[e.detail.value] });
  },

  onDepartmentPick: function(e) {
    this.setData({ 'form.department': this.data.departmentOptions[e.detail.value] });
  },

  togglePosition: function(e) {
    var value = e.currentTarget.dataset.value;
    var positions = this.data.form.position.slice();
    var existsIndex = positions.indexOf(value);

    if (e.detail.value && existsIndex === -1) {
      positions.push(value);
    }
    if (!e.detail.value && existsIndex !== -1) {
      positions.splice(existsIndex, 1);
    }

    this.setData({ 'form.position': positions });
    this.syncPositionOptions(positions);
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
    if (!form.department) { util.showToast('请选择部门'); return; }
    if (!form.position.length) { util.showToast('请至少选择一个职务'); return; }

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
