var COLLECTION_NAME = 'meeting_records';
var FETCH_LIMIT = 20;

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
  return normalizeText(fileName).replace(/[^\w\-\u4e00-\u9fa5]+/g, '_');
}

function ensurePdfExtension(fileName) {
  var text = normalizeText(fileName);
  if (!text) {
    return 'meeting_record.pdf';
  }

  if (/\.pdf$/i.test(text)) {
    return text;
  }

  return text + '.pdf';
}

function buildCloudPath(departmentKey, recordName, fileName) {
  var department = normalizeText(departmentKey) || 'office';
  var safeRecordName = sanitizeFileName(recordName) || 'meeting_record';
  var safeFileName = sanitizeFileName(ensurePdfExtension(fileName));
  return 'meeting-records/' + department + '/' + Date.now() + '_' + safeRecordName + '_' + safeFileName;
}

async function fetchAllByQuery(query) {
  var result = [];
  var offset = 0;
  var hasQuery = query && Object.keys(query).length > 0;

  while (true) {
    var ref = hasQuery ? getCollection().where(query) : getCollection();
    var res = await ref.skip(offset).limit(FETCH_LIMIT).get();
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
  return plain;
}

async function getListByDepartment(departmentKey) {
  var records = await fetchAllByQuery({
    departmentKey: normalizeText(departmentKey)
  });

  return records.map(enrichRecord).sort(function(a, b) {
    var aTime = Number(a.updatedAt || a.createdAt || 0);
    var bTime = Number(b.updatedAt || b.createdAt || 0);
    return bTime - aTime;
  });
}

async function addRecord(record) {
  var now = Date.now();
  var data = Object.assign({}, record, {
    departmentKey: normalizeText(record.departmentKey),
    name: normalizeText(record.name),
    fileName: normalizeText(record.fileName),
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
    console.error('cloud download meeting record failed', err);
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
  addRecord: addRecord,
  buildCloudPath: buildCloudPath,
  downloadFile: downloadFile,
  ensurePdfExtension: ensurePdfExtension,
  getListByDepartment: getListByDepartment,
  getTempFileURL: getTempFileURL,
  normalizeText: normalizeText
};
