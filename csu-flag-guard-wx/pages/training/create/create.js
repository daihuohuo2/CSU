var storage = require('../../../utils/storage');
var util = require('../../../utils/util');
var memberSorter = require('../../../utils/member-sort');
var makeupHelper = require('../../../utils/makeup');

var MAKEUP_TYPE = '补训';
var ARRIVED_STATUS = '已到';

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
      checked: true
    });
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
    date: '',
    time: '',
    location: '',
    description: '',
    typeOptions: storage.TRAINING_TYPE_OPTIONS.slice(),
    typePlaceholder: '请选择训练类型',
    datePlaceholder: '请选择日期',
    members: [],
    selectedCount: 0,
    isMakeupTraining: false
  },

  onLoad: async function(options) {
    if (!storage.isAdmin()) {
      util.showToast('仅管理员可操作训练日程');
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
        return Object.assign({}, member, { checked: true });
      });

      var nextData = {
        members: activeMembers,
        selectedCount: activeMembers.length
      };

      if (options && options.id) {
        var detail = await storage.getById(storage.KEYS.TRAININGS, options.id);
        if (!detail) {
          util.showToast('未找到训练日程');
          return;
        }

        var attendanceMap = buildAttendanceMap(detail.attendance || []);
        var extraMembers = buildSelectedInactiveMembers(allMembers, attendanceMap, activeMembers);
        var members = memberSorter.sortMembersForAssignment(activeMembers.concat(extraMembers)).map(function(member) {
          return Object.assign({}, member, {
            checked: !!attendanceMap[member.id]
          });
        });

        nextData = Object.assign(nextData, {
          isEdit: true,
          editId: detail.id,
          editDocId: detail._docId || '',
          originalAttendance: (detail.attendance || []).slice(),
          title: detail.title || '',
          type: detail.type || '',
          date: detail.date || '',
          time: detail.time || '',
          location: detail.location || '',
          description: detail.description || '',
          members: members,
          selectedCount: this.getSelectedCount(members),
          isMakeupTraining: detail.type === MAKEUP_TYPE
        });

        wx.setNavigationBarTitle({
          title: '编辑训练日程'
        });
      }

      this.setData(nextData);
    } catch (err) {
      console.error(err);
      util.showToast('加载训练信息失败');
    }
  },

  onInput: function(e) {
    var field = e.currentTarget.dataset.field;
    var nextData = {};
    nextData[field] = e.detail.value;
    this.setData(nextData);
  },

  onTypePick: function(e) {
    if (this.data.isEdit) {
      return;
    }

    var type = this.data.typeOptions[e.detail.value] || '';
    this.setData({
      type: type,
      isMakeupTraining: type === MAKEUP_TYPE
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
      selectedCount: this.getSelectedCount(members)
    });
  },

  getSelectedCount: function(members) {
    return (members || []).filter(function(member) {
      return member.checked;
    }).length;
  },

  updateTrainingRecord: async function(trainingId, docId, payload) {
    await storage.update(storage.KEYS.TRAININGS, trainingId, Object.assign({
      _docId: docId || ''
    }, payload));
  },

  cleanupRemovedMakeupLinks: async function(removedRecords) {
    var records = (removedRecords || []).filter(function(record) {
      return !!(record && record.memberId && record.makeupTrainingId);
    });

    if (!records.length) {
      return;
    }

    var handledMap = {};
    var trainings = await storage.getList(storage.KEYS.TRAININGS);

    for (var i = 0; i < records.length; i++) {
      var item = records[i];
      var key = item.memberId + '::' + item.makeupTrainingId;
      if (handledMap[key]) {
        continue;
      }
      handledMap[key] = true;

      if (makeupHelper.hasLinkedMakeupRecord(trainings, item.memberId, item.makeupTrainingId)) {
        continue;
      }

      var makeupTraining = makeupHelper.findTrainingById(trainings, item.makeupTrainingId);
      if (!makeupTraining) {
        continue;
      }

      var removed = makeupHelper.removeMakeupAttendanceMember(makeupTraining.attendance, item.memberId);
      if (!removed.changed) {
        continue;
      }

      await this.updateTrainingRecord(makeupTraining.id, makeupTraining._docId, {
        title: makeupTraining.title,
        type: makeupTraining.type,
        date: makeupTraining.date,
        time: makeupTraining.time || '',
        location: makeupTraining.location || '',
        description: makeupTraining.description || '',
        attendance: removed.attendance
      });
    }
  },

  handleSubmit: async function() {
    if (!this.data.title.trim()) {
      util.showToast('请输入训练标题');
      return;
    }
    if (!this.data.type) {
      util.showToast('请选择训练类型');
      return;
    }
    if (!this.data.date) {
      util.showToast('请选择日期');
      return;
    }

    var isMakeupTraining = this.data.type === MAKEUP_TYPE;
    var selectedMembers = this.data.members.filter(function(member) {
      return member.checked;
    });

    if (!isMakeupTraining && selectedMembers.length === 0) {
      util.showToast('请至少选择一名成员');
      return;
    }

    if (this.data.isEdit && isMakeupTraining) {
      util.showToast('补训日程暂不支持在此编辑');
      return;
    }

    var attendanceMap = buildAttendanceMap(this.data.originalAttendance || []);
    var selectedIds = {};
    selectedMembers.forEach(function(member) {
      selectedIds[member.id] = true;
    });

    var attendance = isMakeupTraining
      ? []
      : selectedMembers.map(function(member) {
        var existingRecord = attendanceMap[member.id];
        if (existingRecord) {
          return Object.assign({}, existingRecord, {
            name: member.name
          });
        }

        return {
          memberId: member.id,
          name: member.name,
          status: ARRIVED_STATUS
        };
      });

    var payload = {
      title: this.data.title.trim(),
      type: this.data.type,
      date: this.data.date,
      time: this.data.time || '',
      location: this.data.location || '',
      description: this.data.description || '',
      attendance: attendance
    };

    try {
      if (this.data.isEdit) {
        var removedRecords = (this.data.originalAttendance || []).filter(function(record) {
          return !selectedIds[record.memberId];
        });

        await this.updateTrainingRecord(this.data.editId, this.data.editDocId, payload);
        await this.cleanupRemovedMakeupLinks(removedRecords);
        util.showToast('修改成功', 'success');
      } else {
        var userInfo = storage.getUserInfo();
        var training = Object.assign({
          id: util.generateId('t'),
          createdBy: userInfo ? userInfo.name : 'admin'
        }, payload);
        await storage.add(storage.KEYS.TRAININGS, training);
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
