var storage = require('../../../../utils/storage');
var util = require('../../../../utils/util');
var officeMaterialHelper = require('../../../../utils/office-material');

var PAGE_SIZE = 20;

function chooseMaterialFile() {
  return new Promise(function(resolve, reject) {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: officeMaterialHelper.SUPPORTED_EXTENSIONS,
      success: resolve,
      fail: reject
    });
  });
}

function formatFileSize(size) {
  var value = Number(size || 0);
  if (!value) {
    return '0 B';
  }

  if (value < 1024) {
    return value + ' B';
  }

  if (value < 1024 * 1024) {
    return (value / 1024).toFixed(1) + ' KB';
  }

  return (value / (1024 * 1024)).toFixed(1) + ' MB';
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
        result = await storage.queryOfficeMaterialsPage({
          page: targetPage,
          pageSize: PAGE_SIZE
        });
      } catch (queryErr) {
        console.warn('listQuery officeMaterials unavailable, fallback to local query', queryErr);
        var allRecords = await officeMaterialHelper.getList();
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
      util.showToast('加载基础资料失败');
    }
  },

  openUploadPanel: function() {
    this.setData({
      showUploadPanel: true,
      selectedFile: null
    });
  },

  closeUploadPanel: function() {
    if (this.data.isSubmitting) {
      return;
    }

    this.setData({
      showUploadPanel: false,
      selectedFile: null
    });
  },

  noop: function() {},

  chooseFile: async function() {
    if (this.data.isSubmitting) {
      return;
    }

    try {
      var res = await chooseMaterialFile();
      var file = (res.tempFiles && res.tempFiles[0]) || {};
      var path = file.path || file.tempFilePath || '';
      var fileName = file.name || '';

      if (!path || !fileName) {
        util.showToast('未获取到文件');
        return;
      }

      this.setData({
        selectedFile: {
          name: fileName,
          path: path,
          size: Number(file.size || 0),
          displaySize: formatFileSize(file.size),
          tag: officeMaterialHelper.getFileTypeLabel(fileName),
          fileExt: officeMaterialHelper.getExtension(fileName)
        }
      });
    } catch (err) {
      if (err && err.errMsg && err.errMsg.indexOf('cancel') !== -1) {
        return;
      }

      console.error(err);
      util.showToast('选择文件失败');
    }
  },

  submitUpload: async function() {
    if (this.data.isSubmitting) {
      return;
    }

    var selectedFile = this.data.selectedFile;
    if (!selectedFile || !selectedFile.path || !selectedFile.name) {
      util.showToast('请先选择文件');
      return;
    }

    this.setData({ isSubmitting: true });
    var uploadedFileID = '';

    try {
      var uploadRes = await wx.cloud.uploadFile({
        cloudPath: officeMaterialHelper.buildCloudPath(selectedFile.name),
        filePath: selectedFile.path
      });
      uploadedFileID = uploadRes.fileID;

      var userInfo = storage.getUserInfo();
      await officeMaterialHelper.addRecord({
        id: util.generateId('material'),
        name: selectedFile.name,
        fileName: selectedFile.name,
        fileID: uploadedFileID,
        uploadedBy: userInfo ? userInfo.name : 'admin'
      });

      this.setData({
        isSubmitting: false,
        showUploadPanel: false,
        selectedFile: null
      });

      await this.loadData(true);
      util.showToast('基础资料上传成功', 'success');
    } catch (err) {
      console.error(err);
      if (uploadedFileID) {
        try {
          await wx.cloud.deleteFile({
            fileList: [uploadedFileID]
          });
        } catch (deleteErr) {
          console.error('cleanup office material file failed', deleteErr);
        }
      }
      this.setData({ isSubmitting: false });
      util.showToast('上传基础资料失败');
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
      var tempFilePath = await officeMaterialHelper.downloadFile(record.fileID);
      if (!tempFilePath) {
        throw new Error('下载文件失败');
      }

      wx.hideLoading();
      wx.openDocument({
        filePath: tempFilePath,
        fileType: officeMaterialHelper.getOpenFileType(record.fileName) || undefined,
        showMenu: true
      });
    } catch (err) {
      console.error(err);
      wx.hideLoading();
      util.showToast(err.message || '打开基础资料失败');
    }
  }
});
