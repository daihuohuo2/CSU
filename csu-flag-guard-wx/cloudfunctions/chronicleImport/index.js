const cloud = require('wx-server-sdk');
const XLSX = require('xlsx');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION_NAME = 'chronicles';
const DEFAULT_BATCH_SIZE = 10;

function normalizeText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function generateChronicleId(index) {
  return 'c_' + Date.now() + '_' + index + '_' + Math.random().toString(36).slice(2, 8);
}

function isHeaderCell(text) {
  const value = normalizeText(text);
  return value === '人物志' || value === '内容' || value === 'A列内容';
}

function extractColumnA(rows) {
  if (!rows.length) {
    return [];
  }

  const values = rows.map(function(row) {
    return normalizeText(Array.isArray(row) ? row[0] : row);
  }).filter(Boolean);

  if (values.length && isHeaderCell(values[0])) {
    values.shift();
  }

  return values;
}

exports.main = async function(event) {
  try {
    const fileID = event.fileID;
    const gradeYear = normalizeText(event.gradeYear);
    const offset = Math.max(parseInt(event.offset, 10) || 0, 0);
    const batchSize = Math.max(parseInt(event.batchSize, 10) || DEFAULT_BATCH_SIZE, 1);

    if (!fileID) {
      throw new Error('缺少 Excel 文件');
    }
    if (!gradeYear) {
      throw new Error('缺少年级参数');
    }

    const downloadRes = await cloud.downloadFile({ fileID: fileID });
    const workbook = XLSX.read(downloadRes.fileContent, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw new Error('Excel 中没有可用工作表');
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: ''
    });

    const values = extractColumnA(rows);
    if (!values.length || offset >= values.length) {
      return {
        success: true,
        imported: 0,
        totalRows: values.length,
        nextOffset: values.length,
        hasMore: false
      };
    }

    const batchValues = values.slice(offset, offset + batchSize);
    const now = Date.now();

    for (let i = 0; i < batchValues.length; i++) {
      const sortOrder = now * 1000 + i;
      await db.collection(COLLECTION_NAME).add({
        data: {
          id: generateChronicleId(offset + i),
          gradeYear: gradeYear,
          gradeLabel: gradeYear + '级',
          content: batchValues[i],
          createdAt: now,
          updatedAt: now,
          sortOrder: sortOrder
        }
      });
    }

    const nextOffset = offset + batchValues.length;

    return {
      success: true,
      imported: batchValues.length,
      totalRows: values.length,
      nextOffset: nextOffset,
      hasMore: nextOffset < values.length
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: err.message || '导入人物志失败'
    };
  }
};
