var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

Page({
  data: {
    isEdit: false,
    editId: '',
    isAdmin: false,
    canManageSpecialTutorials: false,
    canManageCurrent: false,
    categoryLocked: false,
    specialCategory: storage.SPECIAL_TUTORIAL_CATEGORY || '',
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
    var isAdmin = storage.isAdmin();
    var currentMember = await storage.getCurrentMember();
    var canManageSpecialTutorials = !!(currentMember && storage.hasSpecialPosition(currentMember.position));
    var specialCategory = storage.SPECIAL_TUTORIAL_CATEGORY || '';

    if (!isAdmin && !canManageSpecialTutorials) {
      util.showToast('当前无编辑教程权限');
      setTimeout(function() {
        wx.navigateBack({
          fail: function() {
            wx.reLaunch({ url: '/pages/tutorial/list/list' });
          }
        });
      }, 1200);
      return;
    }

    var categoryOptions = isAdmin ? (storage.TUTORIAL_CATEGORY_OPTIONS || []) : [specialCategory];
    var presetCategory = !isAdmin ? specialCategory : storage.normalizeTutorialCategory(options.category || '');
    var form = Object.assign({}, this.data.form, {
      category: presetCategory || this.data.form.category
    });

    this.setData({
      isAdmin: isAdmin,
      canManageSpecialTutorials: canManageSpecialTutorials,
      canManageCurrent: isAdmin || canManageSpecialTutorials,
      categoryLocked: !isAdmin,
      specialCategory: specialCategory,
      categoryOptions: categoryOptions,
      form: form
    });

    if (!options.id) {
      if (!isAdmin) {
        wx.setNavigationBarTitle({ title: '新增特殊岗教程' });
      }
      return;
    }

    try {
      var tutorial = await storage.getById(storage.KEYS.TUTORIALS, options.id);
      if (!tutorial) {
        util.showToast('未找到教程');
        return;
      }

      var canManageCurrent = !!(isAdmin || (currentMember && storage.canManageTutorial(currentMember.position, tutorial.category)));
      if (!canManageCurrent) {
        util.showToast('当前无编辑该教程权限');
        setTimeout(function() {
          wx.navigateBack();
        }, 1200);
        return;
      }

      this.setData({
        isEdit: true,
        editId: options.id,
        canManageCurrent: canManageCurrent,
        form: {
          title: tutorial.title || '',
          category: tutorial.category || specialCategory,
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
    if (this.data.categoryLocked) {
      return;
    }

    this.setData({
      'form.category': this.data.categoryOptions[e.detail.value]
    });
  },

  handleSubmit: async function() {
    var form = Object.assign({}, this.data.form);

    if (!this.data.isAdmin && !this.data.canManageSpecialTutorials) {
      util.showToast('当前无保存教程权限');
      return;
    }

    if (!this.data.isAdmin) {
      form.category = this.data.specialCategory;
    }

    if (!form.title.trim()) {
      util.showToast('请输入标题');
      return;
    }
    if (!form.category) {
      util.showToast('请选择分类');
      return;
    }
    if (!form.content.trim()) {
      util.showToast('请输入内容');
      return;
    }

    if (!this.data.isAdmin && form.category !== this.data.specialCategory) {
      util.showToast('特殊岗成员仅可维护特殊岗动作');
      return;
    }

    try {
      if (this.data.isEdit) {
        if (!this.data.canManageCurrent) {
          util.showToast('当前无修改该教程权限');
          return;
        }

        await storage.update(storage.KEYS.TUTORIALS, this.data.editId, form);
        util.showToast('修改成功', 'success');
      } else {
        var userInfo = storage.getUserInfo();
        var item = Object.assign({}, form, {
          id: util.generateId('tu'),
          createdBy: userInfo ? userInfo.name : ''
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
