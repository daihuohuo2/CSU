var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var chronicleHelper = require('../../../utils/chronicle');

var IMPORT_BATCH_SIZE = 10;
var GRID_PAGE_SIZE = 8;

function chooseMessageFile() {
  return new Promise(function(resolve, reject) {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls'],
      success: resolve,
      fail: reject
    });
  });
}

Page({
  data: {
    gradeYear: '',
    gradeLabel: '',
    allEntries: [],
    pageEntries: [],
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    isAdmin: false,
    isLoading: true,
    isImporting: false,
    progressText: ''
  },

  onLoad: function(options) {
    var gradeYear = chronicleHelper.normalizeText(options.year);
    var gradeLabel = gradeYear ? gradeYear + '级' : '';

    this.setData({
      gradeYear: gradeYear,
      gradeLabel: gradeLabel,
      isAdmin: storage.isAdmin()
    });

    if (gradeLabel) {
      wx.setNavigationBarTitle({
        title: gradeLabel + '人物志'
      });
    }
  },

  onShow: async function() {
    if (!this.data.isAdmin) {
      util.showToast('仅管理员可查看人物志');
      setTimeout(function() {
        wx.navigateBack();
      }, 1200);
      return;
    }

    await this.loadData();
  },

  onPullDownRefresh: async function() {
    await this.loadData();
    wx.stopPullDownRefresh();
  },

  buildDisplayEntries: async function(entries) {
    var resolvedEntries = await chronicleHelper.resolveChronicleEntries(entries || [], {
      resolveImages: false
    });
    return resolvedEntries.map(function(item, index) {
      return Object.assign({}, item, {
        displayIndex: index + 1
      });
    });
  },

  applyPagination: function(page) {
    var paged = chronicleHelper.buildPagedEntries(this.data.allEntries, page, GRID_PAGE_SIZE);
    this.setData({
      currentPage: paged.currentPage,
      totalPages: paged.totalPages,
      pageEntries: paged.pageEntries
    });
  },

  loadData: async function() {
    if (!this.data.gradeYear) {
      util.showToast('缺少年级参数');
      return;
    }

    this.setData({ isLoading: true });

    try {
      var entries = await chronicleHelper.fetchChroniclesByGrade(this.data.gradeYear);
      var displayEntries = await this.buildDisplayEntries(entries);
      this.setData({
        allEntries: displayEntries,
        totalCount: displayEntries.length,
        isLoading: false
      });
      this.applyPagination(this.data.currentPage);
    } catch (err) {
      console.error(err);
      this.setData({
        allEntries: [],
        pageEntries: [],
        totalCount: 0,
        currentPage: 1,
        totalPages: 1,
        isLoading: false
      });
      util.showToast('加载人物志失败');
    }
  },

  prevPage: function() {
    if (this.data.currentPage <= 1) {
      return;
    }
    this.applyPagination(this.data.currentPage - 1);
  },

  nextPage: function() {
    if (this.data.currentPage >= this.data.totalPages) {
      return;
    }
    this.applyPagination(this.data.currentPage + 1);
  },

  goAdd: function() {
    wx.navigateTo({
      url: '/pages/chronicle/edit/edit?year=' + this.data.gradeYear
    });
  },

  goDetail: function(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }

    wx.navigateTo({
      url: '/pages/chronicle/detail/detail?id=' + id + '&year=' + this.data.gradeYear
    });
  },

  getCloudPath: function(fileName) {
    var safeName = (fileName || 'chronicles.xlsx').replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
    return 'chronicle-imports/' + this.data.gradeYear + '-' + Date.now() + '-' + safeName;
  },

  cleanupUploadedFile: async function(fileID) {
    if (!fileID) {
      return;
    }

    try {
      await wx.cloud.deleteFile({ fileList: [fileID] });
    } catch (err) {
      console.error('delete chronicle import file failed', err);
    }
  },

  callImportBatch: async function(fileID, offset) {
    var res = await wx.cloud.callFunction({
      name: 'chronicleImport',
      data: {
        fileID: fileID,
        gradeYear: this.data.gradeYear,
        offset: offset,
        batchSize: IMPORT_BATCH_SIZE
      }
    });

    return res.result || {};
  },

  runBatchImport: async function(fileID) {
    var summary = {
      imported: 0,
      totalRows: 0
    };
    var offset = 0;

    while (true) {
      var displayStart = offset + 1;
      var displayEnd = offset + IMPORT_BATCH_SIZE;
      this.setData({
        progressText: '正在导入第 ' + displayStart + ' - ' + displayEnd + ' 条人物志...'
      });

      var batchResult = await this.callImportBatch(fileID, offset);
      if (!batchResult.success) {
        throw new Error(batchResult.message || '导入失败');
      }

      summary.imported += batchResult.imported || 0;
      summary.totalRows = typeof batchResult.totalRows === 'number' ? batchResult.totalRows : summary.totalRows;

      if (!batchResult.hasMore) {
        break;
      }

      offset = batchResult.nextOffset || 0;
    }

    return summary;
  },

  handleImport: async function() {
    if (this.data.isImporting) {
      return;
    }

    var fileID = '';
    try {
      var fileRes = await chooseMessageFile();
      var file = (fileRes.tempFiles && fileRes.tempFiles[0]) || {};
      var filePath = file.path || file.tempFilePath || '';
      if (!filePath) {
        util.showToast('未获取到文件路径');
        return;
      }

      this.setData({
        isImporting: true,
        progressText: '正在上传 Excel 文件...'
      });

      var uploadRes = await wx.cloud.uploadFile({
        cloudPath: this.getCloudPath(file.name),
        filePath: filePath
      });
      fileID = uploadRes.fileID;

      var result = await this.runBatchImport(fileID);
      await this.cleanupUploadedFile(fileID);
      fileID = '';

      this.setData({
        isImporting: false,
        progressText: ''
      });

      await this.loadData();

      wx.showModal({
        title: '导入完成',
        content: '成功导入 ' + result.imported + ' 条人物志',
        showCancel: false
      });
    } catch (err) {
      if (err && err.errMsg && err.errMsg.indexOf('cancel') !== -1) {
        this.setData({
          isImporting: false,
          progressText: ''
        });
        return;
      }

      console.error(err);
      await this.cleanupUploadedFile(fileID);
      this.setData({
        isImporting: false,
        progressText: ''
      });
      util.showToast(err.message || '导入人物志失败');
    }
  }
});
