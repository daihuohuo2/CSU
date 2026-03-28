var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var memberSorter = require('../../../utils/member-sort');

var LEGACY_QUEUE_MEMBER_IDS = ['m001', 'm002', 'm003'];
var NORMAL_STATUS = '正常';

function isRaiseFlagType(type) {
  return String(type || '').indexOf('升') !== -1;
}

function buildAttendanceMap(attendance) {
  var map = {};
  (attendance || []).forEach(function(item) {
    if (item && item.memberId) {
      map[item.memberId] = item;
    }
  });
  return map;
}

function buildMemberMap(members) {
  var map = {};
  (members || []).forEach(function(member) {
    if (member && member.id) {
      map[member.id] = member;
    }
  });
  return map;
}

function buildSelectedInactiveMembers(allMembers, attendanceMap, activeMembers) {
  var memberMap = buildMemberMap(allMembers);
  var activeIds = {};
  (activeMembers || []).forEach(function(member) {
    if (member && member.id) {
      activeIds[member.id] = true;
    }
  });

  return Object.keys(attendanceMap || {}).filter(function(memberId) {
    return !activeIds[memberId];
  }).map(function(memberId) {
    var source = memberMap[memberId] || {};
    var record = attendanceMap[memberId] || {};
    var merged = storage.enrichMember(Object.assign({}, source, {
      id: memberId,
      name: source.name || record.name || '未知成员',
      position: source.position || [],
      grade: source.grade || '',
      joinDate: source.joinDate || '',
      studentId: source.studentId || '',
      status: source.status || '离队'
    }));
    return Object.assign({}, merged, {
      checked: false
    });
  });
}

function resolveQueueMemberIds(detail) {
  if (!detail) {
    return [];
  }

  if (Array.isArray(detail.queueMemberIds) && detail.queueMemberIds.length) {
    return detail.queueMemberIds.slice();
  }

  if (isRaiseFlagType(detail.type)) {
    return LEGACY_QUEUE_MEMBER_IDS.slice();
  }

  return (detail.attendance || []).map(function(item) {
    return item.memberId;
  });
}

Page({
  data: {
    isEdit: false,
    editId: '',
    editDocId: '',
    originalAttendance: [],
    title: '',
    type: '',
    isRaiseFlag: false,
    date: '',
    time: '',
    location: '',
    description: '',
    typeOptions: ['升旗', '降旗'],
    members: [],
    audienceMembers: [],
    queueMemberCount: 0
  },

  onLoad: async function(options) {
    if (!storage.isAdmin()) {
      util.showToast('仅管理员可操作升降旗日程');
      setTimeout(function() {
        wx.navigateBack({
          fail: function() {
            wx.reLaunch({ url: '/pages/index/index' });
          }
        });
      }, 1200);
      return;
    }

    try {
      var allMembers = storage.enrichMembers(await storage.getList(storage.KEYS.MEMBERS));
      var activeMembers = memberSorter.sortMembersForAssignment(
        allMembers.filter(storage.isMemberActive)
      ).map(function(member) {
        return Object.assign({}, member, { checked: false });
      });

      var nextMembers = activeMembers;
      var nextData = {};

      if (options && options.id) {
        var detail = await storage.getById(storage.KEYS.FLAG_CEREMONIES, options.id);
        if (!detail) {
          util.showToast('未找到升降旗日程');
          return;
        }

        var attendanceMap = buildAttendanceMap(detail.attendance || []);
        var queueMemberIds = resolveQueueMemberIds(detail);
        var queueIdMap = {};
        queueMemberIds.forEach(function(memberId) {
          queueIdMap[memberId] = true;
        });

        var extraMembers = buildSelectedInactiveMembers(allMembers, attendanceMap, activeMembers);
        nextMembers = memberSorter.sortMembersForAssignment(activeMembers.concat(extraMembers)).map(function(member) {
          return Object.assign({}, member, {
            checked: !!queueIdMap[member.id]
          });
        });

        nextData = {
          isEdit: true,
          editId: detail.id,
          editDocId: detail._docId || '',
          originalAttendance: (detail.attendance || []).slice(),
          title: detail.title || '',
          type: detail.type || '',
          isRaiseFlag: isRaiseFlagType(detail.type),
          date: detail.date || '',
          time: detail.time || '',
          location: detail.location || '',
          description: detail.description || ''
        };

        wx.setNavigationBarTitle({
          title: '编辑升降旗日程'
        });
      }

      this.setData(Object.assign({
        members: nextMembers,
        audienceMembers: this.getAudienceMembers(nextMembers, nextData.isRaiseFlag),
        queueMemberCount: this.getQueueMemberCount(nextMembers)
      }, nextData));
    } catch (err) {
      console.error(err);
      util.showToast('加载成员失败');
    }
  },

  getAudienceMembers: function(members, isRaiseFlag) {
    if (!isRaiseFlag) {
      return [];
    }

    return (members || []).filter(function(member) {
      return !member.checked;
    });
  },

  getQueueMemberCount: function(members) {
    return (members || []).filter(function(member) {
      return member.checked;
    }).length;
  },

  onInput: function(e) {
    var obj = {};
    obj[e.currentTarget.dataset.field] = e.detail.value;
    this.setData(obj);
  },

  onTypePick: function(e) {
    if (this.data.isEdit) {
      return;
    }

    var type = this.data.typeOptions[e.detail.value];
    var isRaiseFlag = isRaiseFlagType(type);
    this.setData({
      type: type,
      isRaiseFlag: isRaiseFlag,
      audienceMembers: this.getAudienceMembers(this.data.members, isRaiseFlag)
    });
  },

  onDatePick: function(e) {
    this.setData({ date: e.detail.value });
  },

  toggleMember: function(e) {
    var index = e.currentTarget.dataset.index;
    var members = this.data.members.slice();
    members[index] = Object.assign({}, members[index], {
      checked: !!e.detail.value
    });

    this.setData({
      members: members,
      audienceMembers: this.getAudienceMembers(members, this.data.isRaiseFlag),
      queueMemberCount: this.getQueueMemberCount(members)
    });
  },

  updateFlagRecord: async function(flagId, docId, payload) {
    await storage.update(storage.KEYS.FLAG_CEREMONIES, flagId, Object.assign({
      _docId: docId || ''
    }, payload));
  },

  handleSubmit: async function() {
    if (!this.data.title.trim()) {
      util.showToast('请输入任务标题');
      return;
    }
    if (!this.data.type) {
      util.showToast('请选择任务类型');
      return;
    }
    if (!this.data.date) {
      util.showToast('请选择日期');
      return;
    }

    var queueMembers = this.data.members.filter(function(member) {
      return member.checked;
    });
    if (queueMembers.length === 0) {
      util.showToast('请至少选择一名上岗成员');
      return;
    }

    var isRaiseFlag = isRaiseFlagType(this.data.type);
    var audienceMembers = isRaiseFlag ? this.getAudienceMembers(this.data.members, true) : [];
    var attendanceMembers = isRaiseFlag ? queueMembers.concat(audienceMembers) : queueMembers;
    var attendanceMap = buildAttendanceMap(this.data.originalAttendance || []);
    var attendance = attendanceMembers.map(function(member) {
      var existingRecord = attendanceMap[member.id];
      if (existingRecord) {
        return Object.assign({}, existingRecord, {
          name: member.name
        });
      }

      return {
        memberId: member.id,
        name: member.name,
        status: NORMAL_STATUS
      };
    });

    var payload = {
      title: this.data.title.trim(),
      type: this.data.type,
      date: this.data.date,
      time: this.data.time || '',
      location: this.data.location || '',
      description: this.data.description || '',
      queueMemberIds: queueMembers.map(function(member) { return member.id; }),
      audienceMemberIds: isRaiseFlag ? audienceMembers.map(function(member) { return member.id; }) : [],
      attendance: attendance
    };

    try {
      if (this.data.isEdit) {
        await this.updateFlagRecord(this.data.editId, this.data.editDocId, payload);
        util.showToast('修改成功', 'success');
      } else {
        var userInfo = storage.getUserInfo();
        var item = Object.assign({
          id: util.generateId('f'),
          createdBy: userInfo ? userInfo.name : 'admin'
        }, payload);
        await storage.add(storage.KEYS.FLAG_CEREMONIES, item);
        util.showToast('创建成功', 'success');
      }

      setTimeout(function() {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error(err);
      util.showToast(this.data.isEdit ? '修改失败' : '创建失败');
    }
  }
});
