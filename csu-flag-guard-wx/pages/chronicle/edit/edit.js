var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var chronicleHelper = require('../../../utils/chronicle');

var MAX_GALLERY_IMAGE_COUNT = chronicleHelper.MAX_GALLERY_IMAGE_COUNT;

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
    personName: '',
    content: '',
    coverImage: null,
    images: [],
    maxImageCount: MAX_GALLERY_IMAGE_COUNT,
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
    var name = chronicleHelper.normalizeText(this.data.personName);
    var suffix = name || (this.data.gradeLabel ? this.data.gradeLabel + '人物志' : '人物志');
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

  trackSessionFile: function(fileID) {
    if (fileID && this.sessionUploadFileIDs.indexOf(fileID) === -1) {
      this.sessionUploadFileIDs.push(fileID);
    }
  },

  markExistingFileForRemoval: function(fileID) {
    if (fileID && this.removedFileIDs.indexOf(fileID) === -1) {
      this.removedFileIDs.push(fileID);
    }
  },

  removeSessionFileFromTracking: function(fileID) {
    this.sessionUploadFileIDs = this.sessionUploadFileIDs.filter(function(item) {
      return item !== fileID;
    });
  },

  releaseImageFile: async function(image) {
    if (!image || !image.fileID) {
      return;
    }

    if (image.origin === 'existing') {
      this.markExistingFileForRemoval(image.fileID);
      return;
    }

    await chronicleHelper.deleteCloudFiles([image.fileID]);
    this.removeSessionFileFromTracking(image.fileID);
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
        personName: chronicle.personName || '',
        content: chronicle.content || '',
        coverImage: chronicle.coverImage ? Object.assign({}, chronicle.coverImage, {
          origin: 'existing'
        }) : null,
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

  onPersonNameInput: function(e) {
    this.setData({
      personName: e.detail.value
    });
    this.syncNavigationTitle();
  },

  onContentInput: function(e) {
    this.setData({
      content: e.detail.value
    });
  },

  buildUploadFileList: function(res) {
    return res.tempFiles || (res.tempFilePaths || []).map(function(path) {
      return {
        path: path,
        tempFilePath: path
      };
    });
  },

  uploadSingleImage: async function(file, cloudPathBuilder) {
    var filePath = (file && (file.path || file.tempFilePath)) || '';
    if (!filePath) {
      throw new Error('未获取到图片路径');
    }

    var uploadRes = await wx.cloud.uploadFile({
      cloudPath: cloudPathBuilder(filePath),
      filePath: filePath
    });

    this.trackSessionFile(uploadRes.fileID);
    return {
      imageId: util.generateId('img'),
      fileID: uploadRes.fileID,
      sortOrder: 1,
      caption: '',
      fileName: chronicleHelper.getFileBaseName(filePath),
      uploadedAt: Date.now(),
      tempFileURL: filePath,
      origin: 'session'
    };
  },

  chooseCoverImage: async function() {
    if (this.data.isUploading) {
      return;
    }

    try {
      var res = await chooseImages(1);
      var files = this.buildUploadFileList(res);
      if (!files.length) {
        return;
      }

      this.setData({ isUploading: true });

      var newCover = await this.uploadSingleImage(files[0], function(filePath) {
        return chronicleHelper.buildCoverCloudPath(
          this.data.gradeYear,
          this.data.chronicleId,
          filePath
        );
      }.bind(this));

      if (this.data.coverImage) {
        await this.releaseImageFile(this.data.coverImage);
      }

      this.setData({
        coverImage: newCover,
        isUploading: false
      });
      util.showToast('封面已更新', 'success');
    } catch (err) {
      if (err && err.errMsg && err.errMsg.indexOf('cancel') !== -1) {
        this.setData({ isUploading: false });
        return;
      }
      console.error(err);
      this.setData({ isUploading: false });
      util.showToast('上传封面失败');
    }
  },

  removeCoverImage: async function() {
    if (!this.data.coverImage) {
      return;
    }

    try {
      await this.releaseImageFile(this.data.coverImage);
      this.setData({
        coverImage: null
      });
    } catch (err) {
      console.error(err);
      util.showToast('删除封面失败');
    }
  },

  chooseImages: async function() {
    if (this.data.isUploading) {
      return;
    }

    var remaining = this.data.maxImageCount - this.data.images.length;
    if (remaining <= 0) {
      util.showToast('最多上传 9 张配图');
      return;
    }

    try {
      var res = await chooseImages(remaining);
      var files = this.buildUploadFileList(res);
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
        var image = await this.uploadSingleImage(files[i], function(filePath) {
          return chronicleHelper.buildImageCloudPath(
            this.data.gradeYear,
            this.data.chronicleId,
            images.length,
            filePath
          );
        }.bind(this));

        image.sortOrder = images.length + 1;
        images.push(image);
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
      util.showToast('配图上传失败');
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
      await this.releaseImageFile(image);
      images.splice(index, 1);
      this.setData({
        images: this.resequenceImages(images)
      });
    } catch (err) {
      console.error(err);
      util.showToast('删除配图失败');
    }
  },

  previewCoverImage: function() {
    var coverImage = this.data.coverImage;
    if (!coverImage || !coverImage.tempFileURL) {
      return;
    }

    wx.previewImage({
      current: coverImage.tempFileURL,
      urls: [coverImage.tempFileURL]
    });
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
    var coverImage = chronicleHelper.buildChronicleImageForStorage(this.data.coverImage);
    var images = chronicleHelper.buildChronicleImagesForStorage(this.data.images);
    return {
      gradeYear: this.data.gradeYear,
      gradeLabel: this.data.gradeLabel,
      personName: chronicleHelper.normalizeText(this.data.personName),
      content: chronicleHelper.normalizeText(this.data.content),
      coverImage: coverImage,
      coverFileId: coverImage ? coverImage.fileID : '',
      images: images,
      updatedAt: now
    };
  },

  buildUpdateData: function(payload) {
    var db = wx.cloud.database();
    var _ = db.command;

    return {
      gradeYear: payload.gradeYear,
      gradeLabel: payload.gradeLabel,
      personName: payload.personName,
      content: payload.content,
      coverImage: payload.coverImage ? _.set(payload.coverImage) : _.remove(),
      coverFileId: payload.coverFileId || '',
      images: _.set(payload.images || []),
      updatedAt: payload.updatedAt
    };
  },

  getReferencedFileIDs: function(payload) {
    var fileIDs = [];
    if (payload.coverFileId) {
      fileIDs.push(payload.coverFileId);
    }

    (payload.images || []).forEach(function(image) {
      if (image.fileID && fileIDs.indexOf(image.fileID) === -1) {
        fileIDs.push(image.fileID);
      }
    });

    return fileIDs;
  },

  handleSubmit: async function() {
    if (this.data.isSubmitting || this.data.isUploading) {
      return;
    }
    if (!this.data.gradeYear) {
      util.showToast('缺少年级参数');
      return;
    }
    if (!chronicleHelper.normalizeText(this.data.personName)) {
      util.showToast('请输入人物姓名');
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
          data: this.buildUpdateData(payload)
        });

        if (this.removedFileIDs.length) {
          var referencedFileIDs = this.getReferencedFileIDs(payload);
          var removableFileIDs = this.removedFileIDs.filter(function(fileID) {
            return referencedFileIDs.indexOf(fileID) === -1;
          });

          if (removableFileIDs.length) {
            await chronicleHelper.deleteCloudFiles(removableFileIDs);
          }
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
