const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION_NAME = 'office_tasks';
const DEPARTMENT_KEY = 'office';
const FETCH_LIMIT = 100;

function normalizeText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
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

function normalizeAssignees(assignees) {
  var list = Array.isArray(assignees) ? assignees : [];
  var ids = [];

  return list.map(function(item) {
    return {
      memberId: normalizeText(item.memberId),
      name: normalizeText(item.name)
    };
  }).filter(function(item) {
    if (!item.memberId || ids.indexOf(item.memberId) !== -1) {
      return false;
    }
    ids.push(item.memberId);
    return true;
  });
}

function normalizeSubmissions(submissions) {
  var list = Array.isArray(submissions) ? submissions : [];
  var latestMap = {};

  list.forEach(function(item) {
    var memberId = normalizeText(item.memberId);
    if (!memberId) {
      return;
    }

    var normalized = {
      memberId: memberId,
      name: normalizeText(item.name),
      fileID: normalizeText(item.fileID),
      fileName: normalizeText(item.fileName),
      fileExt: normalizeText(item.fileExt || getExtension(item.fileName)),
      fileTypeLabel: normalizeText(item.fileTypeLabel || getFileTypeLabel(item.fileName)),
      submittedAt: Number(item.submittedAt || 0)
    };

    if (!latestMap[memberId] || normalized.submittedAt >= latestMap[memberId].submittedAt) {
      latestMap[memberId] = normalized;
    }
  });

  return Object.keys(latestMap).map(function(memberId) {
    return latestMap[memberId];
  }).sort(function(a, b) {
    return Number(b.submittedAt || 0) - Number(a.submittedAt || 0);
  });
}

function enrichTask(task, memberId) {
  var assignees = normalizeAssignees(task.assignees);
  var submissions = normalizeSubmissions(task.submissions);
  var assigneeMap = {};
  var submissionMap = {};

  assignees.forEach(function(item) {
    assigneeMap[item.memberId] = item;
  });
  submissions.forEach(function(item) {
    submissionMap[item.memberId] = item;
  });

  var completedCount = assignees.filter(function(item) {
    return !!submissionMap[item.memberId];
  }).length;
  var totalCount = assignees.length;
  var pendingCount = Math.max(totalCount - completedCount, 0);
  var currentMemberId = normalizeText(memberId);
  var memberSubmission = currentMemberId ? (submissionMap[currentMemberId] || null) : null;
  var isAssignedToMember = !!(currentMemberId && assigneeMap[currentMemberId]);

  return {
    id: normalizeText(task.id),
    _docId: task._id || task._docId || '',
    departmentKey: normalizeText(task.departmentKey || DEPARTMENT_KEY),
    title: normalizeText(task.title),
    dueDate: normalizeText(task.dueDate),
    createdBy: normalizeText(task.createdBy),
    createdAt: Number(task.createdAt || 0),
    updatedAt: Number(task.updatedAt || 0),
    assignees: assignees,
    submissions: submissions,
    totalCount: totalCount,
    completedCount: completedCount,
    pendingCount: pendingCount,
    isCompleted: totalCount > 0 && pendingCount === 0,
    isAssignedToMember: isAssignedToMember,
    isSubmittedForMember: !!memberSubmission,
    memberSubmission: memberSubmission
  };
}

function compareActiveTasks(a, b) {
  var dueCompare = normalizeText(a.dueDate).localeCompare(normalizeText(b.dueDate));
  if (dueCompare !== 0) {
    return dueCompare;
  }

  return Number(b.createdAt || 0) - Number(a.createdAt || 0);
}

function compareCompletedTasks(a, b) {
  return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0);
}

async function fetchAll(query) {
  var result = [];
  var offset = 0;
  var hasQuery = query && Object.keys(query).length > 0;

  while (true) {
    var ref = hasQuery ? db.collection(COLLECTION_NAME).where(query) : db.collection(COLLECTION_NAME);
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

async function findTask(taskId, docId) {
  var collection = db.collection(COLLECTION_NAME);

  if (docId) {
    try {
      var docRes = await collection.doc(docId).get();
      if (docRes && docRes.data) {
        return docRes.data;
      }
    } catch (err) {
      console.warn('office task doc lookup failed', err);
    }
  }

  if (!taskId) {
    return null;
  }

  var res = await collection.where({ id: taskId }).limit(1).get();
  return (res.data && res.data[0]) || null;
}

async function listTasks(event) {
  var departmentKey = normalizeText(event.departmentKey || DEPARTMENT_KEY);
  var memberId = normalizeText(event.memberId);
  var tasks = (await fetchAll({
    departmentKey: departmentKey
  })).map(function(task) {
    return enrichTask(task, memberId);
  });

  if (memberId) {
    tasks = tasks.filter(function(task) {
      return task.isAssignedToMember;
    });

    return {
      success: true,
      pendingTasks: tasks.filter(function(task) {
        return !task.isSubmittedForMember;
      }).sort(compareActiveTasks),
      completedTasks: tasks.filter(function(task) {
        return task.isSubmittedForMember;
      }).sort(compareCompletedTasks)
    };
  }

  return {
    success: true,
    pendingTasks: tasks.filter(function(task) {
      return !task.isCompleted;
    }).sort(compareActiveTasks),
    completedTasks: tasks.filter(function(task) {
      return task.isCompleted;
    }).sort(compareCompletedTasks)
  };
}

async function getTaskDetail(event) {
  var task = await findTask(normalizeText(event.taskId), normalizeText(event.docId));
  if (!task) {
    throw new Error('未找到对应任务');
  }

  return {
    success: true,
    task: enrichTask(task, normalizeText(event.memberId))
  };
}

async function createTask(event) {
  var title = normalizeText(event.title);
  var dueDate = normalizeText(event.dueDate);
  var assignees = normalizeAssignees(event.assignees);

  if (!title) {
    throw new Error('任务名称不能为空');
  }
  if (!dueDate) {
    throw new Error('请先选择截止日期');
  }
  if (!assignees.length) {
    throw new Error('请至少选择一名成员');
  }

  var now = Date.now();
  var data = {
    id: normalizeText(event.id) || ('task_' + now),
    departmentKey: DEPARTMENT_KEY,
    title: title,
    dueDate: dueDate,
    assignees: assignees,
    submissions: [],
    createdBy: normalizeText(event.createdBy),
    createdAt: now,
    updatedAt: now
  };

  await db.collection(COLLECTION_NAME).add({
    data: data
  });

  return {
    success: true,
    task: enrichTask(data)
  };
}

async function submitTask(event) {
  var task = await findTask(normalizeText(event.taskId), normalizeText(event.docId));
  if (!task) {
    throw new Error('未找到对应任务');
  }

  var memberId = normalizeText(event.memberId);
  var fileID = normalizeText(event.fileID);
  var fileName = normalizeText(event.fileName);

  if (!memberId || !fileID || !fileName) {
    throw new Error('提交参数不完整');
  }

  var assignees = normalizeAssignees(task.assignees);
  var assignedMember = null;
  for (var i = 0; i < assignees.length; i++) {
    if (assignees[i].memberId === memberId) {
      assignedMember = assignees[i];
      break;
    }
  }

  if (!assignedMember) {
    throw new Error('当前任务未分配给该成员');
  }

  var submissions = normalizeSubmissions(task.submissions);
  var previousFileID = '';
  var nextSubmission = {
    memberId: memberId,
    name: assignedMember.name || normalizeText(event.memberName),
    fileID: fileID,
    fileName: fileName,
    fileExt: getExtension(fileName),
    fileTypeLabel: getFileTypeLabel(fileName),
    submittedAt: Date.now()
  };

  var replaced = false;
  for (var j = 0; j < submissions.length; j++) {
    if (submissions[j].memberId === memberId) {
      previousFileID = normalizeText(submissions[j].fileID);
      submissions[j] = nextSubmission;
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    submissions.push(nextSubmission);
  }

  await db.collection(COLLECTION_NAME).doc(task._id).update({
    data: {
      submissions: submissions,
      updatedAt: Date.now()
    }
  });

  return {
    success: true,
    previousFileID: previousFileID,
    task: enrichTask(Object.assign({}, task, {
      submissions: submissions,
      updatedAt: Date.now()
    }), memberId)
  };
}

exports.main = async function(event) {
  try {
    var action = normalizeText(event.action);

    if (action === 'listTasks') {
      return await listTasks(event);
    }

    if (action === 'getTaskDetail') {
      return await getTaskDetail(event);
    }

    if (action === 'createTask') {
      return await createTask(event);
    }

    if (action === 'submitTask') {
      return await submitTask(event);
    }

    throw new Error('Unsupported office task action');
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: err.message || 'Office task manage failed'
    };
  }
};
