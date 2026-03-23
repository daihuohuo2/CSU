var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

Page({
  data: {
    isEdit: false,
    editId: '',
    form: {
      title: '',
      category: '',
      content: '',
      tips: '',
      commonMistakes: '',
      summary: ''
    },
    categoryOptions: ['基础动作', '行进动作', '仪式流程', '其他']
  },

  onLoad: function(options) {
    if (options.id) {
      var tutorial = storage.getById(storage.KEYS.TUTORIALS, options.id);
      if (tutorial) {
        this.setData({
          isEdit: true,
          editId: options.id,
          form: {
            title: tutorial.title || '',
            category: tutorial.category || '',
            content: tutorial.content || '',
            tips: tutorial.tips || '',
            commonMistakes: tutorial.commonMistakes || '',
            summary: tutorial.summary || ''
          }
        });
        wx.setNavigationBarTitle({ title: '编辑教程' });
      }
    }
  },

  onInput: function(e) {
    var obj = {};
    obj['form.' + e.currentTarget.dataset.field] = e.detail.value;
    this.setData(obj);
  },

  onCategoryPick: function(e) {
    this.setData({ 'form.category': this.data.categoryOptions[e.detail.value] });
  },

  handleSubmit: function() {
    var form = this.data.form;
    if (!form.title.trim()) { util.showToast('请输入标题'); return; }
    if (!form.category) { util.showToast('请选择分类'); return; }
    if (!form.content.trim()) { util.showToast('请输入内容'); return; }

    if (this.data.isEdit) {
      storage.update(storage.KEYS.TUTORIALS, this.data.editId, form);
      util.showToast('修改成功', 'success');
    } else {
      var item = Object.assign({}, form, {
        id: util.generateId('tu'),
        createdBy: 'admin'
      });
      storage.add(storage.KEYS.TUTORIALS, item);
      util.showToast('新增成功', 'success');
    }
    setTimeout(function() { wx.navigateBack(); }, 1500);
  }
});
