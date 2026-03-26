var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var chronicleHelper = require('../../../utils/chronicle');

function chooseImages(count) {
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
    gradeYear: '',
    gradeLabel: '',
    chronicleId: '',
    docId: '',
    content: '',
    images: [],
    maxImageCount: chronicleHelper.MAX_IMAGE_COUNT,
    isAdmin: false,
    isEdit: false,
    isLoading: false,
    isSubmitting: false,
    isUploading: false
  },

  sessionUploadFileIDs: [],
  removedFileIDs: [],
  hasSaved: false,

  onLoad: async function(options) {
    var chronicleId = chronicleHelper.normalizeText(options.id) || util.generateId('c');
    var gradeYear = chronicleHelper.normalizeText(options.year);
    var gradeLabel = gradeYear ? gradeYear + '级' : '';
    var isAdmin = storage.isAdmin();

    this.setData({
      gradeYear: gradeYear,
      gradeLabel: gradeLabel,
      chronicleId: chronicleId,
      isAdmin: isAdmin,
      isEdit: !!chronicleHelper.normalizeText(options.id)
    });

    if (!isAdmin) {
      util.showToast('仅管理员可编辑人物志');
      setTimeout(function() {
        wx.navigateBack();
      }, 1200);
      return;
    }

    if (this.data.isEdit) {
      await this.loadChronicle(chronicleId);
      return;
    }

    this.syncNavigationTitle();
  },

  onUnload: function() {
    if (this.hasSaved || !this.sessionUploadFileIDs.length) {
      return;
    }

    chronicleHelper.deleteCloudFiles(this.sessionUploadFileIDs).catch(function(err) {
      console.error('cleanup unsaved chronicle images failed', err);
    });
  },

  syncNavigationTitle: function() {
    var prefix = this.data.isEdit ? '编辑' : '新增';
    var suffix = this.data.gradeLabel ? this.data.gradeLabel + '人物志' : '人物志';
    wx.setNavigationBarTitle({
      title: prefix + suffix
    });
  },

  resequenceImages: function(images) {
    return (images || []).map(function(item, index) {
      return Object.assign({}, item, {
        sortOrder: index + 1
      });
    });
  },

  loadChronicle: async function(chronicleId) {
    this.setData({ isLoading: true });

    try {
      var entry = await chronicleHelper.fetchChronicleById(chronicleId);
      if (!entry) {
        util.showToast('未找到人物志');
        setTimeout(function() {
          wx.navigateBack();
        }, 1200);
        return;
      }

      var resolvedEntries = await chronicleHelper.resolveChronicleEntries([entry]);
      var chronicle = resolvedEntries[0] || chronicleHelper.enrichChronicle(entry);
      var gradeYear = chronicle.gradeYear || this.data.gradeYear;
      var gradeLabel = gradeYear ? gradeYear + '级' : '';

      this.setData({
        isLoading: false,
        isEdit: true,
        chronicleId: chronicle.id,
        docId: chronicle._docId || entry._docId || '',
        gradeYear: gradeYear,
        gradeLabel: gradeLabel,
        content: chronicle.content || '',
        images: this.resequenceImages((chronicle.images || []).map(function(image) {
          return Object.assign({}, image, {
            origin: 'existing'
          });
        }))
      });

      this.syncNavigationTitle();
    } catch (err) {
      console.error(err);
      this.setData({ isLoading: false });
      util.showToast('加载人物志失败');
    }
  },

  onInput: function(e) {
    this.setData({
      content: e.detail.value
    });
  },

  chooseImages: async function() {
    if (this.data.isUploading) {
      return;
    }

    var remaining = this.data.maxImageCount - this.data.images.length;
    if (remaining <= 0) {
      util.showToast('最多上传 9 张图片');
      return;
    }

    try {
      var res = await chooseImages(remaining);
      var files = res.tempFiles || (res.tempFilePaths || []).map(function(path) {
        return {
          path: path,
          tempFilePath: path
        };
      });
      if (!files.length) {
        return;
      }

      await this.uploadImages(files);
    } catch (err) {
      if (err && err.errMsg && err.errMsg.indexOf('cancel') !== -1) {
        return;
      }
      console.error(err);
      util.showToast('选择图片失败');
    }
  },

  uploadImages: async function(files) {
    this.setData({ isUploading: true });

    try {
      var images = this.data.images.slice();
      var uploadedCount = 0;

      for (var i = 0; i < files.length; i++) {
        var file = files[i] || {};
        var filePath = file.path || file.tempFilePath || '';
        if (!filePath) {
          continue;
        }

        var cloudPath = chronicleHelper.buildImageCloudPath(
          this.data.gradeYear,
          this.data.chronicleId,
          images.length,
          filePath
        );

        var uploadRes = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: filePath
        });

        this.sessionUploadFileIDs.push(uploadRes.fileID);
        images.push({
          imageId: util.generateId('img'),
          fileID: uploadRes.fileID,
          sortOrder: images.length + 1,
          caption: '',
          fileName: chronicleHelper.getFileBaseName(filePath),
          uploadedAt: Date.now(),
          tempFileURL: filePath,
          origin: 'session'
        });
        uploadedCount += 1;
      }

      this.setData({
        images: this.resequenceImages(images),
        isUploading: false
      });

      if (uploadedCount > 0) {
        util.showToast('已上传 ' + uploadedCount + ' 张', 'success');
      }
    } catch (err) {
      console.error(err);
      this.setData({ isUploading: false });
      util.showToast('图片上传失败');
    }
  },

  removeImage: async function(e) {
    var index = Number(e.currentTarget.dataset.index);
    var images = this.data.images.slice();
    var image = images[index];

    if (!image) {
      return;
    }

    try {
      if (image.origin === 'existing') {
        if (this.removedFileIDs.indexOf(image.fileID) === -1) {
          this.removedFileIDs.push(image.fileID);
        }
      } else if (image.fileID) {
        await chronicleHelper.deleteCloudFiles([image.fileID]);
        this.sessionUploadFileIDs = this.sessionUploadFileIDs.filter(function(fileID) {
          return fileID !== image.fileID;
        });
      }

      images.splice(index, 1);
      this.setData({
        images: this.resequenceImages(images)
      });
    } catch (err) {
      console.error(err);
      util.showToast('删除图片失败');
    }
  },

  previewImage: function(e) {
    var index = Number(e.currentTarget.dataset.index);
    var currentImage = this.data.images[index];
    var urls = this.data.images.map(function(item) {
      return item.tempFileURL;
    }).filter(Boolean);

    if (!currentImage || !currentImage.tempFileURL || !urls.length) {
      return;
    }

    wx.previewImage({
      current: currentImage.tempFileURL,
      urls: urls
    });
  },

  buildSubmitPayload: function(now) {
    var images = chronicleHelper.buildChronicleImagesForStorage(this.data.images);
    return {
      gradeYear: this.data.gradeYear,
      gradeLabel: this.data.gradeLabel,
      content: chronicleHelper.normalizeText(this.data.content),
      images: images,
      coverFileId: images.length ? images[0].fileID : '',
      updatedAt: now
    };
  },

  handleSubmit: async function() {
    if (this.data.isSubmitting || this.data.isUploading) {
      return;
    }
    if (!this.data.gradeYear) {
      util.showToast('缺少年级参数');
      return;
    }
    if (!chronicleHelper.normalizeText(this.data.content)) {
      util.showToast('请输入人物志内容');
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      var now = Date.now();
      var payload = this.buildSubmitPayload(now);

      if (this.data.isEdit) {
        await chronicleHelper.getCollection().doc(this.data.docId).update({
          data: payload
        });

        if (this.removedFileIDs.length) {
          await chronicleHelper.deleteCloudFiles(this.removedFileIDs);
        }
      } else {
        await chronicleHelper.getCollection().add({
          data: Object.assign({
            id: this.data.chronicleId,
            createdAt: now,
            sortOrder: now * 1000
          }, payload)
        });
      }

      this.hasSaved = true;
      this.removedFileIDs = [];
      this.sessionUploadFileIDs = [];

      util.showToast(this.data.isEdit ? '保存成功' : '新增成功', 'success');
      setTimeout(function() {
        wx.navigateBack();
      }, 1200);
    } catch (err) {
      console.error(err);
      util.showToast(this.data.isEdit ? '保存人物志失败' : '新增人物志失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
