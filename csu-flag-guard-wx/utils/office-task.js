var COLLECTION_NAME = 'office_tasks';
var SUPPORTED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'];

function normalizeText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function sanitizeFileName(fileName) {
  return normalizeText(fileName).replace(/[^\w\-\u4e00-\u9fa5\.]+/g, '_');
}

function getExtension(fileName) {
  var match = normalizeText(fileName).match(/\.([^.]+)$/);
  return match ? String(match[1]).toLowerCase() : '';
}

function getFileTypeLabel(fileName) {
  var extension = getExtension(fileName);

  if (extension === 'pdf') {
    return 'PDF';
  }

  if (extension === 'doc' || extension === 'docx') {
    return 'Word';
  }

  if (extension === 'xls' || extension === 'xlsx') {
    return 'Excel';
  }

  if (extension === 'ppt' || extension === 'pptx') {
    return 'PPT';
  }

  if (extension === 'csv') {
    return 'CSV';
  }

  return extension ? extension.toUpperCase() : '文件';
}

function getOpenFileType(fileName) {
  var extension = getExtension(fileName);
  return SUPPORTED_EXTENSIONS.indexOf(extension) !== -1 ? extension : '';
}

function buildSubmissionCloudPath(taskId, memberId, fileName) {
  var safeTaskId = normalizeText(taskId) || 'task';
  var safeMemberId = normalizeText(memberId) || 'member';
  var safeFileName = sanitizeFileName(fileName) || ('submission_' + Date.now());
  return 'office-tasks/' + safeTaskId + '/' + safeMemberId + '_' + Date.now() + '_' + safeFileName;
}

async function callAction(action, data) {
  var res = await wx.cloud.callFunction({
    name: 'officeTaskManage',
    data: Object.assign({
      action: action
    }, data || {})
  });
  var result = res.result || {};
  if (!result.success) {
    throw new Error(result.message || '办公室任务操作失败');
  }
  return result;
}

async function listTasks(options) {
  return callAction('listTasks', options);
}

async function getTaskDetail(taskId, options) {
  return callAction('getTaskDetail', Object.assign({
    taskId: taskId
  }, options || {}));
}

async function createTask(payload) {
  return callAction('createTask', payload);
}

async function submitTask(payload) {
  return callAction('submitTask', payload);
}

async function getTempFileURL(fileID) {
  var res = await wx.cloud.getTempFileURL({
    fileList: [fileID]
  });
  var file = (res.fileList || [])[0] || {};
  return file.tempFileURL || '';
}

async function downloadFile(fileID) {
  if (!fileID) {
    return '';
  }

  try {
    var cloudRes = await wx.cloud.downloadFile({
      fileID: fileID
    });
    if (cloudRes && cloudRes.tempFilePath) {
      return cloudRes.tempFilePath;
    }
  } catch (err) {
    console.error('cloud download office task file failed', err);
  }

  var tempUrl = await getTempFileURL(fileID);
  if (!tempUrl) {
    return '';
  }

  var downloadRes = await wx.downloadFile({
    url: tempUrl
  });
  var statusCode = Number(downloadRes.statusCode || 0);
  if (statusCode >= 200 && statusCode < 300 && downloadRes.tempFilePath) {
    return downloadRes.tempFilePath;
  }

  return '';
}

module.exports = {
  COLLECTION_NAME: COLLECTION_NAME,
  SUPPORTED_EXTENSIONS: SUPPORTED_EXTENSIONS,
  buildSubmissionCloudPath: buildSubmissionCloudPath,
  createTask: createTask,
  downloadFile: downloadFile,
  getExtension: getExtension,
  getFileTypeLabel: getFileTypeLabel,
  getOpenFileType: getOpenFileType,
  getTaskDetail: getTaskDetail,
  getTempFileURL: getTempFileURL,
  listTasks: listTasks,
  normalizeText: normalizeText,
  submitTask: submitTask
};
