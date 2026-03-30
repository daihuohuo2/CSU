var COLLECTION_NAME = 'office_materials';
var FETCH_LIMIT = 20;
var SUPPORTED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

function getCollection() {
  return wx.cloud.database().collection(COLLECTION_NAME);
}

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

  return extension ? extension.toUpperCase() : '文件';
}

function getOpenFileType(fileName) {
  var extension = getExtension(fileName);
  var allowedTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
  return allowedTypes.indexOf(extension) !== -1 ? extension : '';
}

function buildCloudPath(fileName) {
  var safeFileName = sanitizeFileName(fileName) || ('material_' + Date.now());
  return 'office-materials/office/' + Date.now() + '_' + safeFileName;
}

async function fetchAll() {
  var result = [];
  var offset = 0;

  while (true) {
    var res = await getCollection().skip(offset).limit(FETCH_LIMIT).get();
    var data = res.data || [];
    result = result.concat(data);

    if (data.length < FETCH_LIMIT) {
      break;
    }

    offset += data.length;
  }

  return result;
}

function enrichRecord(record) {
  if (!record) {
    return null;
  }

  var plain = Object.assign({}, record);
  plain._docId = plain._id || plain._docId || '';
  delete plain._id;

  var fileName = normalizeText(plain.fileName || plain.name);
  plain.name = fileName;
  plain.fileName = fileName;
  plain.fileExt = getExtension(fileName);
  plain.fileTypeLabel = getFileTypeLabel(fileName);

  return plain;
}

async function getList() {
  var records = await fetchAll();

  return records.map(enrichRecord).sort(function(a, b) {
    var aTime = Number(a.updatedAt || a.createdAt || 0);
    var bTime = Number(b.updatedAt || b.createdAt || 0);
    return bTime - aTime;
  });
}

async function addRecord(record) {
  var now = Date.now();
  var fileName = normalizeText(record.fileName || record.name);
  var data = Object.assign({}, record, {
    name: fileName,
    fileName: fileName,
    fileExt: getExtension(fileName),
    fileID: normalizeText(record.fileID),
    uploadedBy: normalizeText(record.uploadedBy),
    createdAt: now,
    updatedAt: now
  });

  await getCollection().add({
    data: data
  });

  return enrichRecord(data);
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
    console.error('cloud download office material failed', err);
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
  addRecord: addRecord,
  buildCloudPath: buildCloudPath,
  downloadFile: downloadFile,
  getExtension: getExtension,
  getFileTypeLabel: getFileTypeLabel,
  getOpenFileType: getOpenFileType,
  getList: getList,
  getTempFileURL: getTempFileURL,
  normalizeText: normalizeText
};
