const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const MEMBER_COLLECTION = 'members';

function sanitizeMemberData(data) {
  var payload = Object.assign({}, data || {});
  delete payload._docId;
  delete payload._id;
  delete payload.positionText;
  payload.updatedAt = Date.now();
  return payload;
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

    throw new Error('不支持的成员管理操作');
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: err.message || '成员更新失败'
    };
  }
};
