var storage = require('../../../../utils/storage');
var util = require('../../../../utils/util');
var meetingRecordHelper = require('../../../../utils/meeting-record');

var DEPARTMENT_KEY = 'office';
var PAGE_SIZE = 20;

function choosePdfFile() {
  return new Promise(function(resolve, reject) {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf'],
      success: resolve,
      fail: reject
    });
  });
}

function formatRecords(records) {
  return (records || []).map(function(item) {
    var date = new Date(Number(item.createdAt || 0));
    return Object.assign({}, item, {
      displayCreatedAt: isNaN(date.getTime())
        ? '时间未知'
        : util.formatDate(date) + ' ' + util.formatTime(date)
    });
  });
}

Page({
  data: {
    isAdmin: false,
    isLoading: true,
    isSubmitting: false,
    isLoadingMore: false,
    records: [],
    page: 1,
    hasMore: false,
    showUploadPanel: false,
    draftName: '',
    selectedFile: null
  },

  onShow: async function() {
    if (!storage.isAdmin()) {
      util.showToast('仅管理员可访问');
      setTimeout(function() {
        wx.navigateBack({
          fail: function() {
            wx.reLaunch({ url: '/pages/index/index' });
          }
        });
      }, 1200);
      return;
    }

    this.setData({ isAdmin: true });
    await this.loadData(true);
  },

  onPullDownRefresh: async function() {
    try {
      await this.loadData(true);
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  onReachBottom: async function() {
    if (this.data.hasMore && !this.data.isLoadingMore && !this.data.isLoading) {
      await this.loadData(false);
    }
  },

  loadData: async function(reset) {
    var isReset = reset !== false;
    var targetPage = isReset ? 1 : (this.data.page + 1);

    this.setData(isReset ? {
      isLoading: true
    } : {
      isLoadingMore: true
    });

    try {
      var result = null;
      try {
        result = await storage.queryMeetingRecordsPage({
          departmentKey: DEPARTMENT_KEY,
          page: targetPage,
          pageSize: PAGE_SIZE
        });
      } catch (queryErr) {
        console.warn('listQuery meetingRecords unavailable, fallback to local query', queryErr);
        var allRecords = await meetingRecordHelper.getListByDepartment(DEPARTMENT_KEY);
        var start = (targetPage - 1) * PAGE_SIZE;
        var list = allRecords.slice(start, start + PAGE_SIZE);
        result = {
          list: list,
          page: targetPage,
          total: allRecords.length,
          hasMore: start + PAGE_SIZE < allRecords.length
        };
      }

      var nextRecords = formatRecords(result.list || []);
      this.setData({
        records: isReset ? nextRecords : this.data.records.concat(nextRecords),
        page: Number(result.page || targetPage),
        hasMore: !!result.hasMore,
        isLoading: false,
        isLoadingMore: false
      });
    } catch (err) {
      console.error(err);
      this.setData({
        isLoading: false,
        isLoadingMore: false
      });
      util.showToast('加载会议记录失败');
    }
  },

  openUploadPanel: function() {
    this.setData({
      showUploadPanel: true,
      draftName: '',
      selectedFile: null
    });
  },

  closeUploadPanel: function() {
    if (this.data.isSubmitting) {
      return;
    }

    this.setData({
      showUploadPanel: false,
      draftName: '',
      selectedFile: null
    });
  },

  noop: function() {},

  onNameInput: function(e) {
    this.setData({
      draftName: e.detail.value
    });
  },

  chooseFile: async function() {
    if (this.data.isSubmitting) {
      return;
    }

    try {
      var res = await choosePdfFile();
      var file = (res.tempFiles && res.tempFiles[0]) || {};
      var path = file.path || file.tempFilePath || '';
      if (!path) {
        util.showToast('未获取到 PDF 文件');
        return;
      }

      this.setData({
        selectedFile: {
          name: file.name || meetingRecordHelper.ensurePdfExtension(this.data.draftName || 'meeting_record'),
          path: path,
          size: Number(file.size || 0)
        }
      });
    } catch (err) {
      if (err && err.errMsg && err.errMsg.indexOf('cancel') !== -1) {
        return;
      }

      console.error(err);
      util.showToast('选择 PDF 失败');
    }
  },

  submitUpload: async function() {
    if (this.data.isSubmitting) {
      return;
    }

    var recordName = meetingRecordHelper.normalizeText(this.data.draftName);
    if (!recordName) {
      util.showToast('请输入文件命名');
      return;
    }

    var selectedFile = this.data.selectedFile;
    if (!selectedFile || !selectedFile.path) {
      util.showToast('请先选择 PDF 文件');
      return;
    }

    this.setData({ isSubmitting: true });
    var uploadedFileID = '';

    try {
      var uploadRes = await wx.cloud.uploadFile({
        cloudPath: meetingRecordHelper.buildCloudPath(DEPARTMENT_KEY, recordName, selectedFile.name),
        filePath: selectedFile.path
      });
      uploadedFileID = uploadRes.fileID;

      var userInfo = storage.getUserInfo();
      await meetingRecordHelper.addRecord({
        id: util.generateId('meeting'),
        departmentKey: DEPARTMENT_KEY,
        name: recordName,
        fileID: uploadedFileID,
        fileName: selectedFile.name,
        uploadedBy: userInfo ? userInfo.name : 'admin'
      });

      this.setData({
        isSubmitting: false,
        showUploadPanel: false,
        draftName: '',
        selectedFile: null
      });

      await this.loadData(true);
      util.showToast('会议记录上传成功', 'success');
    } catch (err) {
      console.error(err);
      if (uploadedFileID) {
        try {
          await wx.cloud.deleteFile({
            fileList: [uploadedFileID]
          });
        } catch (deleteErr) {
          console.error('cleanup meeting record file failed', deleteErr);
        }
      }
      this.setData({ isSubmitting: false });
      util.showToast('上传会议记录失败');
    }
  },

  openRecord: async function(e) {
    var index = Number(e.currentTarget.dataset.index);
    var record = this.data.records[index];

    if (!record || !record.fileID) {
      util.showToast('未找到对应文件');
      return;
    }

    wx.showLoading({
      title: '打开中...',
      mask: true
    });

    try {
      var tempFilePath = await meetingRecordHelper.downloadFile(record.fileID);
      if (!tempFilePath) {
        throw new Error('下载 PDF 失败');
      }

      wx.hideLoading();
      wx.openDocument({
        filePath: tempFilePath,
        fileType: 'pdf',
        showMenu: true
      });
    } catch (err) {
      console.error(err);
      wx.hideLoading();
      util.showToast(err.message || '打开会议记录失败');
    }
  }
});
