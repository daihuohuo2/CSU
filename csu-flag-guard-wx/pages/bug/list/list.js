var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var bugReportHelper = require('../../../utils/bug-report');
var OFFICE_DIRECTOR_LABEL = '\u529e\u516c\u5ba4\u4e3b\u4efb';
var BUG_SUMMARY_FORBIDDEN_TEXT = '\u4ec5\u529e\u516c\u5ba4\u4e3b\u4efb\u53ef\u67e5\u770bBUG\u6c47\u603b';
var LOAD_FAILED_TEXT = '\u52a0\u8f7dBUG\u6c47\u603b\u5931\u8d25';

function hasOfficeDirectorRole(memberInfo) {
  if (!memberInfo) {
    return false;
  }

  var positions = [];
  if (typeof storage.normalizePositions === 'function') {
    positions = storage.normalizePositions(memberInfo.position);
  } else if (Array.isArray(memberInfo.position)) {
    positions = memberInfo.position.slice();
  } else if (memberInfo.position) {
    positions = [memberInfo.position];
  }

  if (positions.indexOf(OFFICE_DIRECTOR_LABEL) !== -1) {
    return true;
  }

  return String(memberInfo.positionText || '').indexOf(OFFICE_DIRECTOR_LABEL) !== -1;
}

Page({
  data: {
    isLoading: true,
    reports: [],
    memberInfo: null
  },

  onShow: async function() {
    var userInfo = storage.getUserInfo();
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    try {
      var memberInfo = storage.enrichMember(await storage.getCurrentMember());
      if (!hasOfficeDirectorRole(memberInfo)) {
        util.showToast(BUG_SUMMARY_FORBIDDEN_TEXT);
        setTimeout(function() {
          wx.navigateBack({
            fail: function() {
              wx.reLaunch({ url: '/pages/mine/mine' });
            }
          });
        }, 1200);
        return;
      }

      this.setData({
        memberInfo: memberInfo
      });

      await this.loadReports();
    } catch (err) {
      console.error(err);
      this.setData({
        isLoading: false
      });
      util.showToast(LOAD_FAILED_TEXT);
    }
  },

  onPullDownRefresh: async function() {
    try {
      await this.loadReports();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  loadReports: async function() {
    this.setData({
      isLoading: true
    });

    try {
      var reports = await bugReportHelper.getAllReports();
      this.setData({
        reports: reports,
        isLoading: false
      });
    } catch (err) {
      console.error(err);
      this.setData({
        isLoading: false
      });
      util.showToast(LOAD_FAILED_TEXT);
    }
  }
});
