var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var chronicleHelper = require('../../../utils/chronicle');

Page({
  data: {
    gradeYear: '',
    gradeLabel: '',
    content: '',
    isAdmin: false,
    isSubmitting: false
  },

  onLoad: function(options) {
    var gradeYear = chronicleHelper.normalizeText(options.year);
    var gradeLabel = gradeYear ? gradeYear + '级' : '';
    var isAdmin = storage.isAdmin();

    this.setData({
      gradeYear: gradeYear,
      gradeLabel: gradeLabel,
      isAdmin: isAdmin
    });

    if (gradeLabel) {
      wx.setNavigationBarTitle({
        title: '新增' + gradeLabel + '人物志'
      });
    }

    if (!isAdmin) {
      util.showToast('仅管理员可新增人物志');
      setTimeout(function() {
        wx.navigateBack();
      }, 1200);
    }
  },

  onInput: function(e) {
    this.setData({
      content: e.detail.value
    });
  },

  handleSubmit: async function() {
    if (this.data.isSubmitting) {
      return;
    }
    if (!this.data.gradeYear) {
      util.showToast('缺少年级参数');
      return;
    }
    if (!chronicleHelper.normalizeText(this.data.content)) {
      util.showToast('请输入人物志内容');
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      var now = Date.now();
      await chronicleHelper.getCollection().add({
        data: {
          id: util.generateId('c'),
          gradeYear: this.data.gradeYear,
          gradeLabel: this.data.gradeLabel,
          content: chronicleHelper.normalizeText(this.data.content),
          createdAt: now,
          updatedAt: now,
          sortOrder: now * 1000
        }
      });

      util.showToast('新增成功', 'success');
      setTimeout(function() {
        wx.navigateBack();
      }, 1200);
    } catch (err) {
      console.error(err);
      util.showToast('新增人物志失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
