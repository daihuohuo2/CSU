var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var bugReportHelper = require('../../../utils/bug-report');
var LOGIN_REQUIRED_TEXT = '\u8bf7\u5148\u767b\u5f55';
var TITLE_REQUIRED_TEXT = '\u8bf7\u8f93\u5165BUG\u6807\u9898';
var CONTENT_REQUIRED_TEXT = '\u8bf7\u8f93\u5165BUG\u63cf\u8ff0';
var SUBMIT_SUCCESS_TEXT = 'BUG\u5df2\u63d0\u4ea4';
var SUBMIT_FAILED_TEXT = 'BUG\u63d0\u4ea4\u5931\u8d25';

Page({
  data: {
    userInfo: null,
    memberInfo: null,
    title: '',
    content: '',
    isSubmitting: false
  },

  onShow: async function() {
    var userInfo = storage.getUserInfo();
    if (!userInfo) {
      util.showToast(LOGIN_REQUIRED_TEXT);
      setTimeout(function() {
        wx.reLaunch({ url: '/pages/login/login' });
      }, 1000);
      return;
    }

    this.setData({
      userInfo: userInfo
    });

    try {
      var memberInfo = storage.enrichMember(await storage.getCurrentMember());
      this.setData({
        memberInfo: memberInfo
      });
    } catch (err) {
      console.error(err);
    }
  },

  onTitleInput: function(e) {
    this.setData({
      title: e.detail.value
    });
  },

  onContentInput: function(e) {
    this.setData({
      content: e.detail.value
    });
  },

  submitReport: async function() {
    if (this.data.isSubmitting) {
      return;
    }

    var title = bugReportHelper.normalizeText(this.data.title);
    var content = bugReportHelper.normalizeText(this.data.content);

    if (!title) {
      util.showToast(TITLE_REQUIRED_TEXT);
      return;
    }

    if (!content) {
      util.showToast(CONTENT_REQUIRED_TEXT);
      return;
    }

    var userInfo = this.data.userInfo || storage.getUserInfo();
    var memberInfo = this.data.memberInfo || null;

    this.setData({
      isSubmitting: true
    });

    try {
      await bugReportHelper.addReport({
        title: title,
        content: content,
        reporterName: memberInfo && memberInfo.name ? memberInfo.name : (userInfo ? userInfo.name : ''),
        reporterMemberId: memberInfo && memberInfo.id ? memberInfo.id : (userInfo ? userInfo.memberId : ''),
        reporterStudentId: memberInfo && memberInfo.studentId ? memberInfo.studentId : (userInfo ? userInfo.studentId : ''),
        reporterDepartment: memberInfo && memberInfo.department ? memberInfo.department : ''
      });

      util.showToast(SUBMIT_SUCCESS_TEXT, 'success');
      this.setData({
        isSubmitting: false,
        title: '',
        content: ''
      });

      setTimeout(function() {
        wx.navigateBack({
          fail: function() {
            wx.reLaunch({ url: '/pages/index/index' });
          }
        });
      }, 1200);
    } catch (err) {
      console.error(err);
      this.setData({
        isSubmitting: false
      });
      util.showToast(SUBMIT_FAILED_TEXT);
    }
  }
});
