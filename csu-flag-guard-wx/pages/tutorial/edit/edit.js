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
    categoryOptions: storage.TUTORIAL_CATEGORY_OPTIONS || []
  },

  onLoad: async function(options) {
    if (!options.id) return;

    try {
      var tutorial = await storage.getById(storage.KEYS.TUTORIALS, options.id);
      if (!tutorial) return;

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
    } catch (err) {
      console.error(err);
      util.showToast('加载教程失败');
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

  handleSubmit: async function() {
    var form = this.data.form;
    if (!form.title.trim()) { util.showToast('请输入标题'); return; }
    if (!form.category) { util.showToast('请选择分类'); return; }
    if (!form.content.trim()) { util.showToast('请输入内容'); return; }

    try {
      if (this.data.isEdit) {
        await storage.update(storage.KEYS.TUTORIALS, this.data.editId, form);
        util.showToast('修改成功', 'success');
      } else {
        var item = Object.assign({}, form, {
          id: util.generateId('tu'),
          createdBy: 'admin'
        });
        await storage.add(storage.KEYS.TUTORIALS, item);
        util.showToast('新增成功', 'success');
      }

      setTimeout(function() {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error(err);
      util.showToast('保存失败');
    }
  }
});
