var storage = require('../../../../../utils/storage');
var util = require('../../../../../utils/util');
var leaveApplicationHelper = require('../../../../../utils/leave-application');

function splitApplications(applications) {
  var pending = [];
  var approved = [];

  (applications || []).forEach(function(item) {
    if (item.status === leaveApplicationHelper.STATUS_APPROVED) {
      approved.push(item);
      return;
    }
    pending.push(item);
  });

  return {
    pending: pending,
    approved: approved
  };
}

Page({
  data: {
    isAdmin: false,
    isLoading: true,
    isApproving: false,
    pendingApplications: [],
    approvedApplications: []
  },

  onShow: async function() {
    if (!storage.isAdmin()) {
      util.showToast('\u4ec5\u7ba1\u7406\u5458\u53ef\u8bbf\u95ee');
      setTimeout(function() {
        wx.navigateBack({
          fail: function() {
            wx.reLaunch({ url: '/pages/index/index' });
          }
        });
      }, 1200);
      return;
    }

    this.setData({
      isAdmin: true
    });
    await this.loadData();
  },

  onPullDownRefresh: async function() {
    try {
      await this.loadData();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  loadData: async function() {
    this.setData({
      isLoading: true
    });

    try {
      var applications = await leaveApplicationHelper.getAllApplications();
      var grouped = splitApplications(applications);
      this.setData({
        pendingApplications: grouped.pending,
        approvedApplications: grouped.approved,
        isLoading: false
      });
    } catch (err) {
      console.error(err);
      this.setData({
        isLoading: false
      });
      util.showToast(err.message || '\u52a0\u8f7d\u8bf7\u5047\u5ba1\u6279\u5931\u8d25');
    }
  },

  previewProof: function(e) {
    var listType = e.currentTarget.dataset.listType;
    var index = Number(e.currentTarget.dataset.index);
    var proofIndex = Number(e.currentTarget.dataset.proofIndex);
    var sourceList = listType === 'approved' ? this.data.approvedApplications : this.data.pendingApplications;
    var application = sourceList[index];
    if (!application) {
      return;
    }

    var urls = (application.proofs || []).map(function(item) {
      return item.url || '';
    }).filter(Boolean);
    if (!urls.length || !urls[proofIndex]) {
      return;
    }

    wx.previewImage({
      current: urls[proofIndex],
      urls: urls
    });
  },

  approveApplication: function(e) {
    if (this.data.isApproving) {
      return;
    }

    var index = Number(e.currentTarget.dataset.index);
    var application = this.data.pendingApplications[index];
    if (!application) {
      util.showToast('\u672a\u627e\u5230\u5f85\u5ba1\u6279\u8bb0\u5f55');
      return;
    }

    var that = this;
    wx.showModal({
      title: '\u786e\u8ba4\u6279\u51c6',
      content: '\u786e\u5b9a\u6279\u51c6 ' + application.memberName + ' \u7684\u8bf7\u5047\u7533\u8bf7\u5417\uff1f',
      success: async function(res) {
        if (!res.confirm) {
          return;
        }

        that.setData({
          isApproving: true
        });

        try {
          var currentMember = storage.enrichMember(await storage.getCurrentMember());
          await leaveApplicationHelper.approveApplication({
            applicationId: application.id,
            docId: application._docId,
            approverName: currentMember ? currentMember.name : '',
            approverMemberId: currentMember ? currentMember.id : ''
          });
          util.showToast('\u8bf7\u5047\u5df2\u6279\u51c6', 'success');
          await that.loadData();
        } catch (err) {
          console.error(err);
          util.showToast(err.message || '\u6279\u51c6\u8bf7\u5047\u5931\u8d25');
        } finally {
          that.setData({
            isApproving: false
          });
        }
      }
    });
  }
});
