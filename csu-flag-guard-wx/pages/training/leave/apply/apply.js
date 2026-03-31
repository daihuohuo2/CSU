var storage = require('../../../../utils/storage');
var util = require('../../../../utils/util');
var makeupHelper = require('../../../../utils/makeup');
var leaveApplicationHelper = require('../../../../utils/leave-application');

var MAX_PROOF_COUNT = 3;
var MAKEUP_TYPE = '\u8865\u8bad';
var STATUS_APPROVED = '\u5df2\u901a\u8fc7';

function chooseProofImages(count) {
  return new Promise(function(resolve, reject) {
    wx.chooseImage({
      count: count,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: resolve,
      fail: reject
    });
  });
}

Page({
  data: {
    id: '',
    training: null,
    memberInfo: null,
    application: null,
    reason: '',
    proofs: [],
    isLoading: true,
    isSubmitting: false
  },

  onLoad: function(options) {
    this.setData({
      id: options && options.id ? String(options.id) : ''
    });
  },

  onShow: async function() {
    await this.loadData();
  },

  loadData: async function() {
    if (!this.data.id) {
      util.showToast('\u7f3a\u5c11\u8bad\u7ec3\u53c2\u6570');
      return;
    }

    this.setData({
      isLoading: true
    });

    try {
      var result = await Promise.all([
        storage.getById(storage.KEYS.TRAININGS, this.data.id),
        storage.getCurrentMember()
      ]);
      var training = result[0];
      var memberInfo = storage.enrichMember(result[1]);

      if (!training) {
        throw new Error('\u672a\u627e\u5230\u5bf9\u5e94\u8bad\u7ec3\u65e5\u7a0b');
      }
      if (!memberInfo) {
        throw new Error('\u672a\u627e\u5230\u5f53\u524d\u6210\u5458\u6863\u6848');
      }
      if (training.type === MAKEUP_TYPE) {
        throw new Error('\u8865\u8bad\u65e5\u7a0b\u6682\u4e0d\u5f00\u653e\u8bf7\u5047\u7533\u8bf7');
      }
      if (!training.date || training.date < makeupHelper.getToday()) {
        throw new Error('\u53ea\u80fd\u5bf9\u672a\u8fdb\u884c\u7684\u8bad\u7ec3\u65e5\u7a0b\u63d0\u4ea4\u8bf7\u5047\u7533\u8bf7');
      }

      var hasAttendance = (training.attendance || []).some(function(item) {
        return item && item.memberId === memberInfo.id;
      });
      if (!hasAttendance) {
        throw new Error('\u4f60\u4e0d\u5728\u8be5\u8bad\u7ec3\u65e5\u7a0b\u53c2\u4e0e\u540d\u5355\u4e2d');
      }

      var application = await leaveApplicationHelper.getMemberTrainingApplication(training.id, memberInfo.id);
      this.setData({
        training: training,
        memberInfo: memberInfo,
        application: application,
        reason: application ? application.reason : '',
        proofs: application ? (application.proofs || []) : [],
        isLoading: false
      });
    } catch (err) {
      console.error(err);
      this.setData({
        isLoading: false
      });
      util.showToast(err.message || '\u52a0\u8f7d\u8bf7\u5047\u7533\u8bf7\u5931\u8d25');
      setTimeout(function() {
        wx.navigateBack({
          fail: function() {
            wx.reLaunch({ url: '/pages/training/list/list' });
          }
        });
      }, 1200);
    }
  },

  onReasonInput: function(e) {
    this.setData({
      reason: e.detail.value
    });
  },

  chooseProofs: async function() {
    if (this.data.isSubmitting) {
      return;
    }

    var remainCount = MAX_PROOF_COUNT - (this.data.proofs || []).length;
    if (remainCount <= 0) {
      util.showToast('\u6700\u591a\u53ea\u80fd\u4e0a\u4f203\u5f20\u56fe\u7247');
      return;
    }

    try {
      var res = await chooseProofImages(remainCount);
      var tempFiles = res.tempFiles || [];
      var tempFilePaths = res.tempFilePaths || [];
      var nextProofs = (this.data.proofs || []).slice();

      tempFiles.forEach(function(file, index) {
        var localPath = file.path || file.tempFilePath || tempFilePaths[index] || '';
        if (!localPath) {
          return;
        }
        nextProofs.push({
          fileID: '',
          fileName: file.name || ('proof_' + Date.now() + '_' + index + '.jpg'),
          url: localPath,
          tempFilePath: localPath,
          isNew: true
        });
      });

      if (!tempFiles.length && tempFilePaths.length) {
        tempFilePaths.forEach(function(localPath, index) {
          if (!localPath) {
            return;
          }
          nextProofs.push({
            fileID: '',
            fileName: 'proof_' + Date.now() + '_' + index + '.jpg',
            url: localPath,
            tempFilePath: localPath,
            isNew: true
          });
        });
      }

      this.setData({
        proofs: nextProofs.slice(0, MAX_PROOF_COUNT)
      });
    } catch (err) {
      if (err && err.errMsg && err.errMsg.indexOf('cancel') !== -1) {
        return;
      }
      console.error(err);
      util.showToast('\u9009\u62e9\u8bc1\u660e\u56fe\u7247\u5931\u8d25');
    }
  },

  removeProof: function(e) {
    if (this.data.isSubmitting) {
      return;
    }

    var index = Number(e.currentTarget.dataset.index);
    var proofs = (this.data.proofs || []).slice();
    proofs.splice(index, 1);
    this.setData({
      proofs: proofs
    });
  },

  previewProof: function(e) {
    var index = Number(e.currentTarget.dataset.index);
    var proofs = this.data.proofs || [];
    var urls = proofs.map(function(item) {
      return item.url || item.tempFilePath || '';
    }).filter(Boolean);
    if (!urls.length || !urls[index]) {
      return;
    }

    wx.previewImage({
      current: urls[index],
      urls: urls
    });
  },

  submitApplication: async function() {
    if (this.data.isSubmitting) {
      return;
    }

    if (this.data.application && this.data.application.status === STATUS_APPROVED) {
      util.showToast('\u8be5\u8bf7\u5047\u7533\u8bf7\u5df2\u901a\u8fc7');
      return;
    }

    var reason = leaveApplicationHelper.normalizeText(this.data.reason);
    if (!reason) {
      util.showToast('\u8bf7\u586b\u5199\u8bf7\u5047\u7406\u7531');
      return;
    }

    var training = this.data.training;
    var memberInfo = this.data.memberInfo;
    var proofs = this.data.proofs || [];
    var uploadedFileIDs = [];
    var existingFileIDs = (this.data.application && this.data.application.proofs || []).map(function(item) {
      return item.fileID;
    }).filter(Boolean);

    this.setData({
      isSubmitting: true
    });

    try {
      var finalProofs = [];
      for (var i = 0; i < proofs.length; i++) {
        var item = proofs[i] || {};
        if (item.fileID && !item.isNew) {
          finalProofs.push({
            fileID: item.fileID,
            fileName: item.fileName
          });
          continue;
        }

        var uploadRes = await wx.cloud.uploadFile({
          cloudPath: leaveApplicationHelper.buildProofCloudPath(training.id, memberInfo.id, item.fileName, i),
          filePath: item.tempFilePath || item.url
        });
        uploadedFileIDs.push(uploadRes.fileID);
        finalProofs.push({
          fileID: uploadRes.fileID,
          fileName: item.fileName
        });
      }

      await leaveApplicationHelper.submitApplication({
        trainingId: training.id,
        memberId: memberInfo.id,
        reason: reason,
        proofs: finalProofs
      });

      var finalFileIDs = finalProofs.map(function(item) {
        return item.fileID;
      });
      var deleteFileIDs = existingFileIDs.filter(function(fileID) {
        return finalFileIDs.indexOf(fileID) === -1;
      });

      if (deleteFileIDs.length) {
        try {
          await wx.cloud.deleteFile({
            fileList: deleteFileIDs
          });
        } catch (deleteErr) {
          console.error('cleanup removed leave proof files failed', deleteErr);
        }
      }

      util.showToast('\u8bf7\u5047\u7533\u8bf7\u5df2\u63d0\u4ea4', 'success');
      await this.loadData();
    } catch (err) {
      console.error(err);
      if (uploadedFileIDs.length) {
        try {
          await wx.cloud.deleteFile({
            fileList: uploadedFileIDs
          });
        } catch (deleteErr) {
          console.error('cleanup uploaded leave proof files failed', deleteErr);
        }
      }
      util.showToast(err.message || '\u63d0\u4ea4\u8bf7\u5047\u7533\u8bf7\u5931\u8d25');
    } finally {
      this.setData({
        isSubmitting: false
      });
    }
  }
});
