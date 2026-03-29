var storage = require('./storage');
var util = require('./util');

var COLLECTION_NAME = 'bug_reports';
var PAGE_SIZE = 20;
var DEFAULT_REPORTER_NAME = '\u672a\u547d\u540d\u6210\u5458';
var DEFAULT_DEPARTMENT_NAME = '\u672a\u5206\u914d';
var DEFAULT_STATUS_TEXT = '\u5f85\u5904\u7406';
var UNKNOWN_TIME_TEXT = '\u65f6\u95f4\u672a\u77e5';

function normalizeText(value) {
  return value ? String(value).trim() : '';
}

async function getCollection() {
  await storage.warmupCloud();
  return wx.cloud.database().collection(COLLECTION_NAME);
}

async function fetchAll(query) {
  var collection = await getCollection();
  var hasQuery = query && Object.keys(query).length > 0;
  var list = [];
  var offset = 0;

  while (true) {
    var ref = hasQuery ? collection.where(query) : collection;
    var res = await ref.skip(offset).limit(PAGE_SIZE).get();
    var data = res.data || [];
    list = list.concat(data);

    if (data.length < PAGE_SIZE) {
      break;
    }

    offset += data.length;
  }

  return list;
}

function enrichReport(report) {
  if (!report) {
    return null;
  }

  var createdAt = Number(report.createdAt || 0);
  var updatedAt = Number(report.updatedAt || 0);
  var createdDate = new Date(createdAt);
  var updatedDate = new Date(updatedAt);

  return Object.assign({}, report, {
    title: normalizeText(report.title),
    content: normalizeText(report.content),
    reporterName: normalizeText(report.reporterName) || DEFAULT_REPORTER_NAME,
    reporterDepartment: normalizeText(report.reporterDepartment) || DEFAULT_DEPARTMENT_NAME,
    status: normalizeText(report.status) || DEFAULT_STATUS_TEXT,
    displayCreatedAt: isNaN(createdDate.getTime())
      ? UNKNOWN_TIME_TEXT
      : util.formatDate(createdDate) + ' ' + util.formatTime(createdDate),
    displayUpdatedAt: isNaN(updatedDate.getTime())
      ? ''
      : util.formatDate(updatedDate) + ' ' + util.formatTime(updatedDate)
  });
}

async function addReport(report) {
  var collection = await getCollection();
  var now = Date.now();
  var data = {
    id: report.id || util.generateId('bug'),
    title: normalizeText(report.title),
    content: normalizeText(report.content),
    reporterName: normalizeText(report.reporterName),
    reporterMemberId: normalizeText(report.reporterMemberId),
    reporterStudentId: normalizeText(report.reporterStudentId),
    reporterDepartment: normalizeText(report.reporterDepartment),
    status: DEFAULT_STATUS_TEXT,
    createdAt: now,
    updatedAt: now
  };

  await collection.add({
    data: data
  });

  return enrichReport(data);
}

async function getAllReports() {
  var list = await fetchAll();
  return list.map(function(item) {
    var plain = Object.assign({}, item);
    plain._docId = plain._id;
    delete plain._id;
    return enrichReport(plain);
  }).sort(function(a, b) {
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });
}

module.exports = {
  COLLECTION_NAME: COLLECTION_NAME,
  normalizeText: normalizeText,
  addReport: addReport,
  getAllReports: getAllReports,
  enrichReport: enrichReport
};
