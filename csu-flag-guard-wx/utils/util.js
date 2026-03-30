function formatDate(date) {
  if (typeof date === 'string') date = new Date(date);
  var year = date.getFullYear();
  var month = (date.getMonth() + 1).toString().padStart(2, '0');
  var day = date.getDate().toString().padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function formatTime(date) {
  if (typeof date === 'string') date = new Date(date);
  var hours = date.getHours().toString().padStart(2, '0');
  var minutes = date.getMinutes().toString().padStart(2, '0');
  return hours + ':' + minutes;
}

function generateId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function showToast(title, icon) {
  wx.showToast({
    title: title,
    icon: icon || 'none',
    duration: 2000
  });
}

function getStatusColor(status) {
  var colorMap = {
    '已到': '#07C160',
    '正常': '#07C160',
    '迟到': '#FFA500',
    '缺勤': '#EE0000',
    '缺席': '#EE0000',
    '请假': '#576B95',
    '未记录': '#CCCCCC'
  };
  return colorMap[status] || '#999999';
}

function calcAttendanceStats(attendance) {
  var keyMap = {
    '正常': 'normal',
    '迟到': 'late',
    '缺席': 'absent',
    '缺勤': 'absent',
    '已到': 'arrived',
    '请假': 'leave'
  };
  var stats = { total: attendance.length };
  attendance.forEach(function(item) {
    var key = keyMap[item.status] || item.status;
    stats[key] = (stats[key] || 0) + 1;
  });
  return stats;
}

module.exports = {
  formatDate: formatDate,
  formatTime: formatTime,
  generateId: generateId,
  showToast: showToast,
  getStatusColor: getStatusColor,
  calcAttendanceStats: calcAttendanceStats
};
