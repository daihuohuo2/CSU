const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const LEAVE_COLLECTION = 'leave_applications';
const TRAINING_COLLECTION = 'trainings';
const MEMBER_COLLECTION = 'members';
const STATUS_PENDING = '\u5f85\u5ba1\u6279';
const STATUS_APPROVED = '\u5df2\u901a\u8fc7';
const ATTENDANCE_STATUS_LEAVE = '\u8bf7\u5047';

function normalizeText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
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

async function getTrainingById(trainingId) {
  const res = await db.collection(TRAINING_COLLECTION).where({
    id: trainingId
  }).limit(1).get();

  return res.data && res.data[0] ? res.data[0] : null;
}

async function getMemberById(memberId) {
  const res = await db.collection(MEMBER_COLLECTION).where({
    id: memberId
  }).limit(1).get();

  return res.data && res.data[0] ? res.data[0] : null;
}

async function getApplicationById(applicationId, docId) {
  if (docId) {
    try {
      const docRes = await db.collection(LEAVE_COLLECTION).doc(docId).get();
      if (docRes && docRes.data) {
        return docRes.data;
      }
    } catch (err) {
      console.warn('leave application doc lookup failed', err);
    }
  }

  if (!applicationId) {
    return null;
  }

  const res = await db.collection(LEAVE_COLLECTION).where({
    id: applicationId
  }).limit(1).get();

  return res.data && res.data[0] ? res.data[0] : null;
}

exports.main = async function(event) {
  try {
    const action = normalizeText(event.action);

    if (action === 'submit') {
      const trainingId = normalizeText(event.trainingId);
      const memberId = normalizeText(event.memberId);
      const reason = normalizeText(event.reason);
      const proofs = normalizeProofs(event.proofs);
      const now = Date.now();

      if (!trainingId) {
        throw new Error('\u7f3a\u5c11\u8bad\u7ec3\u65e5\u7a0bID');
      }
      if (!memberId) {
        throw new Error('\u7f3a\u5c11\u6210\u5458ID');
      }
      if (!reason) {
        throw new Error('\u8bf7\u586b\u5199\u8bf7\u5047\u7406\u7531');
      }

      const training = await getTrainingById(trainingId);
      if (!training) {
        throw new Error('\u672a\u627e\u5230\u5bf9\u5e94\u8bad\u7ec3\u65e5\u7a0b');
      }

      const member = await getMemberById(memberId);
      if (!member) {
        throw new Error('\u672a\u627e\u5230\u5f53\u524d\u6210\u5458\u6863\u6848');
      }

      const attendance = Array.isArray(training.attendance) ? training.attendance : [];
      const attendanceRecord = attendance.find(function(item) {
        return item && normalizeText(item.memberId) === memberId;
      });

      if (!attendanceRecord) {
        throw new Error('\u4f60\u4e0d\u5728\u8be5\u8bad\u7ec3\u65e5\u7a0b\u7684\u53c2\u4e0e\u6210\u5458\u5217\u8868\u4e2d');
      }

      const existingRes = await db.collection(LEAVE_COLLECTION).where({
        trainingId: trainingId,
        memberId: memberId
      }).limit(1).get();
      const existing = existingRes.data && existingRes.data[0] ? existingRes.data[0] : null;

      if (existing && normalizeText(existing.status) === STATUS_APPROVED) {
        throw new Error('\u8be5\u8bf7\u5047\u7533\u8bf7\u5df2\u901a\u8fc7\u5ba1\u6279');
      }

      const payload = {
        trainingId: trainingId,
        trainingDocId: normalizeText(training._id),
        trainingTitle: normalizeText(training.title),
        trainingType: normalizeText(training.type),
        trainingDate: normalizeText(training.date),
        trainingTime: normalizeText(training.time),
        trainingLocation: normalizeText(training.location),
        memberId: memberId,
        memberName: normalizeText(member.name) || normalizeText(attendanceRecord.name),
        memberStudentId: normalizeText(member.studentId),
        memberDepartment: normalizeText(member.department),
        reason: reason,
        proofs: proofs,
        status: STATUS_PENDING,
        approvedAt: 0,
        approvedBy: '',
        approverMemberId: '',
        updatedAt: now
      };

      if (existing) {
        await db.collection(LEAVE_COLLECTION).doc(existing._id).update({
          data: payload
        });

        return {
          success: true,
          id: existing.id,
          docId: existing._id
        };
      }

      const id = normalizeText(event.id) || ('leave_' + now + '_' + Math.random().toString(36).slice(2, 8));
      await db.collection(LEAVE_COLLECTION).add({
        data: Object.assign({}, payload, {
          id: id,
          createdAt: now
        })
      });

      return {
        success: true,
        id: id
      };
    }

    if (action === 'approve') {
      const applicationId = normalizeText(event.applicationId);
      const docId = normalizeText(event.docId);
      const approverName = normalizeText(event.approverName);
      const approverMemberId = normalizeText(event.approverMemberId);
      const now = Date.now();

      const application = await getApplicationById(applicationId, docId);
      if (!application) {
        throw new Error('\u672a\u627e\u5230\u8bf7\u5047\u7533\u8bf7');
      }

      const trainingDocId = normalizeText(application.trainingDocId);
      const leaveDocId = normalizeText(application._id);
      if (!trainingDocId || !leaveDocId) {
        throw new Error('\u8bf7\u5047\u7533\u8bf7\u7f3a\u5c11\u5173\u952e\u5173\u8054\u4fe1\u606f');
      }

      await db.runTransaction(async function(transaction) {
        const applicationDoc = await transaction.collection(LEAVE_COLLECTION).doc(leaveDocId).get();
        const currentApplication = applicationDoc.data || null;
        if (!currentApplication) {
          throw new Error('\u8bf7\u5047\u7533\u8bf7\u4e0d\u5b58\u5728');
        }

        const trainingDoc = await transaction.collection(TRAINING_COLLECTION).doc(trainingDocId).get();
        const training = trainingDoc.data || null;
        if (!training) {
          throw new Error('\u5bf9\u5e94\u8bad\u7ec3\u65e5\u7a0b\u4e0d\u5b58\u5728');
        }

        const attendance = Array.isArray(training.attendance) ? training.attendance.slice() : [];
        const targetIndex = attendance.findIndex(function(item) {
          return item && normalizeText(item.memberId) === normalizeText(currentApplication.memberId);
        });

        if (targetIndex === -1) {
          throw new Error('\u672a\u627e\u5230\u8be5\u6210\u5458\u7684\u8bad\u7ec3\u8003\u52e4\u8bb0\u5f55');
        }

        const currentRecord = Object.assign({}, attendance[targetIndex], {
          status: ATTENDANCE_STATUS_LEAVE,
          leaveApplicationId: normalizeText(currentApplication.id)
        });
        attendance[targetIndex] = currentRecord;

        await transaction.collection(TRAINING_COLLECTION).doc(trainingDoc._id).update({
          data: {
            attendance: attendance,
            updatedAt: now
          }
        });

        await transaction.collection(LEAVE_COLLECTION).doc(leaveDocId).update({
          data: {
            status: STATUS_APPROVED,
            approvedAt: now,
            approvedBy: approverName,
            approverMemberId: approverMemberId,
            updatedAt: now
          }
        });
      });

      return {
        success: true
      };
    }

    throw new Error('\u4e0d\u652f\u6301\u7684\u8bf7\u5047\u64cd\u4f5c');
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: err.message || '\u8bf7\u5047\u7533\u8bf7\u64cd\u4f5c\u5931\u8d25'
    };
  }
};
