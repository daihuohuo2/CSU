var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var chronicleHelper = require('../../../utils/chronicle');

var IMPORT_BATCH_SIZE = 1;
var GRID_PAGE_SIZE = 8;

function chooseImportFile(extensions) {
  return new Promise(function(resolve, reject) {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: extensions,
      success: resolve,
      fail: reject
    });
  });
}

function showImportGuide() {
  return new Promise(function(resolve) {
    wx.showModal({
      title: '导入说明',
      content: '请先准备两个文件：1. Excel 中 A 列为姓名，B 列为人物志正文；2. ZIP 图片包中建议按“姓名/图片文件”的文件夹结构整理，每人最多 9 张图，也支持扁平命名如“张三-1.jpg”。',
      confirmText: '继续导入',
      cancelText: '取消',
      success: function(res) {
        resolve(!!res.confirm);
      },
      fail: function() {
        resolve(false);
      }
    });
  });
}

Page({
  data: {
    gradeYear: '',
    gradeLabel: '',
    pageEntries: [],
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    isAdmin: false,
    isLoading: true,
    isImporting: false,
    isDeleting: false,
    isSelecting: false,
    selectedIds: [],
    progressText: ''
  },

  onLoad: function(options) {
    var gradeYear = chronicleHelper.normalizeText(options.year);
    var gradeLabel = gradeYear
      ? (/[级届]$/.test(gradeYear) ? gradeYear : gradeYear + '级')
      : '';

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
    await this.loadData(this.data.currentPage);
  },

  onPullDownRefresh: async function() {
    await this.loadData(this.data.currentPage);
    wx.stopPullDownRefresh();
  },

  buildDisplayEntries: async function(entries, page) {
    var resolvedEntries = await chronicleHelper.resolveChronicleEntries(entries || [], {
      resolveImages: false
    });
    var selectedIds = this.data.selectedIds || [];
    var startIndex = (Math.max(Number(page) || 1, 1) - 1) * GRID_PAGE_SIZE;

    return resolvedEntries.map(function(item, index) {
      return Object.assign({}, item, {
        displayIndex: startIndex + index + 1,
        selected: selectedIds.indexOf(item.id) !== -1
      });
    });
  },

  loadData: async function(page) {
    if (!this.data.gradeYear) {
      util.showToast('缺少年级参数');
      return;
    }

    this.setData({ isLoading: true });

    try {
      var targetPage = Math.max(Number(page || this.data.currentPage || 1), 1);
      var result = null;

      try {
        result = await storage.queryChroniclesPage({
          gradeYear: this.data.gradeYear,
          page: targetPage,
          pageSize: GRID_PAGE_SIZE
        });
      } catch (queryErr) {
        console.warn('listQuery chroniclesByGrade unavailable, fallback to local query', queryErr);
        var entries = await chronicleHelper.fetchChroniclesByGrade(this.data.gradeYear);
        var paged = chronicleHelper.buildPagedEntries(entries, targetPage, GRID_PAGE_SIZE);
        result = {
          list: paged.pageEntries,
          page: paged.currentPage,
          total: entries.length
        };
      }

      var safePage = Number(result.page || targetPage);
      var totalCount = Number(result.total || 0);
      var displayEntries = await this.buildDisplayEntries(result.list || [], safePage);
      var visibleSelectedIds = this.data.isSelecting
        ? displayEntries.filter(function(item) { return item.selected; }).map(function(item) { return item.id; })
        : [];

      this.setData({
        pageEntries: displayEntries,
        currentPage: safePage,
        totalPages: Math.max(Math.ceil(totalCount / GRID_PAGE_SIZE), 1),
        totalCount: totalCount,
        selectedIds: visibleSelectedIds,
        isLoading: false
      });
    } catch (err) {
      console.error(err);
      this.setData({
        pageEntries: [],
        totalCount: 0,
        currentPage: 1,
        totalPages: 1,
        selectedIds: [],
        isLoading: false
      });
      util.showToast(err.message || '加载人物志失败');
    }
  },

  prevPage: function() {
    if (this.data.currentPage <= 1) {
      return;
    }
    this.loadData(this.data.currentPage - 1);
  },

  nextPage: function() {
    if (this.data.currentPage >= this.data.totalPages) {
      return;
    }
    this.loadData(this.data.currentPage + 1);
  },

  goAdd: function() {
    if (!this.data.isAdmin) {
      util.showToast('仅管理员可新增人物志');
      return;
    }

    wx.navigateTo({
      url: '/pages/chronicle/edit/edit?year=' + this.data.gradeYear
    });
  },

  handleCardTap: function(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }

    if (this.data.isSelecting) {
      this.toggleSelectionById(id);
      return;
    }

    wx.navigateTo({
      url: '/pages/chronicle/detail/detail?id=' + id + '&year=' + this.data.gradeYear
    });
  },

  toggleSelectionMode: function() {
    if (!this.data.isAdmin || this.data.isDeleting || this.data.isImporting) {
      return;
    }

    var nextSelecting = !this.data.isSelecting;
    this.setData({
      isSelecting: nextSelecting,
      selectedIds: nextSelecting ? this.data.selectedIds : []
    });

    if (!nextSelecting) {
      this.syncEntrySelection([]);
    }
  },

  toggleSelectionById: function(id) {
    var selectedIds = (this.data.selectedIds || []).slice();
    var index = selectedIds.indexOf(id);

    if (index === -1) {
      selectedIds.push(id);
    } else {
      selectedIds.splice(index, 1);
    }

    this.setData({
      selectedIds: selectedIds
    });
    this.syncEntrySelection(selectedIds);
  },

  syncEntrySelection: function(selectedIds) {
    var selectedMap = {};
    (selectedIds || []).forEach(function(id) {
      selectedMap[id] = true;
    });

    this.setData({
      pageEntries: (this.data.pageEntries || []).map(function(item) {
        return Object.assign({}, item, {
          selected: !!selectedMap[item.id]
        });
      })
    });
  },

  collectChronicleFileIDs: function(entry) {
    var fileIDs = [];

    if (entry && entry.coverImage && entry.coverImage.fileID && fileIDs.indexOf(entry.coverImage.fileID) === -1) {
      fileIDs.push(entry.coverImage.fileID);
    }

    (entry && entry.images || []).forEach(function(image) {
      if (image && image.fileID && fileIDs.indexOf(image.fileID) === -1) {
        fileIDs.push(image.fileID);
      }
    });

    return fileIDs;
  },

  resolveChronicleDocId: async function(entry) {
    if (entry && entry._docId) {
      return entry._docId;
    }

    var res = await chronicleHelper.getCollection().where({
      id: entry.id
    }).limit(1).get();

    return res.data && res.data[0] ? res.data[0]._id : '';
  },

  handleBatchDelete: function() {
    if (!this.data.isAdmin || this.data.isDeleting) {
      return;
    }

    var selectedEntries = (this.data.pageEntries || []).filter(function(item) {
      return item.selected;
    });

    if (!selectedEntries.length) {
      util.showToast('请先选择人物志');
      return;
    }

    var that = this;
    wx.showModal({
      title: '确认删除',
      content: '确定删除已选中的 ' + selectedEntries.length + ' 则人物志吗？对应图片也会一并删除。',
      success: async function(res) {
        if (!res.confirm) {
          return;
        }

        that.setData({ isDeleting: true });

        try {
          var fileIDs = [];

          for (var i = 0; i < selectedEntries.length; i++) {
            var entry = selectedEntries[i];
            var docId = await that.resolveChronicleDocId(entry);
            if (!docId) {
              throw new Error('未找到人物志文档');
            }

            fileIDs = fileIDs.concat(that.collectChronicleFileIDs(entry));
            await chronicleHelper.getCollection().doc(docId).remove();
          }

          fileIDs = fileIDs.filter(function(fileID, index, list) {
            return !!fileID && list.indexOf(fileID) === index;
          });

          if (fileIDs.length) {
            await chronicleHelper.deleteCloudFiles(fileIDs);
          }

          var fallbackPage = that.data.currentPage;
          if (selectedEntries.length >= that.data.pageEntries.length && fallbackPage > 1) {
            fallbackPage -= 1;
          }

          that.setData({
            isDeleting: false,
            isSelecting: false,
            selectedIds: []
          });

          await that.loadData(fallbackPage);
          util.showToast('已删除', 'success');
        } catch (err) {
          console.error(err);
          that.setData({ isDeleting: false });
          util.showToast(err.message || '删除人物志失败');
        }
      }
    });
  },

  getCloudPath: function(kind, fileName) {
    var safeName = (fileName || 'chronicles').replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
    return 'chronicle-imports/' + this.data.gradeYear + '/' + kind + '/' + Date.now() + '-' + safeName;
  },

  cleanupUploadedFiles: async function(fileIDs) {
    var list = (fileIDs || []).filter(Boolean);
    if (!list.length) {
      return;
    }

    try {
      await wx.cloud.deleteFile({ fileList: list });
    } catch (err) {
      console.error('delete chronicle import file failed', err);
    }
  },

  callImportBatch: async function(excelFileID, zipFileID, offset) {
    var res = await wx.cloud.callFunction({
      name: 'chronicleImport',
      data: {
        excelFileID: excelFileID,
        zipFileID: zipFileID,
        gradeYear: this.data.gradeYear,
        offset: offset,
        batchSize: IMPORT_BATCH_SIZE
      }
    });

    return res.result || {};
  },

  runBatchImport: async function(excelFileID, zipFileID) {
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

      var batchResult = await this.callImportBatch(excelFileID, zipFileID, offset);
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
    if (!this.data.isAdmin) {
      util.showToast('仅管理员可导入人物志');
      return;
    }

    if (this.data.isImporting || this.data.isDeleting) {
      return;
    }

    var excelCloudID = '';
    var zipCloudID = '';
    try {
      var confirmed = await showImportGuide();
      if (!confirmed) {
        return;
      }

      var excelRes = await chooseImportFile(['xlsx', 'xls']);
      var excelFile = (excelRes.tempFiles && excelRes.tempFiles[0]) || {};
      var excelPath = excelFile.path || excelFile.tempFilePath || '';
      if (!excelPath) {
        util.showToast('未获取到 Excel 文件');
        return;
      }

      var zipRes = await chooseImportFile(['zip']);
      var zipFile = (zipRes.tempFiles && zipRes.tempFiles[0]) || {};
      var zipPath = zipFile.path || zipFile.tempFilePath || '';
      if (!zipPath) {
        util.showToast('未获取到 ZIP 文件');
        return;
      }

      this.setData({
        isImporting: true,
        progressText: '正在上传 Excel 文件...'
      });

      var excelUploadRes = await wx.cloud.uploadFile({
        cloudPath: this.getCloudPath('excel', excelFile.name || 'chronicles.xlsx'),
        filePath: excelPath
      });
      excelCloudID = excelUploadRes.fileID;

      this.setData({
        progressText: '正在上传 ZIP 图片包...'
      });

      var zipUploadRes = await wx.cloud.uploadFile({
        cloudPath: this.getCloudPath('zip', zipFile.name || 'chronicles.zip'),
        filePath: zipPath
      });
      zipCloudID = zipUploadRes.fileID;

      var result = await this.runBatchImport(excelCloudID, zipCloudID);
      await this.cleanupUploadedFiles([excelCloudID, zipCloudID]);
      excelCloudID = '';
      zipCloudID = '';

      this.setData({
        isImporting: false,
        progressText: ''
      });

      await this.loadData(1);

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
        await this.cleanupUploadedFiles([excelCloudID, zipCloudID]);
        return;
      }

      console.error(err);
      await this.cleanupUploadedFiles([excelCloudID, zipCloudID]);
      this.setData({
        isImporting: false,
        progressText: ''
      });
      util.showToast(err.message || '导入人物志失败');
    }
  }
});
