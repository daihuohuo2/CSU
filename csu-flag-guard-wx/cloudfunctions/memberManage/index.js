const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const MEMBER_COLLECTION = 'members';
const TRAINING_COLLECTION = 'trainings';
const FLAG_COLLECTION = 'flag_ceremonies';
const OFFICE_TASK_COLLECTION = 'office_tasks';
const FETCH_LIMIT = 100;

function normalizeText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function sanitizeMemberData(data) {
  var payload = Object.assign({}, data || {});
  delete payload._docId;
  delete payload._id;
  delete payload.positionText;
  payload.updatedAt = Date.now();
  return payload;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.slice() : [];
}

function normalizePositions(position) {
  return normalizeArray(position).map(function(item) {
    return normalizeText(item);
  }).filter(Boolean).sort();
}

function buildMemberSignature(member) {
  var payload = {
    name: normalizeText(member.name),
    gender: normalizeText(member.gender),
    studentId: normalizeText(member.studentId),
    college: normalizeText(member.college),
    major: normalizeText(member.major),
    grade: normalizeText(member.grade),
    className: normalizeText(member.className),
    department: normalizeText(member.department),
    phone: normalizeText(member.phone),
    wechat: normalizeText(member.wechat),
    joinDate: normalizeText(member.joinDate),
    position: normalizePositions(member.position),
    status: normalizeText(member.status),
    remark: normalizeText(member.remark)
  };

  return JSON.stringify(payload);
}

async function fetchAll(collectionName) {
  var result = [];
  var offset = 0;

  while (true) {
    var res = await db.collection(collectionName).skip(offset).limit(FETCH_LIMIT).get();
    var data = res.data || [];
    result = result.concat(data);

    if (data.length < FETCH_LIMIT) {
      break;
    }
    offset += data.length;
  }

  return result;
}

async function safeFetchAll(collectionName) {
  try {
    return await fetchAll(collectionName);
  } catch (err) {
    console.warn('safeFetchAll failed for collection:', collectionName, err);
    return [];
  }
}

function countMemberReferences(memberId, trainings, flags, officeTasks) {
  var count = 0;

  (trainings || []).forEach(function(training) {
    (training.attendance || []).forEach(function(record) {
      if (record && record.memberId === memberId) {
        count += 1;
      }
    });
  });

  (flags || []).forEach(function(flag) {
    (flag.attendance || []).forEach(function(record) {
      if (record && record.memberId === memberId) {
        count += 1;
      }
    });

    if (normalizeArray(flag.queueMemberIds).indexOf(memberId) !== -1) {
      count += 1;
    }
    if (normalizeArray(flag.audienceMemberIds).indexOf(memberId) !== -1) {
      count += 1;
    }
  });

  (officeTasks || []).forEach(function(task) {
    (task.assignees || []).forEach(function(item) {
      if (item && item.memberId === memberId) {
        count += 1;
      }
    });

    (task.submissions || []).forEach(function(item) {
      if (item && item.memberId === memberId) {
        count += 1;
      }
    });
  });

  return count;
}

function compareDuplicateCandidates(a, b) {
  if (a.referenceCount !== b.referenceCount) {
    return b.referenceCount - a.referenceCount;
  }

  var aCreated = Number(a.createdAt || 0);
  var bCreated = Number(b.createdAt || 0);
  if (aCreated !== bCreated) {
    return aCreated - bCreated;
  }

  return normalizeText(a._id).localeCompare(normalizeText(b._id));
}

exports.main = async function(event) {
  try {
    var action = event.action;

    if (action === 'update') {
      var id = event.id;
      var docId = event.docId;
      var data = sanitizeMemberData(event.data);

      if (!id) {
        throw new Error('缺少成员ID');
      }

      if (!docId) {
        var target = await db.collection(MEMBER_COLLECTION).where({ id: id }).limit(1).get();
        if (!target.data || !target.data.length) {
          throw new Error('未找到要更新的成员记录');
        }
        docId = target.data[0]._id;
      }

      var updateRes = await db.collection(MEMBER_COLLECTION).doc(docId).update({
        data: data
      });

      if (!updateRes.stats || !updateRes.stats.updated) {
        throw new Error('成员记录未更新');
      }

      var memberRes = await db.collection(MEMBER_COLLECTION).doc(docId).get();
      var member = memberRes.data || null;
      if (member) {
        member._docId = member._id;
        delete member._id;
      }

      return {
        success: true,
        member: member
      };
    }

    if (action === 'batchUpdateStatus') {
      var ids = Array.isArray(event.ids) ? event.ids.filter(Boolean) : [];
      var status = event.status;

      if (!ids.length) {
        throw new Error('未选择成员');
      }
      if (status !== '在队' && status !== '离队') {
        throw new Error('成员状态不合法');
      }

      var batchRes = await db.collection(MEMBER_COLLECTION).where({
        id: _.in(ids)
      }).update({
        data: {
          status: status,
          updatedAt: Date.now()
        }
      });

      return {
        success: true,
        updatedCount: batchRes.stats ? batchRes.stats.updated : 0
      };
    }

    if (action === 'resetPasswordsToStudentId') {
      var now = Date.now();
      var offset = 0;
      var limit = 100;
      var updatedCount = 0;
      var skippedCount = 0;

      while (true) {
        var res = await db.collection(MEMBER_COLLECTION).skip(offset).limit(limit).get();
        var members = res.data || [];

        for (var i = 0; i < members.length; i++) {
          var member = members[i] || {};
          var studentId = normalizeText(member.studentId);
          if (!studentId) {
            skippedCount += 1;
            continue;
          }

          if (member.password === studentId) {
            continue;
          }

          await db.collection(MEMBER_COLLECTION).doc(member._id).update({
            data: {
              password: studentId,
              updatedAt: now
            }
          });
          updatedCount += 1;
        }

        if (members.length < limit) {
          break;
        }
        offset += members.length;
      }

      return {
        success: true,
        updatedCount: updatedCount,
        skippedCount: skippedCount
      };
    }

    if (action === 'remove') {
      var removeId = normalizeText(event.id);
      var removeDocId = normalizeText(event.docId);
      var targetMember = null;

      if (removeDocId) {
        try {
          var docRes = await db.collection(MEMBER_COLLECTION).doc(removeDocId).get();
          targetMember = docRes && docRes.data ? docRes.data : null;
        } catch (err) {
          console.warn('member doc lookup failed', err);
        }
      }

      if (!targetMember && removeId) {
        var memberRes = await db.collection(MEMBER_COLLECTION).where({ id: removeId }).limit(1).get();
        targetMember = memberRes.data && memberRes.data[0] ? memberRes.data[0] : null;
      }

      if (!targetMember) {
        throw new Error('未找到要删除的成员');
      }

      await db.collection(MEMBER_COLLECTION).doc(targetMember._id).remove();

      return {
        success: true,
        removedMember: {
          id: normalizeText(targetMember.id),
          studentId: normalizeText(targetMember.studentId)
        }
      };
    }

    if (action === 'deduplicate') {
      var members = await safeFetchAll(MEMBER_COLLECTION);
      var trainings = await safeFetchAll(TRAINING_COLLECTION);
      var flags = await safeFetchAll(FLAG_COLLECTION);
      var officeTasks = await safeFetchAll(OFFICE_TASK_COLLECTION);
      var groups = {};
      var duplicateGroups = [];
      var removedCount = 0;

      members.forEach(function(member) {
        var signature = buildMemberSignature(member);
        if (!signature) {
          return;
        }

        if (!groups[signature]) {
          groups[signature] = [];
        }

        groups[signature].push(Object.assign({}, member, {
          referenceCount: countMemberReferences(normalizeText(member.id), trainings, flags, officeTasks)
        }));
      });

      var signatures = Object.keys(groups);
      for (var groupIndex = 0; groupIndex < signatures.length; groupIndex++) {
        var signature = signatures[groupIndex];
        var group = groups[signature] || [];
        if (group.length <= 1) {
          continue;
        }

        group.sort(compareDuplicateCandidates);
        var keepMember = group[0];
        var removedMembers = [];

        for (var memberIndex = 1; memberIndex < group.length; memberIndex++) {
          await db.collection(MEMBER_COLLECTION).doc(group[memberIndex]._id).remove();
          removedMembers.push({
            id: normalizeText(group[memberIndex].id),
            name: normalizeText(group[memberIndex].name)
          });
          removedCount += 1;
        }

        duplicateGroups.push({
          keep: {
            id: normalizeText(keepMember.id),
            name: normalizeText(keepMember.name)
          },
          removed: removedMembers
        });
      }

      return {
        success: true,
        removedCount: removedCount,
        groupCount: duplicateGroups.length,
        duplicateGroups: duplicateGroups.slice(0, 10)
      };
    }

    throw new Error('不支持的成员管理操作');
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: err.message || '成员更新失败'
    };
  }
};
