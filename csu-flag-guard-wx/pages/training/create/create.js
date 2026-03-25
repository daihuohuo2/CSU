var storage = require('../../../utils/storage');
var util = require('../../../utils/util');

var MAKEUP_TYPE = '\u8865\u8bad';
var ARRIVED_STATUS = '\u5df2\u5230';

Page({
  data: {
    title: '',
    type: '',
    date: '',
    time: '',
    location: '',
    description: '',
    typeOptions: storage.TRAINING_TYPE_OPTIONS.slice(),
    typePlaceholder: '\u8bf7\u9009\u62e9\u8bad\u7ec3\u7c7b\u578b',
    datePlaceholder: '\u8bf7\u9009\u62e9\u65e5\u671f',
    members: [],
    selectedCount: 0,
    isMakeupTraining: false
  },

  onLoad: async function() {
    try {
      var members = storage.enrichMembers(await storage.getList(storage.KEYS.MEMBERS))
        .filter(storage.isMemberActive);
      members.forEach(function(member) {
        member.checked = true;
      });
      this.setData({
        members: members,
        selectedCount: members.length
      });
    } catch (err) {
      console.error(err);
      util.showToast('\u52a0\u8f7d\u6210\u5458\u5931\u8d25');
    }
  },

  onInput: function(e) {
    var field = e.currentTarget.dataset.field;
    var nextData = {};
    nextData[field] = e.detail.value;
    this.setData(nextData);
  },

  onTypePick: function(e) {
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
      checked: e.detail.value
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

  handleSubmit: async function() {
    if (!this.data.title.trim()) {
      util.showToast('\u8bf7\u8f93\u5165\u8bad\u7ec3\u6807\u9898');
      return;
    }
    if (!this.data.type) {
      util.showToast('\u8bf7\u9009\u62e9\u8bad\u7ec3\u7c7b\u578b');
      return;
    }
    if (!this.data.date) {
      util.showToast('\u8bf7\u9009\u62e9\u65e5\u671f');
      return;
    }

    var isMakeupTraining = this.data.type === MAKEUP_TYPE;
    var selectedMembers = this.data.members.filter(function(member) {
      return member.checked;
    });

    if (!isMakeupTraining && selectedMembers.length === 0) {
      util.showToast('\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u540d\u6210\u5458');
      return;
    }

    var attendance = isMakeupTraining
      ? []
      : selectedMembers.map(function(member) {
        return {
          memberId: member.id,
          name: member.name,
          status: ARRIVED_STATUS
        };
      });

    var userInfo = storage.getUserInfo();
    var training = {
      id: util.generateId('t'),
      title: this.data.title.trim(),
      type: this.data.type,
      date: this.data.date,
      time: this.data.time || '',
      location: this.data.location || '',
      description: this.data.description || '',
      createdBy: userInfo ? userInfo.name : 'admin',
      attendance: attendance
    };

    try {
      await storage.add(storage.KEYS.TRAININGS, training);
      util.showToast('\u521b\u5efa\u6210\u529f', 'success');
      setTimeout(function() {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error(err);
      util.showToast('\u521b\u5efa\u5931\u8d25');
    }
  }
});
