var util = require('../../../utils/util');
var IMPORT_BATCH_SIZE = 5;

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
    fileName: '',
    filePath: '',
    joinDate: '',
    isImporting: false,
    progressText: ''
  },

  chooseExcelFile: async function() {
    try {
      var res = await chooseMessageFile();
      var file = (res.tempFiles && res.tempFiles[0]) || {};
      var filePath = file.path || file.tempFilePath || '';

      if (!filePath) {
        util.showToast('未获取到文件路径');
        return;
      }

      this.setData({
        fileName: file.name || '未命名文件',
        filePath: filePath
      });
    } catch (err) {
      if (err && err.errMsg && err.errMsg.indexOf('cancel') !== -1) {
        return;
      }
      console.error(err);
      util.showToast('选择文件失败');
    }
  },

  onJoinDatePick: function(e) {
    this.setData({ joinDate: e.detail.value });
  },

  getCloudPath: function(fileName) {
    var safeName = (fileName || 'members.xlsx').replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
    return 'member-imports/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safeName;
  },

  cleanupUploadedFile: async function(fileID) {
    if (!fileID) return;

    try {
      await wx.cloud.deleteFile({ fileList: [fileID] });
    } catch (err) {
      console.error('delete uploaded import file failed', err);
    }
  },

  buildResultMessage: function(result) {
    var lines = ['成功导入 ' + (result.imported || 0) + ' 名成员'];

    if (typeof result.skipped === 'number') {
      lines.push('跳过 ' + result.skipped + ' 条记录');
    }

    if (result.skippedRows && result.skippedRows.length) {
      var details = result.skippedRows.slice(0, 3).map(function(item) {
        return '第' + item.rowNumber + '行：' + item.reason;
      });
      lines.push(details.join('\n'));
    }

    return lines.join('\n');
  },

  mergeBatchResult: function(summary, batchResult) {
    summary.imported += batchResult.imported || 0;
    summary.skipped += batchResult.skipped || 0;

    if (batchResult.skippedRows && batchResult.skippedRows.length) {
      summary.skippedRows = summary.skippedRows.concat(batchResult.skippedRows).slice(0, 10);
    }

    if (typeof batchResult.totalRows === 'number') {
      summary.totalRows = batchResult.totalRows;
    }

    return summary;
  },

  callImportBatch: async function(fileID, offset) {
    var callRes = await wx.cloud.callFunction({
      name: 'memberImport',
      data: {
        fileID: fileID,
        joinDate: this.data.joinDate,
        offset: offset,
        batchSize: IMPORT_BATCH_SIZE
      }
    });

    return callRes.result || {};
  },

  runBatchImport: async function(fileID) {
    var offset = 0;
    var summary = {
      imported: 0,
      skipped: 0,
      skippedRows: [],
      totalRows: 0
    };

    while (true) {
      var displayStart = offset + 1;
      var displayEnd = offset + IMPORT_BATCH_SIZE;
      this.setData({
        progressText: '正在导入第 ' + displayStart + ' - ' + displayEnd + ' 行...'
      });

      var batchResult = await this.callImportBatch(fileID, offset);
      if (!batchResult.success) {
        throw new Error(batchResult.message || '导入失败');
      }

      this.mergeBatchResult(summary, batchResult);

      if (!batchResult.hasMore) {
        break;
      }

      offset = batchResult.nextOffset || 0;
    }

    return summary;
  },

  finishAfterImport: function() {
    var pages = getCurrentPages();
    if (pages.length >= 3) {
      wx.navigateBack({ delta: 2 });
      return;
    }
    wx.redirectTo({ url: '/pages/member/list/list' });
  },

  handleImport: async function() {
    if (!this.data.filePath) {
      util.showToast('请先选择Excel文件');
      return;
    }
    if (!this.data.joinDate) {
      util.showToast('请选择统一入队时间');
      return;
    }

    var fileID = '';
    this.setData({
      isImporting: true,
      progressText: '准备上传文件...'
    });

    try {
      var uploadRes = await wx.cloud.uploadFile({
        cloudPath: this.getCloudPath(this.data.fileName),
        filePath: this.data.filePath
      });
      fileID = uploadRes.fileID;
      var result = await this.runBatchImport(fileID);

      var content = this.buildResultMessage(result);
      var that = this;

      await this.cleanupUploadedFile(fileID);
      fileID = '';

      wx.showModal({
        title: '导入完成',
        content: content,
        showCancel: false,
        success: function() {
          that.finishAfterImport();
        }
      });
    } catch (err) {
      console.error(err);
      util.showToast(err.message || '导入失败');
      await this.cleanupUploadedFile(fileID);
    } finally {
      this.setData({
        isImporting: false,
        progressText: ''
      });
    }
  }
});
