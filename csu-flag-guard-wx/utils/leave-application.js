var storage = require('./storage');
var util = require('./util');

var COLLECTION_NAME = 'leave_applications';
var STATUS_PENDING = '\u5f85\u5ba1\u6279';
var STATUS_APPROVED = '\u5df2\u901a\u8fc7';
var PAGE_SIZE = 20;

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
  return match ? String(match[1]).toLowerCase() : 'jpg';
}

async function getCollection() {
  await storage.warmupCloud();
  return wx.cloud.database().collection(COLLECTION_NAME);
}

function buildProofCloudPath(trainingId, memberId, fileName, index) {
  var safeTrainingId = normalizeText(trainingId) || 'training';
  var safeMemberId = normalizeText(memberId) || 'member';
  var safeFileName = sanitizeFileName(fileName) || ('proof_' + Date.now() + '_' + (index || 0) + '.' + getExtension(fileName));
  return 'leave-applications/' + safeTrainingId + '/' + safeMemberId + '_' + Date.now() + '_' + (index || 0) + '_' + safeFileName;
}

function normalizeProofs(proofs) {
  return (Array.isArray(proofs) ? proofs : []).map(function(item) {
    return {
      fileID: normalizeText(item.fileID),
      fileName: normalizeText(item.fileName)
    };
  }).filter(function(item) {
    return !!item.fileID;
  }).slice(0, 3);
}

function enrichApplication(application) {
  if (!application) {
    return null;
  }

  var createdAt = Number(application.createdAt || 0);
  var approvedAt = Number(application.approvedAt || 0);
  var createdDate = new Date(createdAt);
  var approvedDate = new Date(approvedAt);

  return Object.assign({}, application, {
    title: normalizeText(application.trainingTitle),
    status: normalizeText(application.status) || STATUS_PENDING,
    reason: normalizeText(application.reason),
    memberName: normalizeText(application.memberName) || '\u672a\u77e5\u6210\u5458',
    memberDepartment: normalizeText(application.memberDepartment) || '\u672a\u5206\u914d',
    proofs: normalizeProofs(application.proofs),
    displayCreatedAt: isNaN(createdDate.getTime())
      ? '\u65f6\u95f4\u672a\u77e5'
      : util.formatDate(createdDate) + ' ' + util.formatTime(createdDate),
    displayApprovedAt: isNaN(approvedDate.getTime())
      ? ''
      : util.formatDate(approvedDate) + ' ' + util.formatTime(approvedDate)
  });
}

async function fetchAll(query) {
  var collection = await getCollection();
  var list = [];
  var offset = 0;
  var hasQuery = query && Object.keys(query).length > 0;

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

async function getTempFileUrlMap(fileIDs) {
  var ids = (fileIDs || []).filter(Boolean);
  var map = {};

  while (ids.length) {
    var current = ids.splice(0, 20);
    var res = await wx.cloud.getTempFileURL({
      fileList: current
    });

    (res.fileList || []).forEach(function(item) {
      if (item && item.fileID) {
        map[item.fileID] = item.tempFileURL || '';
      }
    });
  }

  return map;
}

async function fillProofUrls(applications) {
  var list = Array.isArray(applications) ? applications : [];
  var fileIDs = [];

  list.forEach(function(item) {
    normalizeProofs(item.proofs).forEach(function(proof) {
      if (proof.fileID && fileIDs.indexOf(proof.fileID) === -1) {
        fileIDs.push(proof.fileID);
      }
    });
  });

  var tempUrlMap = fileIDs.length ? await getTempFileUrlMap(fileIDs) : {};

  return list.map(function(item) {
    var enriched = enrichApplication(item);
    enriched.proofs = (enriched.proofs || []).map(function(proof) {
      return Object.assign({}, proof, {
        url: tempUrlMap[proof.fileID] || ''
      });
    });
    return enriched;
  });
}

async function getMemberTrainingApplication(trainingId, memberId) {
  var query = {
    trainingId: normalizeText(trainingId),
    memberId: normalizeText(memberId)
  };
  if (!query.trainingId || !query.memberId) {
    return null;
  }

  var collection = await getCollection();
  var res = await collection.where(query).limit(1).get();
  if (!res.data || !res.data.length) {
    return null;
  }

  var plain = Object.assign({}, res.data[0]);
  plain._docId = plain._id;
  delete plain._id;

  var filled = await fillProofUrls([plain]);
  return filled[0] || null;
}

async function getAllApplications() {
  var list = await fetchAll();
  var plainList = list.map(function(item) {
    var plain = Object.assign({}, item);
    plain._docId = plain._id;
    delete plain._id;
    return plain;
  }).sort(function(a, b) {
    var statusA = normalizeText(a.status) || STATUS_PENDING;
    var statusB = normalizeText(b.status) || STATUS_PENDING;
    if (statusA !== statusB) {
      return statusA === STATUS_PENDING ? -1 : 1;
    }
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });

  return fillProofUrls(plainList);
}

async function callAction(action, data) {
  var res = await wx.cloud.callFunction({
    name: 'leaveManage',
    data: Object.assign({
      action: action
    }, data || {})
  });
  var result = res.result || {};
  if (!result.success) {
    throw new Error(result.message || '\u8bf7\u5047\u7533\u8bf7\u64cd\u4f5c\u5931\u8d25');
  }
  return result;
}

async function submitApplication(payload) {
  return callAction('submit', payload);
}

async function approveApplication(payload) {
  return callAction('approve', payload);
}

module.exports = {
  COLLECTION_NAME: COLLECTION_NAME,
  STATUS_PENDING: STATUS_PENDING,
  STATUS_APPROVED: STATUS_APPROVED,
  approveApplication: approveApplication,
  buildProofCloudPath: buildProofCloudPath,
  getAllApplications: getAllApplications,
  getExtension: getExtension,
  getMemberTrainingApplication: getMemberTrainingApplication,
  normalizeProofs: normalizeProofs,
  normalizeText: normalizeText,
  submitApplication: submitApplication
};
