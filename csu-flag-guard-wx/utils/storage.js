var mockData = require('../mock/data');

var POSITION_OPTIONS = [
  '班长',
  '超级牛逼雷霆之人',
  '副班长',
  '办公室主任',
  '特勤部部长',
  '财务部部长',
  '宣传部部长',
  '擎旗手',
  '撒旗手',
  '升旗手',
  '指挥员',
  '队员'
];

var TRAINING_TYPE_OPTIONS = [
  '例训',
  '补训'
];

var DEPARTMENT_OPTIONS = [
  '办公室成员',
  '财务部成员',
  '特勤部成员',
  '宣传部成员'
];

var ADMIN_POSITIONS = [
  '班长',
  '超级牛逼雷霆之人',
  '副班长',
  '办公室主任',
  '特勤部部长',
  '财务部部长',
  '宣传部部长'
];

var DEFAULT_MEMBER_PASSWORD = '123456';

var LEGACY_POSITION_MAP = {
  '队长': '班长',
  '副队长': '副班长',
  '旗手': '擎旗手',
  '护旗手': '升旗手'
};

var LEGACY_TRAINING_TYPE_MAP = {
  '日常训练': '例训',
  '专项训练': '补训',
  '彩排': '补训'
};

var KEYS = {
  MEMBERS: 'fg_members',
  TRAININGS: 'fg_trainings',
  FLAG_CEREMONIES: 'fg_flag_ceremonies',
  TUTORIALS: 'fg_tutorials',
  USER_INFO: 'fg_user_info'
};

var COLLECTIONS = {};
COLLECTIONS[KEYS.MEMBERS] = 'members';
COLLECTIONS[KEYS.TRAININGS] = 'trainings';
COLLECTIONS[KEYS.FLAG_CEREMONIES] = 'flag_ceremonies';
COLLECTIONS[KEYS.TUTORIALS] = 'tutorials';

var cloudInitPromise = null;
var readyPromise = null;
var db = null;

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

function getCollectionName(key) {
  return COLLECTIONS[key];
}

function getCollection(key) {
  var collectionName = getCollectionName(key);
  if (!collectionName) {
    throw new Error('Unknown collection key: ' + key);
  }
  return db.collection(collectionName);
}

function normalizePositions(position) {
  var list = Array.isArray(position) ? position.slice() : (position ? [position] : []);
  var normalized = [];

  list.forEach(function(item) {
    var mapped = LEGACY_POSITION_MAP[item] || item;
    if (mapped && normalized.indexOf(mapped) === -1) {
      normalized.push(mapped);
    }
  });

  return normalized;
}

function getPositionText(position) {
  return normalizePositions(position).join('、');
}

function hasAdminPosition(position) {
  var positions = normalizePositions(position);
  return positions.some(function(item) {
    return ADMIN_POSITIONS.indexOf(item) !== -1;
  });
}

function isMemberActive(member) {
  if (!member) {
    return false;
  }

  return !member.status || member.status === '在队' || member.status === '鍦ㄩ槦';
}

function normalizeTrainingType(type, title) {
  var rawType = type ? String(type).trim() : '';
  var rawTitle = title ? String(title).trim() : '';

  if (LEGACY_TRAINING_TYPE_MAP[rawType]) {
    return LEGACY_TRAINING_TYPE_MAP[rawType];
  }

  if (rawType === '例训' || rawType === '补训') {
    return rawType;
  }

  if (rawTitle.indexOf('补训') !== -1) {
    return '补训';
  }

  if (rawTitle.indexOf('例训') !== -1) {
    return '例训';
  }

  return rawType;
}

function enrichMember(member) {
  if (!member) return null;
  var positions = normalizePositions(member.position);
  return Object.assign({}, member, {
    password: member.password || DEFAULT_MEMBER_PASSWORD,
    position: positions,
    positionText: positions.join('、')
  });
}

function enrichTraining(training) {
  if (!training) return null;
  return Object.assign({}, training, {
    type: normalizeTrainingType(training.type, training.title)
  });
}

function enrichMembers(members) {
  return (members || []).map(enrichMember);
}

function enrichItem(key, item) {
  if (key === KEYS.MEMBERS) {
    return enrichMember(item);
  }
  if (key === KEYS.TRAININGS) {
    return enrichTraining(item);
  }
  return item;
}

function normalizeItemForStorage(key, item) {
  if (!item) {
    return item;
  }

  if (key === KEYS.MEMBERS) {
    return Object.assign({}, item, {
      password: item.password || DEFAULT_MEMBER_PASSWORD
    });
  }

  if (key === KEYS.TRAININGS) {
    return Object.assign({}, item, {
      type: normalizeTrainingType(item.type, item.title)
    });
  }

  return item;
}

function sortByUpdatedAt(list) {
  return list.sort(function(a, b) {
    var aTime = a.updatedAt || a.createdAt || 0;
    var bTime = b.updatedAt || b.createdAt || 0;
    return bTime - aTime;
  });
}

async function ensureCloud() {
  if (cloudInitPromise) return cloudInitPromise;

  cloudInitPromise = (async function() {
    if (!wx.cloud) {
      throw new Error('当前基础库不支持云开发，请在微信开发者工具中开启云开发。');
    }
    wx.cloud.init({
      env: wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true
    });
    db = wx.cloud.database();
    return db;
  })();

  return cloudInitPromise;
}

async function fetchAll(collectionRef, query) {
  // 小程序端云数据库单次查询通常最多返回 20 条，超过后需要手动翻页。
  var limit = 20;
  var result = [];
  var hasQuery = query && Object.keys(query).length > 0;
  var offset = 0;

  while (true) {
    var ref = hasQuery ? collectionRef.where(query) : collectionRef;
    var res = await ref.skip(offset).limit(limit).get();
    var data = res.data || [];
    result = result.concat(data);
    if (data.length < limit) {
      break;
    }
    offset += data.length;
  }

  return result;
}

function withTimestamps(item, fallbackCreatedAt) {
  var now = Date.now();
  return Object.assign({}, clone(item), {
    createdAt: item.createdAt || fallbackCreatedAt || now,
    updatedAt: now
  });
}

async function seedCollection(key, seedList) {
  var collection = getCollection(key);
  var list = await fetchAll(collection);
  if (list.length > 0) {
    return;
  }

  for (var i = 0; i < seedList.length; i++) {
    var seedItem = withTimestamps(seedList[i], Date.now() - i);
    await collection.add({ data: seedItem });
  }
}

async function seedMockData() {
  await seedCollection(KEYS.MEMBERS, mockData.members);
  await seedCollection(KEYS.TRAININGS, mockData.trainings);
  await seedCollection(KEYS.FLAG_CEREMONIES, mockData.flagCeremonies);
  await seedCollection(KEYS.TUTORIALS, mockData.tutorials);
}

async function backfillMemberDefaults() {
  var collection = getCollection(KEYS.MEMBERS);
  var members = await fetchAll(collection);

  for (var i = 0; i < members.length; i++) {
    if (members[i].password) {
      continue;
    }

    await collection.doc(members[i]._id).update({
      data: {
        password: DEFAULT_MEMBER_PASSWORD,
        updatedAt: Date.now()
      }
    });
  }
}

async function backfillTrainingTypes() {
  var collection = getCollection(KEYS.TRAININGS);
  var trainings = await fetchAll(collection);

  for (var i = 0; i < trainings.length; i++) {
    var normalizedType = normalizeTrainingType(trainings[i].type, trainings[i].title);
    if (!normalizedType || normalizedType === trainings[i].type) {
      continue;
    }

    await collection.doc(trainings[i]._id).update({
      data: {
        type: normalizedType,
        updatedAt: Date.now()
      }
    });
  }
}

async function ensureReady() {
  if (readyPromise) return readyPromise;

  readyPromise = (async function() {
    await ensureCloud();
    await seedMockData();
    await backfillMemberDefaults();
    await backfillTrainingTypes();
    return db;
  })();

  return readyPromise;
}

async function initMockData() {
  return ensureReady();
}

async function getList(key) {
  await ensureReady();
  var list = await fetchAll(getCollection(key));
  return sortByUpdatedAt(list).map(function(item) {
    var plain = Object.assign({}, item);
    plain._docId = plain._id;
    delete plain._id;
    return enrichItem(key, plain);
  });
}

async function getById(key, id) {
  await ensureReady();
  var res = await getCollection(key).where({ id: id }).limit(1).get();
  if (!res.data || !res.data.length) return null;
  var plain = Object.assign({}, res.data[0]);
  plain._docId = plain._id;
  delete plain._id;
  return enrichItem(key, plain);
}

async function add(key, item) {
  await ensureReady();
  var normalizedItem = normalizeItemForStorage(key, item);
  var data = withTimestamps(normalizedItem);
  await getCollection(key).add({ data: data });
  return enrichItem(key, data);
}

async function updateMemberInCloud(id, data) {
  var payload = clone(data);
  var res = await wx.cloud.callFunction({
    name: 'memberManage',
    data: {
      action: 'update',
      id: id,
      docId: payload._docId || '',
      data: payload
    }
  });
  var result = res.result || {};
  if (!result.success) {
    throw new Error(result.message || '成员更新失败');
  }
  return result.member ? enrichMember(result.member) : null;
}

async function batchUpdateMemberStatusInCloud(ids, status) {
  var res = await wx.cloud.callFunction({
    name: 'memberManage',
    data: {
      action: 'batchUpdateStatus',
      ids: ids,
      status: status
    }
  });
  var result = res.result || {};
  if (!result.success) {
    throw new Error(result.message || '批量调整成员状态失败');
  }
  return result.updatedCount || 0;
}

async function update(key, id, data) {
  await ensureReady();

  if (key === KEYS.MEMBERS) {
    var updatedMember = await updateMemberInCloud(id, data);
    if (updatedMember) {
      syncCurrentUserInfo(updatedMember);
    }
    return updatedMember;
  }

  var collection = getCollection(key);
  var payload = clone(normalizeItemForStorage(key, data));
  var docId = payload._docId;
  delete payload._docId;

  if (!docId) {
    var target = await collection.where({ id: id }).limit(1).get();
    if (!target.data || !target.data.length) {
      return null;
    }
    docId = target.data[0]._id;
  }

  await collection.doc(docId).update({
    data: Object.assign({}, payload, {
      updatedAt: Date.now()
    })
  });

  var updatedItem = await getById(key, id);
  if (key === KEYS.MEMBERS) {
    syncCurrentUserInfo(updatedItem);
  }

  return updatedItem;
}

async function remove(key, id) {
  await ensureReady();
  var collection = getCollection(key);
  var target = await collection.where({ id: id }).limit(1).get();
  if (!target.data || !target.data.length) {
    return;
  }

  await collection.doc(target.data[0]._id).remove();
}

async function clearCollection(key) {
  var collection = getCollection(key);
  var list = await fetchAll(collection);
  for (var i = 0; i < list.length; i++) {
    await collection.doc(list[i]._id).remove();
  }
}

async function resetData() {
  await ensureCloud();
  await clearCollection(KEYS.MEMBERS);
  await clearCollection(KEYS.TRAININGS);
  await clearCollection(KEYS.FLAG_CEREMONIES);
  await clearCollection(KEYS.TUTORIALS);
  await seedMockData();
}

async function batchUpdateMemberStatus(ids, status) {
  await ensureReady();
  return batchUpdateMemberStatusInCloud(ids, status);
}

function getUserInfo() {
  return wx.getStorageSync(KEYS.USER_INFO) || null;
}

function setUserInfo(info) {
  wx.setStorageSync(KEYS.USER_INFO, info);
}

function clearUserInfo() {
  wx.removeStorageSync(KEYS.USER_INFO);
}

async function getCurrentMember() {
  await ensureReady();
  var user = getUserInfo();
  if (!user) {
    return null;
  }

  if (user.memberId) {
    return getById(KEYS.MEMBERS, user.memberId);
  }

  var members = await getList(KEYS.MEMBERS);
  for (var i = 0; i < members.length; i++) {
    if (user.studentId && members[i].studentId === user.studentId) {
      return members[i];
    }
    if (members[i].name === user.name) {
      return members[i];
    }
  }

  return null;
}

function buildUserInfoFromMember(member) {
  if (!member) return null;

  return {
    name: member.name,
    role: hasAdminPosition(member.position) ? 'admin' : 'member',
    studentId: member.studentId,
    memberId: member.id
  };
}

function syncCurrentUserInfo(member) {
  var user = getUserInfo();
  if (!user || !member) {
    return;
  }

  var isSameMember = user.memberId
    ? user.memberId === member.id
    : user.studentId && user.studentId === member.studentId;

  if (!isSameMember) {
    return;
  }

  setUserInfo(buildUserInfoFromMember(member));
}

function isAdmin() {
  var user = getUserInfo();
  return !!(user && user.role === 'admin');
}

async function loginByCredentials(studentId, password) {
  var members = await getList(KEYS.MEMBERS);
  for (var i = 0; i < members.length; i++) {
    if (members[i].studentId === studentId && members[i].password === password) {
      var role = hasAdminPosition(members[i].position) ? 'admin' : 'member';
      return {
        name: members[i].name,
        role: role,
        studentId: members[i].studentId,
        memberId: members[i].id
      };
    }
  }
  return null;
}

POSITION_OPTIONS = [
  '班长',
  '超级牛逼雷霆之人',
  '副班长',
  '办公室主任',
  '特勤部部长',
  '财务部部长',
  '宣传部部长',
  '擎旗手',
  '撒旗手',
  '升旗手',
  '指挥员',
  '队员'
];

TRAINING_TYPE_OPTIONS = [
  '例训',
  '补训'
];

DEPARTMENT_OPTIONS = [
  '办公室成员',
  '财务部成员',
  '特勤部成员',
  '宣传部成员'
];

ADMIN_POSITIONS = [
  '班长',
  '超级牛逼雷霆之人',
  '副班长',
  '办公室主任',
  '特勤部部长',
  '财务部部长',
  '宣传部部长'
];

LEGACY_POSITION_MAP = {
  '队长': '班长',
  '副队长': '副班长',
  '旗手': '擎旗手',
  '护旗手': '升旗手'
};

LEGACY_TRAINING_TYPE_MAP = {
  '日常训练': '例训',
  '专项训练': '补训',
  '彩排': '补训'
};

getPositionText = function(position) {
  return normalizePositions(position).join('、');
};

isMemberActive = function(member) {
  if (!member) {
    return false;
  }

  return !member.status || member.status === '在队';
};

normalizeTrainingType = function(type, title) {
  var rawType = type ? String(type).trim() : '';
  var rawTitle = title ? String(title).trim() : '';

  if (LEGACY_TRAINING_TYPE_MAP[rawType]) {
    return LEGACY_TRAINING_TYPE_MAP[rawType];
  }

  if (rawType === '例训' || rawType === '补训') {
    return rawType;
  }

  if (rawTitle.indexOf('补训') !== -1) {
    return '补训';
  }

  if (rawTitle.indexOf('例训') !== -1) {
    return '例训';
  }

  return rawType;
};

enrichMember = function(member) {
  if (!member) return null;
  var positions = normalizePositions(member.position);
  return Object.assign({}, member, {
    password: member.password || DEFAULT_MEMBER_PASSWORD,
    position: positions,
    positionText: getPositionText(positions)
  });
};

module.exports = {
  KEYS: KEYS,
  POSITION_OPTIONS: POSITION_OPTIONS,
  TRAINING_TYPE_OPTIONS: TRAINING_TYPE_OPTIONS,
  DEPARTMENT_OPTIONS: DEPARTMENT_OPTIONS,
  ADMIN_POSITIONS: ADMIN_POSITIONS,
  DEFAULT_MEMBER_PASSWORD: DEFAULT_MEMBER_PASSWORD,
  initMockData: initMockData,
  resetData: resetData,
  getList: getList,
  getById: getById,
  add: add,
  update: update,
  remove: remove,
  batchUpdateMemberStatus: batchUpdateMemberStatus,
  normalizePositions: normalizePositions,
  getPositionText: getPositionText,
  hasAdminPosition: hasAdminPosition,
  isMemberActive: isMemberActive,
  normalizeTrainingType: normalizeTrainingType,
  enrichMember: enrichMember,
  enrichMembers: enrichMembers,
  getUserInfo: getUserInfo,
  setUserInfo: setUserInfo,
  clearUserInfo: clearUserInfo,
  getCurrentMember: getCurrentMember,
  buildUserInfoFromMember: buildUserInfoFromMember,
  isAdmin: isAdmin,
  loginByCredentials: loginByCredentials
};
