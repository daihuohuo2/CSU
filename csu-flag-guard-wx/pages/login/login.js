var storage = require('../../utils/storage');
var util = require('../../utils/util');

Page({
  data: {
    studentId: '',
    password: '',
    passwordVisible: false
  },

  onStudentIdInput: function (e) {
    this.setData({ studentId: e.detail.value });
  },

  onPasswordInput: function (e) {
    this.setData({ password: e.detail.value });
  },

  togglePasswordVisible: function () {
    this.setData({ passwordVisible: !this.data.passwordVisible });
  },

  handleLogin: async function () {
    var studentId = this.data.studentId.trim();
    var password = this.data.password;
    if (!studentId) {
      util.showToast('请输入学号');
      return;
    }
    if (!password) {
      util.showToast('请输入密码');
      return;
    }

    try {
      var userInfo = await storage.loginByCredentials(studentId, password);
      if (!userInfo) {
        util.showToast('学号或密码错误');
        return;
      }
      storage.setUserInfo(userInfo);
      util.showToast('登录成功', 'success');
      setTimeout(function () {
        wx.reLaunch({ url: '/pages/index/index' });
      }, 1500);
    } catch (err) {
      console.error(err);
      util.showToast('登录失败，请检查云开发配置');
    }
  }
});
