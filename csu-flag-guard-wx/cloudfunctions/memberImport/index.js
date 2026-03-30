const cloud = require('wx-server-sdk');
const XLSX = require('xlsx');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const MEMBER_COLLECTION = 'members';
const DEFAULT_PASSWORD = '123456';
const DEFAULT_POSITION = ['队员'];
const DEFAULT_STATUS = '在队';
const VALID_DEPARTMENTS = ['办公室成员', '财务部成员', '特勤部成员', '宣传部成员'];
const DEFAULT_BATCH_SIZE = 5;
const DEPARTMENT_MAP = {
  '办公室': '办公室成员',
  '办公室成员': '办公室成员',
  '财务部': '财务部成员',
  '财务部成员': '财务部成员',
  '特勤部': '特勤部成员',
  '特勤部成员': '特勤部成员',
  '宣传部': '宣传部成员',
  '宣传部成员': '宣传部成员',
  '未分配': ''
};

function normalizeText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function normalizeNumberText(value) {
  return normalizeText(value).replace(/\.0$/, '');
}

function normalizeGender(value) {
  var text = normalizeText(value);
  if (!text) return '';
  if (text === '男' || text.toLowerCase() === 'male') return '男';
  if (text === '女' || text.toLowerCase() === 'female') return '女';
  return text;
}

function normalizeDepartment(value) {
  var text = normalizeText(value);
  if (!text) return '';
  if (Object.prototype.hasOwnProperty.call(DEPARTMENT_MAP, text)) {
    return DEPARTMENT_MAP[text];
  }
  return VALID_DEPARTMENTS.indexOf(text) !== -1 ? text : null;
}

function getInitialPassword(studentId, phone) {
  return normalizeNumberText(studentId) || normalizeNumberText(phone) || DEFAULT_PASSWORD;
}

function isHeaderRow(row) {
  return normalizeText(row[0]) === '姓名'
    && normalizeText(row[1]) === '性别'
    && normalizeText(row[2]) === '学号';
}

function isEmptyRow(row) {
  return !row.some(function(cell) {
    return normalizeText(cell);
  });
}

function generateMemberId(index) {
  return 'm_' + Date.now() + '_' + index + '_' + Math.random().toString(36).slice(2, 8);
}

async function fetchExistingStudentIds() {
  var collection = db.collection(MEMBER_COLLECTION);
  var limit = 100;
  var offset = 0;
  var ids = {};

  while (true) {
    var res = await collection.field({ studentId: true }).skip(offset).limit(limit).get();
    var data = res.data || [];

    data.forEach(function(item) {
      var studentId = normalizeNumberText(item.studentId);
      if (studentId) {
        ids[studentId] = true;
      }
    });

    if (data.length < limit) {
      break;
    }
    offset += data.length;
  }

  return ids;
}

exports.main = async function(event) {
  try {
    var fileID = event.fileID;
    var joinDate = normalizeText(event.joinDate);
    var offset = Math.max(parseInt(event.offset, 10) || 0, 0);
    var batchSize = Math.max(parseInt(event.batchSize, 10) || DEFAULT_BATCH_SIZE, 1);

    if (!fileID) {
      throw new Error('缺少Excel文件');
    }
    if (!joinDate) {
      throw new Error('缺少统一入队时间');
    }

    var downloadRes = await cloud.downloadFile({ fileID: fileID });
    var workbook = XLSX.read(downloadRes.fileContent, { type: 'buffer' });
    var sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw new Error('Excel中没有可用工作表');
    }

    var rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: ''
    });

    if (!rows.length) {
      return {
        success: true,
        imported: 0,
        skipped: 0,
        skippedRows: []
      };
    }

    var hadHeader = isHeaderRow(rows[0]);
    if (hadHeader) {
      rows.shift();
    }

    if (!rows.length) {
      return {
        success: true,
        imported: 0,
        skipped: 0,
        skippedRows: [],
        totalRows: 0,
        nextOffset: 0,
        hasMore: false
      };
    }

    if (offset >= rows.length) {
      return {
        success: true,
        imported: 0,
        skipped: 0,
        skippedRows: [],
        totalRows: rows.length,
        nextOffset: rows.length,
        hasMore: false
      };
    }

    var batchRows = rows.slice(offset, offset + batchSize);
    var nextOffset = offset + batchRows.length;
    var hasMore = nextOffset < rows.length;

    var existingStudentIds = await fetchExistingStudentIds();
    var seenStudentIds = {};
    var imported = 0;
    var skipped = 0;
    var skippedRows = [];

    for (var i = 0; i < batchRows.length; i++) {
      var row = batchRows[i];
      var rowNumber = offset + i + 1 + (hadHeader ? 1 : 0);

      if (isEmptyRow(row)) {
        continue;
      }

      var name = normalizeText(row[0]);
      var gender = normalizeGender(row[1]);
      var studentId = normalizeNumberText(row[2]);
      var college = normalizeText(row[3]);
      var major = normalizeText(row[4]);
      var grade = normalizeText(row[5]);
      var className = normalizeText(row[6]);
      var departmentText = normalizeText(row[7]);
      var department = normalizeDepartment(departmentText);
      var phone = normalizeNumberText(row[8]);

      if (!name) {
        skipped += 1;
        skippedRows.push({ rowNumber: rowNumber, reason: '姓名为空' });
        continue;
      }

      if (departmentText && department === null) {
        skipped += 1;
        skippedRows.push({ rowNumber: rowNumber, reason: '部门不在允许范围内' });
        continue;
      }

      if (studentId && (existingStudentIds[studentId] || seenStudentIds[studentId])) {
        skipped += 1;
        skippedRows.push({ rowNumber: rowNumber, reason: '学号重复，已跳过' });
        continue;
      }

      await db.collection(MEMBER_COLLECTION).add({
        data: {
          id: generateMemberId(offset + i),
          name: name,
          gender: gender,
          studentId: studentId,
          password: getInitialPassword(studentId, phone),
          college: college,
          major: major,
          grade: grade,
          className: className,
          department: department || '',
          phone: phone,
          wechat: phone,
          joinDate: joinDate,
          position: DEFAULT_POSITION,
          status: DEFAULT_STATUS,
          remark: '',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      });

      if (studentId) {
        seenStudentIds[studentId] = true;
      }
      imported += 1;
    }

    return {
      success: true,
      imported: imported,
      skipped: skipped,
      skippedRows: skippedRows.slice(0, 10),
      totalRows: rows.length,
      nextOffset: nextOffset,
      hasMore: hasMore
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: err.message || '导入失败'
    };
  }
};
