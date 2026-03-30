var storage = require('../../../../utils/storage');
var util = require('../../../../utils/util');
var officeTaskHelper = require('../../../../utils/office-task');

function chooseTaskFile() {
  return new Promise(function(resolve, reject) {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: officeTaskHelper.SUPPORTED_EXTENSIONS,
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

function formatTask(task) {
  var submissionMap = {};
  (task.submissions || []).forEach(function(item) {
    submissionMap[item.memberId] = item;
  });

  var assigneeRows = (task.assignees || []).map(function(item) {
    var submission = submissionMap[item.memberId] || null;
    var submittedAt = '';
    if (submission && submission.submittedAt) {
      var date = new Date(Number(submission.submittedAt));
      submittedAt = isNaN(date.getTime())
        ? ''
        : util.formatDate(date) + ' ' + util.formatTime(date);
    }

    return {
      memberId: item.memberId,
      name: item.name,
      submitted: !!submission,
      submittedAt: submittedAt,
      fileName: submission ? submission.fileName : '',
      fileID: submission ? submission.fileID : '',
      fileTypeLabel: submission ? submission.fileTypeLabel : ''
    };
  });

  var submissions = (task.submissions || []).map(function(item) {
    var date = new Date(Number(item.submittedAt || 0));
    return Object.assign({}, item, {
      displaySubmittedAt: isNaN(date.getTime())
        ? '时间未知'
        : util.formatDate(date) + ' ' + util.formatTime(date)
    });
  });

  return Object.assign({}, task, {
    displayDueDate: task.dueDate || '未设置',
    progressText: (task.completedCount || 0) + '/' + (task.totalCount || 0),
    assigneeRows: assigneeRows,
    displaySubmissions: submissions
  });
}

Page({
  data: {
    id: '',
    isAdmin: false,
    isMemberMode: false,
    isLoading: true,
    isSubmitting: false,
    task: null,
    currentMember: null,
    selectedFile: null
  },

  onLoad: function(options) {
    this.setData({
      id: officeTaskHelper.normalizeText(options.id),
      isMemberMode: options && options.mode === 'member'
    });
  },

  onShow: async function() {
    var userInfo = storage.getUserInfo();
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    if (!this.data.isMemberMode && !storage.isAdmin()) {
      util.showToast('仅管理员可访问');
      setTimeout(function() {
        wx.navigateBack();
      }, 1200);
      return;
    }

    var currentMember = null;
    if (this.data.isMemberMode) {
      currentMember = storage.enrichMember(await storage.getCurrentMember());
      if (!currentMember) {
        util.showToast('未找到当前成员档案');
        return;
      }
    }

    this.setData({
      isAdmin: storage.isAdmin(),
      currentMember: currentMember
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
    if (!this.data.id) {
      util.showToast('缺少任务参数');
      return;
    }

    this.setData({ isLoading: true });

    try {
      var result = await officeTaskHelper.getTaskDetail(this.data.id, {
        memberId: this.data.currentMember ? this.data.currentMember.id : ''
      });
      var task = formatTask(result.task || {});

      this.setData({
        task: task,
        isLoading: false
      });

      wx.setNavigationBarTitle({
        title: task.title || '任务详情'
      });
    } catch (err) {
      console.error(err);
      this.setData({
        task: null,
        isLoading: false
      });
      util.showToast(err.message || '加载任务详情失败');
    }
  },

  chooseFile: async function() {
    if (this.data.isSubmitting) {
      return;
    }

    try {
      var res = await chooseTaskFile();
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
          tag: officeTaskHelper.getFileTypeLabel(fileName)
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

  submitTask: async function() {
    if (this.data.isSubmitting) {
      return;
    }

    var task = this.data.task;
    var currentMember = this.data.currentMember;
    var selectedFile = this.data.selectedFile;

    if (!task || !currentMember) {
      util.showToast('缺少成员或任务信息');
      return;
    }

    if (!selectedFile || !selectedFile.path || !selectedFile.name) {
      util.showToast('请先选择提交文件');
      return;
    }

    this.setData({ isSubmitting: true });
    var uploadedFileID = '';
    var submittedTask = null;

    try {
      var uploadRes = await wx.cloud.uploadFile({
        cloudPath: officeTaskHelper.buildSubmissionCloudPath(task.id, currentMember.id, selectedFile.name),
        filePath: selectedFile.path
      });
      uploadedFileID = uploadRes.fileID;

      var result = await officeTaskHelper.submitTask({
        taskId: task.id,
        docId: task._docId,
        memberId: currentMember.id,
        memberName: currentMember.name,
        fileID: uploadedFileID,
        fileName: selectedFile.name
      });
      submittedTask = result.task || null;

      if (result.previousFileID && result.previousFileID !== uploadedFileID) {
        try {
          await wx.cloud.deleteFile({
            fileList: [result.previousFileID]
          });
        } catch (deleteErr) {
          console.error('cleanup previous office task file failed', deleteErr);
        }
      }

      if (submittedTask) {
        var nextTask = formatTask(submittedTask);
        this.setData({
          task: nextTask,
          selectedFile: null
        });
        wx.setNavigationBarTitle({
          title: nextTask.title || '任务详情'
        });
      } else {
        await this.loadData();
      }

      util.showToast('任务已完成', 'success');
    } catch (err) {
      console.error(err);
      if (uploadedFileID && !submittedTask) {
        try {
          await wx.cloud.deleteFile({
            fileList: [uploadedFileID]
          });
        } catch (deleteErr) {
          console.error('cleanup office task upload failed', deleteErr);
        }
      }
      util.showToast(err.message || '提交任务失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  openSubmission: async function(e) {
    var fileID = e.currentTarget.dataset.fileId;
    var fileName = e.currentTarget.dataset.fileName;

    if (!fileID) {
      util.showToast('未找到对应文件');
      return;
    }

    wx.showLoading({
      title: '打开中...',
      mask: true
    });

    try {
      var tempFilePath = await officeTaskHelper.downloadFile(fileID);
      if (!tempFilePath) {
        throw new Error('下载任务文件失败');
      }

      wx.hideLoading();
      wx.openDocument({
        filePath: tempFilePath,
        fileType: officeTaskHelper.getOpenFileType(fileName) || undefined,
        showMenu: true
      });
    } catch (err) {
      console.error(err);
      wx.hideLoading();
      util.showToast(err.message || '打开提交文件失败');
    }
  }
});
