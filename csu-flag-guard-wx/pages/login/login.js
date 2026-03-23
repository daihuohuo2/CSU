var storage = require('../../utils/storage');
var util = require('../../utils/util');

Page({
  data: {
    name: '',
    role: 'member'
  },

  onNameInput: function(e) {
    this.setData({ name: e.detail.value });
  },

  selectRole: function(e) {
    this.setData({ role: e.currentTarget.dataset.role });
  },

  handleLogin: function() {
    var name = this.data.name.trim();
    if (!name) {
      util.showToast('请输入姓名');
      return;
    }

    var userInfo = {
      name: name,
      role: this.data.role
    };
    storage.setUserInfo(userInfo);
    util.showToast('登录成功', 'success');
    setTimeout(function() {
      wx.reLaunch({ url: '/pages/index/index' });
    }, 1500);
  }
});
