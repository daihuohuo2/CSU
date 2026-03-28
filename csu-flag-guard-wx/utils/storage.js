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

var TUTORIAL_CATEGORY_OPTIONS = [
  '基础动作重点',
  '特殊岗动作',
  '升旗队列流程'
];

var SPECIAL_POSITION_OPTIONS = [
  '擎旗手',
  '撒旗手',
  '升旗手',
  '指挥员'
];

var SPECIAL_TUTORIAL_CATEGORY = TUTORIAL_CATEGORY_OPTIONS[1] || '';

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

var LEGACY_TUTORIAL_CATEGORY_MAP = {
  '基础动作': '基础动作重点',
  '行进动作': '基础动作重点',
  '仪式流程': '基础动作重点',
  '其他': '基础动作重点'
};
var KEYS = {
  MEMBERS: 'fg_members',
  TRAININGS: 'fg_trainings',
  FLAG_CEREMONIES: 'fg_flag_ceremonies',
  CHRONICLES: 'fg_chronicles',
  TUTORIALS: 'fg_tutorials',
  USER_INFO: 'fg_user_info'
};

var COLLECTIONS = {};
COLLECTIONS[KEYS.MEMBERS] = 'members';
COLLECTIONS[KEYS.TRAININGS] = 'trainings';
COLLECTIONS[KEYS.FLAG_CEREMONIES] = 'flag_ceremonies';
COLLECTIONS[KEYS.CHRONICLES] = 'chronicles';
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

function getInitialMemberPassword(member) {
  if (!member) {
    return DEFAULT_MEMBER_PASSWORD;
  }

  var studentId = member.studentId ? String(member.studentId).trim() : '';
  if (studentId) {
    return studentId;
  }

  var phone = member.phone ? String(member.phone).trim() : '';
  if (phone) {
    return phone;
  }

  return DEFAULT_MEMBER_PASSWORD;
}

function hasAdminPosition(position) {
  var positions = normalizePositions(position);
  return positions.some(function(item) {
    return ADMIN_POSITIONS.indexOf(item) !== -1;
  });
}

function hasSpecialPosition(position) {
  var positions = normalizePositions(position);
  return positions.some(function(item) {
    return SPECIAL_POSITION_OPTIONS.indexOf(item) !== -1;
  });
}

function canManageTutorial(position, category) {
  if (hasAdminPosition(position)) {
    return true;
  }

  return hasSpecialPosition(position) && normalizeTutorialCategory(category) === SPECIAL_TUTORIAL_CATEGORY;
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

function normalizeTutorialCategory(category) {
  var rawCategory = category ? String(category).trim() : '';

  if (!rawCategory) {
    return '';
  }

  if (TUTORIAL_CATEGORY_OPTIONS.indexOf(rawCategory) !== -1) {
    return rawCategory;
  }

  if (LEGACY_TUTORIAL_CATEGORY_MAP[rawCategory]) {
    return LEGACY_TUTORIAL_CATEGORY_MAP[rawCategory];
  }

  return '基础动作重点';
}

function enrichMember(member) {
  if (!member) return null;
  var positions = normalizePositions(member.position);
  return Object.assign({}, member, {
    password: member.password || getInitialMemberPassword(member),
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

function enrichTutorial(tutorial) {
  if (!tutorial) return null;
  return Object.assign({}, tutorial, {
    category: normalizeTutorialCategory(tutorial.category)
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
  if (key === KEYS.TUTORIALS) {
    return enrichTutorial(item);
  }
  return item;
}

function normalizeItemForStorage(key, item) {
  if (!item) {
    return item;
  }

  if (key === KEYS.MEMBERS) {
    return Object.assign({}, item, {
      password: item.password || getInitialMemberPassword(item)
    });
  }

  if (key === KEYS.TRAININGS) {
    var nextTraining = Object.assign({}, item);
    var hasTypeContext = Object.prototype.hasOwnProperty.call(item, 'type')
      || Object.prototype.hasOwnProperty.call(item, 'title');
    if (hasTypeContext) {
      nextTraining.type = normalizeTrainingType(item.type, item.title);
    }
    return nextTraining;
  }

  if (key === KEYS.TUTORIALS) {
    var nextTutorial = Object.assign({}, item);
    if (Object.prototype.hasOwnProperty.call(item, 'category')) {
      nextTutorial.category = normalizeTutorialCategory(item.category);
    }
    return nextTutorial;
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

async function warmupCloud() {
  return ensureCloud();
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
        password: getInitialMemberPassword(members[i]),
        updatedAt: Date.now()
      }
    });
  }
}

async function backfillTrainingTypes() {
  var collection = getCollection(KEYS.TRAININGS);
  var trainings = await fetchAll(collection);
  var linkedMakeupIds = {};

  for (var j = 0; j < trainings.length; j++) {
    var attendance = trainings[j].attendance || [];
    for (var k = 0; k < attendance.length; k++) {
      var record = attendance[k] || {};
      if (record.status === '璇峰亣' && record.makeupTrainingId) {
        linkedMakeupIds[record.makeupTrainingId] = true;
      }
    }
  }

  for (var i = 0; i < trainings.length; i++) {
    var normalizedType = normalizeTrainingType(trainings[i].type, trainings[i].title);
    if (!normalizedType && linkedMakeupIds[trainings[i].id]) {
      normalizedType = '琛ヨ';
    }
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

async function backfillTutorialCategories() {
  var collection = getCollection(KEYS.TUTORIALS);
  var tutorials = await fetchAll(collection);

  for (var i = 0; i < tutorials.length; i++) {
    var normalizedCategory = normalizeTutorialCategory(tutorials[i].category);
    if (!normalizedCategory || normalizedCategory === tutorials[i].category) {
      continue;
    }

    await collection.doc(tutorials[i]._id).update({
      data: {
        category: normalizedCategory,
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
    await backfillTutorialCategories();
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

async function getFirstByQuery(key, query) {
  await ensureReady();
  if (!query || !Object.keys(query).length) {
    return null;
  }

  var res = await getCollection(key).where(query).limit(1).get();
  if (!res.data || !res.data.length) {
    return null;
  }

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
  await ensureCloud();
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
  await ensureCloud();
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

async function removeMemberInCloud(id, options) {
  await ensureCloud();
  var settings = Object.assign({
    _docId: ''
  }, options || {});

  var res = await wx.cloud.callFunction({
    name: 'memberManage',
    data: {
      action: 'remove',
      id: id,
      docId: settings._docId || ''
    }
  });
  var result = res.result || {};
  if (!result.success) {
    throw new Error(result.message || '删除成员失败');
  }
  return result.removedMember || null;
}

async function deduplicateMembersInCloud() {
  await ensureCloud();
  var res = await wx.cloud.callFunction({
    name: 'memberManage',
    data: {
      action: 'deduplicate'
    }
  });
  var result = res.result || {};
  if (!result.success) {
    throw new Error(result.message || '人员去重失败');
  }
  return {
    removedCount: Number(result.removedCount || 0),
    groupCount: Number(result.groupCount || 0),
    duplicateGroups: result.duplicateGroups || []
  };
}

async function queryListPageInCloud(action, options) {
  await ensureCloud();
  var res = await wx.cloud.callFunction({
    name: 'listQuery',
    data: Object.assign({
      action: action
    }, options || {})
  });
  var result = res.result || {};

  if (!result.success) {
    throw new Error(result.message || 'List query failed');
  }

  return result;
}

async function queryMembersPage(options) {
  var result = await queryListPageInCloud('members', options);
  return {
    list: (result.list || []).map(enrichMember),
    page: Number(result.page || 1),
    pageSize: Number(result.pageSize || 0),
    total: Number(result.total || 0),
    hasMore: !!result.hasMore
  };
}

async function queryTrainingsPage(options) {
  var result = await queryListPageInCloud('trainings', options);
  return {
    list: (result.list || []).map(enrichTraining),
    page: Number(result.page || 1),
    pageSize: Number(result.pageSize || 0),
    total: Number(result.total || 0),
    hasMore: !!result.hasMore
  };
}

async function queryFlagsPage(options) {
  var result = await queryListPageInCloud('flags', options);
  return {
    list: (result.list || []),
    page: Number(result.page || 1),
    pageSize: Number(result.pageSize || 0),
    total: Number(result.total || 0),
    hasMore: !!result.hasMore
  };
}

async function queryChroniclesPage(options) {
  var result = await queryListPageInCloud('chroniclesByGrade', options);
  return {
    list: result.list || [],
    page: Number(result.page || 1),
    pageSize: Number(result.pageSize || 0),
    total: Number(result.total || 0),
    hasMore: !!result.hasMore
  };
}

async function queryChronicleGradeSummary() {
  var result = await queryListPageInCloud('chronicleGradeSummary');
  return Object.assign({}, result.countMap || {});
}

async function queryMeetingRecordsPage(options) {
  var result = await queryListPageInCloud('meetingRecords', options);
  return {
    list: result.list || [],
    page: Number(result.page || 1),
    pageSize: Number(result.pageSize || 0),
    total: Number(result.total || 0),
    hasMore: !!result.hasMore
  };
}

async function queryOfficeMaterialsPage(options) {
  var result = await queryListPageInCloud('officeMaterials', options);
  return {
    list: result.list || [],
    page: Number(result.page || 1),
    pageSize: Number(result.pageSize || 0),
    total: Number(result.total || 0),
    hasMore: !!result.hasMore
  };
}

async function getMemberMakeupSummary(memberId) {
  if (!memberId) {
    return {
      pendingCount: 0,
      upcomingCount: 0,
      totalCount: 0
    };
  }

  var result = await queryListPageInCloud('memberMakeupSummary', {
    memberId: memberId
  });

  return {
    pendingCount: Number(result.pendingCount || 0),
    upcomingCount: Number(result.upcomingCount || 0),
    totalCount: Number(result.totalCount || 0)
  };
}

async function getMemberMakeupRecords(memberId, options) {
  if (!memberId) {
    return {
      items: [],
      summary: {
        totalCount: 0,
        pendingCount: 0,
        upcomingCount: 0,
        completedCount: 0
      }
    };
  }

  var settings = Object.assign({
    pendingOnly: false
  }, options || {});
  var result = await queryListPageInCloud('memberMakeupRecords', {
    memberId: memberId,
    pendingOnly: !!settings.pendingOnly
  });

  return {
    items: result.items || [],
    summary: Object.assign({
      totalCount: 0,
      pendingCount: 0,
      upcomingCount: 0,
      completedCount: 0
    }, result.summary || {})
  };
}

async function getActiveMemberMakeupSummaries(options) {
  var settings = Object.assign({
    pendingOnly: false
  }, options || {});

  var result = await queryListPageInCloud('activeMemberMakeupSummaries', {
    pendingOnly: !!settings.pendingOnly
  });

  return {
    summaries: (result.summaries || []).map(enrichMember),
    today: result.today || ''
  };
}

async function getMakeupSelectionData(memberId, leaveTrainingId, attendanceIndex) {
  if (!memberId || !leaveTrainingId || typeof attendanceIndex !== 'number' || attendanceIndex < 0) {
    return {
      leaveItem: null,
      availableTrainings: [],
      currentSelectionId: '',
      today: ''
    };
  }

  var result = await queryListPageInCloud('makeupSelectionData', {
    memberId: memberId,
    leaveTrainingId: leaveTrainingId,
    attendanceIndex: attendanceIndex
  });

  return {
    leaveItem: result.leaveItem || null,
    availableTrainings: (result.availableTrainings || []).map(enrichTraining),
    currentSelectionId: result.currentSelectionId || '',
    today: result.today || ''
  };
}

async function assignMakeupTraining(options) {
  var settings = Object.assign({
    memberId: '',
    memberName: '',
    leaveTrainingId: '',
    attendanceIndex: -1,
    selectedTrainingId: '',
    requireFuture: false,
    markArrived: false
  }, options || {});

  return queryListPageInCloud('assignMakeupTraining', {
    memberId: settings.memberId,
    memberName: settings.memberName,
    leaveTrainingId: settings.leaveTrainingId,
    attendanceIndex: Number(settings.attendanceIndex),
    selectedTrainingId: settings.selectedTrainingId,
    requireFuture: !!settings.requireFuture,
    markArrived: !!settings.markArrived
  });
}

async function clearMakeupTraining(options) {
  var settings = Object.assign({
    memberId: '',
    leaveTrainingId: '',
    attendanceIndex: -1
  }, options || {});

  return queryListPageInCloud('clearMakeupTraining', {
    memberId: settings.memberId,
    leaveTrainingId: settings.leaveTrainingId,
    attendanceIndex: Number(settings.attendanceIndex)
  });
}

async function removeTrainingInCloud(id, options) {
  await ensureCloud();
  var settings = Object.assign({
    _docId: ''
  }, options || {});

  return queryListPageInCloud('removeTraining', {
    id: id,
    docId: settings._docId || ''
  });
}

async function update(key, id, data) {
  if (key === KEYS.MEMBERS) {
    await ensureCloud();
    var updatedMember = await updateMemberInCloud(id, data);
    if (updatedMember) {
      syncCurrentUserInfo(updatedMember);
    }
    return updatedMember;
  }

  await ensureReady();

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

async function remove(key, id, options) {
  if (key === KEYS.MEMBERS) {
    await ensureCloud();
    var removedMember = await removeMemberInCloud(id, options);
    var user = getUserInfo();
    if (user && removedMember && ((user.memberId && user.memberId === removedMember.id) || (user.studentId && user.studentId === removedMember.studentId))) {
      clearUserInfo();
    }
    return removedMember;
  }

  if (key === KEYS.TRAININGS) {
    await ensureCloud();
    return removeTrainingInCloud(id, options);
  }

  await ensureReady();

  var collection = getCollection(key);
  var docId = options && options._docId ? options._docId : '';

  if (docId) {
    await collection.doc(docId).remove();
    return;
  }

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

function clearLocalData() {
  var keys = Object.keys(KEYS).map(function(key) {
    return KEYS[key];
  });

  for (var i = 0; i < keys.length; i++) {
    wx.removeStorageSync(keys[i]);
  }
}

async function resetData() {
  clearLocalData();
}

async function batchUpdateMemberStatus(ids, status) {
  await ensureCloud();
  return batchUpdateMemberStatusInCloud(ids, status);
}

async function deduplicateMembers() {
  await ensureCloud();
  return deduplicateMembersInCloud();
}

async function resetAllMemberPasswordsToStudentId() {
  await ensureCloud();
  var res = await wx.cloud.callFunction({
    name: 'memberManage',
    data: {
      action: 'resetPasswordsToStudentId'
    }
  });
  var result = res.result || {};
  if (!result.success) {
    throw new Error(result.message || '批量重置密码失败');
  }
  return {
    updatedCount: Number(result.updatedCount || 0),
    skippedCount: Number(result.skippedCount || 0)
  };
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
  await ensureCloud();
  var user = getUserInfo();
  if (!user) {
    return null;
  }

  if (user.memberId) {
    var memberByIdRes = await getCollection(KEYS.MEMBERS).where({ id: user.memberId }).limit(1).get();
    if (memberByIdRes.data && memberByIdRes.data.length) {
      var memberById = Object.assign({}, memberByIdRes.data[0]);
      memberById._docId = memberById._id;
      delete memberById._id;
      return enrichMember(memberById);
    }
  }

  if (user.studentId) {
    var memberByStudentIdRes = await getCollection(KEYS.MEMBERS).where({
      studentId: user.studentId
    }).limit(1).get();
    if (memberByStudentIdRes.data && memberByStudentIdRes.data.length) {
      var memberByStudentId = Object.assign({}, memberByStudentIdRes.data[0]);
      memberByStudentId._docId = memberByStudentId._id;
      delete memberByStudentId._id;
      return enrichMember(memberByStudentId);
    }
  }

  if (user.studentId) {
    var memberByPhoneRes = await getCollection(KEYS.MEMBERS).where({
      phone: user.studentId
    }).limit(1).get();
    if (memberByPhoneRes.data && memberByPhoneRes.data.length) {
      var memberByPhone = Object.assign({}, memberByPhoneRes.data[0]);
      memberByPhone._docId = memberByPhone._id;
      delete memberByPhone._id;
      return enrichMember(memberByPhone);
    }
  }

  if (user.name) {
    var memberByNameRes = await getCollection(KEYS.MEMBERS).where({
      name: user.name
    }).limit(1).get();
    if (memberByNameRes.data && memberByNameRes.data.length) {
      var memberByName = Object.assign({}, memberByNameRes.data[0]);
      memberByName._docId = memberByName._id;
      delete memberByName._id;
      return enrichMember(memberByName);
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

async function loginByCredentials(account, password) {
  await ensureCloud();
  var identifier = account ? String(account).trim() : '';
  if (!identifier) {
    return null;
  }

  var memberRes = await getCollection(KEYS.MEMBERS).where({
    studentId: identifier
  }).limit(1).get();
  var member = memberRes.data && memberRes.data.length
    ? enrichMember(Object.assign({ _docId: memberRes.data[0]._id }, memberRes.data[0]))
    : null;

  if (!member) {
    var phoneMemberRes = await getCollection(KEYS.MEMBERS).where({
      phone: identifier
    }).limit(1).get();
    member = phoneMemberRes.data && phoneMemberRes.data.length
      ? enrichMember(Object.assign({ _docId: phoneMemberRes.data[0]._id }, phoneMemberRes.data[0]))
      : null;
  }

  if (member && member.password === password) {
    var role = hasAdminPosition(member.position) ? 'admin' : 'member';
    return {
      name: member.name,
      role: role,
      studentId: member.studentId,
      memberId: member.id
    };
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
    password: member.password || getInitialMemberPassword(member),
    position: positions,
    positionText: getPositionText(positions),
    isSpecialPosition: hasSpecialPosition(positions)
  });
};

module.exports = {
  KEYS: KEYS,
  POSITION_OPTIONS: POSITION_OPTIONS,
  TRAINING_TYPE_OPTIONS: TRAINING_TYPE_OPTIONS,
  TUTORIAL_CATEGORY_OPTIONS: TUTORIAL_CATEGORY_OPTIONS,
  SPECIAL_POSITION_OPTIONS: SPECIAL_POSITION_OPTIONS,
  SPECIAL_TUTORIAL_CATEGORY: SPECIAL_TUTORIAL_CATEGORY,
  DEPARTMENT_OPTIONS: DEPARTMENT_OPTIONS,
  ADMIN_POSITIONS: ADMIN_POSITIONS,
  DEFAULT_MEMBER_PASSWORD: DEFAULT_MEMBER_PASSWORD,
  initMockData: initMockData,
  resetData: resetData,
  clearLocalData: clearLocalData,
  getList: getList,
  getById: getById,
  getFirstByQuery: getFirstByQuery,
  add: add,
  update: update,
  remove: remove,
  batchUpdateMemberStatus: batchUpdateMemberStatus,
  deduplicateMembers: deduplicateMembers,
  resetAllMemberPasswordsToStudentId: resetAllMemberPasswordsToStudentId,
  warmupCloud: warmupCloud,
  queryMembersPage: queryMembersPage,
  queryTrainingsPage: queryTrainingsPage,
  queryFlagsPage: queryFlagsPage,
  queryChroniclesPage: queryChroniclesPage,
  queryChronicleGradeSummary: queryChronicleGradeSummary,
  queryMeetingRecordsPage: queryMeetingRecordsPage,
  queryOfficeMaterialsPage: queryOfficeMaterialsPage,
  getMemberMakeupSummary: getMemberMakeupSummary,
  getMemberMakeupRecords: getMemberMakeupRecords,
  getActiveMemberMakeupSummaries: getActiveMemberMakeupSummaries,
  getMakeupSelectionData: getMakeupSelectionData,
  assignMakeupTraining: assignMakeupTraining,
  clearMakeupTraining: clearMakeupTraining,
  removeTrainingInCloud: removeTrainingInCloud,
  normalizePositions: normalizePositions,
  getInitialMemberPassword: getInitialMemberPassword,
  getPositionText: getPositionText,
  hasAdminPosition: hasAdminPosition,
  hasSpecialPosition: hasSpecialPosition,
  canManageTutorial: canManageTutorial,
  isMemberActive: isMemberActive,
  normalizeTrainingType: normalizeTrainingType,
  normalizeTutorialCategory: normalizeTutorialCategory,
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
