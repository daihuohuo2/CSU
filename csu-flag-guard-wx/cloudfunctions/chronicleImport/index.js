const cloud = require('wx-server-sdk');
const XLSX = require('xlsx');
const JSZip = require('jszip');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION_NAME = 'chronicles';
const DEFAULT_BATCH_SIZE = 1;
const MAX_IMAGE_COUNT = 9;
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];

function normalizeText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function normalizeNameKey(value) {
  return normalizeText(value)
    .replace(/\s+/g, '')
    .replace(/[\/\\]/g, '');
}

function formatGradeLabel(gradeYear) {
  const value = normalizeText(gradeYear);
  if (!value) {
    return '';
  }
  return /[\u7ea7\u5c4a]$/.test(value) ? value : value + '\u7ea7';
}

function generateChronicleId(index) {
  return 'c_' + Date.now() + '_' + index + '_' + Math.random().toString(36).slice(2, 8);
}

function isHeaderRow(row) {
  const nameHeader = normalizeText((row || [])[0]);
  const contentHeader = normalizeText((row || [])[1]);
  return ['\u59d3\u540d', '\u4eba\u540d', '\u540d\u79f0'].indexOf(nameHeader) !== -1
    || ['\u4eba\u7269\u5fd7\u6b63\u6587', '\u4eba\u7269\u5fd7', '\u6b63\u6587', '\u5185\u5bb9'].indexOf(contentHeader) !== -1;
}

function getExtension(filePath) {
  const matched = String(filePath || '').match(/(\.[^.\/\\]+)$/);
  return matched ? matched[1].toLowerCase() : '';
}

function getBaseName(filePath) {
  const value = String(filePath || '').replace(/\\/g, '/');
  const parts = value.split('/');
  return parts[parts.length - 1] || '';
}

function stripExtension(fileName) {
  return String(fileName || '').replace(/\.[^.]+$/, '');
}

function inferImageOrder(fileName) {
  const baseName = stripExtension(getBaseName(fileName));
  const lowerName = baseName.toLowerCase();

  if (/(^|[-_\s(（])(cover|\u5c01\u9762)([)）]?|$)/i.test(lowerName)) {
    return 0;
  }

  const matched = baseName.match(/(?:^|[-_\s(（])(\d{1,2})(?:[)）]?|$)/);
  return matched ? Number(matched[1]) : 999;
}

function parseFlatImageName(fileName) {
  const baseName = stripExtension(getBaseName(fileName));
  const matched = baseName.match(/^(.*?)(?:[-_\s(（]?(?:cover|\u5c01\u9762|\d{1,2})[)）]?)?$/i);
  return normalizeNameKey(matched ? matched[1] : baseName);
}

function compareNaturalText(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'zh-Hans-CN', {
    numeric: true,
    sensitivity: 'base'
  });
}

async function readZipEntries(fileContent) {
  const zip = await JSZip.loadAsync(fileContent);
  const entries = [];

  zip.forEach(function(relativePath, file) {
    if (file.dir) {
      return;
    }

    const normalizedPath = String(relativePath || '').replace(/\\/g, '/');
    if (!normalizedPath || normalizedPath.indexOf('__MACOSX/') === 0) {
      return;
    }

    const extension = getExtension(normalizedPath);
    if (IMAGE_EXTENSIONS.indexOf(extension) === -1) {
      return;
    }

    entries.push({
      relativePath: normalizedPath,
      extension: extension,
      fileName: getBaseName(normalizedPath),
      bufferPromise: file.async('nodebuffer')
    });
  });

  return Promise.all(entries.map(async function(entry) {
    return {
      relativePath: entry.relativePath,
      extension: entry.extension,
      fileName: entry.fileName,
      buffer: await entry.bufferPromise
    };
  }));
}

function groupImagesByPerson(entries) {
  const imageMap = {};

  (entries || []).forEach(function(entry) {
    const parts = String(entry.relativePath || '').split('/').filter(Boolean);
    let personKey = '';

    if (parts.length > 1) {
      personKey = normalizeNameKey(parts[0]);
    } else {
      personKey = parseFlatImageName(entry.fileName);
    }

    if (!personKey) {
      return;
    }

    if (!imageMap[personKey]) {
      imageMap[personKey] = [];
    }

    imageMap[personKey].push({
      fileName: entry.fileName,
      extension: entry.extension,
      order: inferImageOrder(entry.fileName),
      buffer: entry.buffer
    });
  });

  Object.keys(imageMap).forEach(function(personKey) {
    imageMap[personKey] = imageMap[personKey]
      .sort(function(a, b) {
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        return String(a.fileName).localeCompare(String(b.fileName));
      })
      .slice(0, MAX_IMAGE_COUNT);
  });

  return imageMap;
}

function sortZipImages(entries) {
  return (entries || []).slice().sort(function(a, b) {
    const aOrder = inferImageOrder(a.fileName || a.relativePath);
    const bOrder = inferImageOrder(b.fileName || b.relativePath);
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return compareNaturalText(a.relativePath || a.fileName, b.relativePath || b.fileName);
  });
}

function buildChronicleRows(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    return [];
  }

  const startIndex = isHeaderRow(rows[0]) ? 1 : 0;
  const result = [];

  for (let rowIndex = startIndex; rowIndex < rows.length; rowIndex++) {
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    const personName = normalizeText(row[0]);
    const content = normalizeText(row[1]);

    if (!personName && !content) {
      continue;
    }

    result.push({
      rowIndex: rowIndex,
      personName: personName,
      personKey: normalizeNameKey(personName),
      content: content
    });
  }

  return result;
}

function buildImageCloudPath(gradeYear, chronicleId, imageIndex, fileName) {
  const safeYear = normalizeText(gradeYear) || 'unknown';
  const safeId = normalizeText(chronicleId) || 'chronicle';
  const extension = getExtension(fileName) || '.jpg';
  const safeIndex = String(imageIndex + 1).padStart(2, '0');
  return 'chronicles/' + safeYear + '/' + safeId + '/import_' + Date.now() + '_' + safeIndex + extension;
}

async function uploadChronicleImages(gradeYear, chronicleId, images, startIndex) {
  if (!images.length) {
    return [];
  }

  const now = Date.now();
  const uploadedImages = [];
  const baseIndex = Math.max(parseInt(startIndex, 10) || 0, 0);

  for (let index = 0; index < images.length; index++) {
    const image = images[index];
    const uploadRes = await cloud.uploadFile({
      cloudPath: buildImageCloudPath(gradeYear, chronicleId, baseIndex + index, image.fileName),
      fileContent: image.buffer
    });

    uploadedImages.push({
      imageId: 'img_' + String(baseIndex + index + 1),
      fileID: uploadRes.fileID,
      sortOrder: baseIndex + index + 1,
      caption: '',
      fileName: image.fileName || ('image_' + String(index + 1) + (image.extension || '.jpg')),
      uploadedAt: now
    });
  }

  return uploadedImages;
}

async function cleanupUploadedFiles(fileIDs) {
  const list = (fileIDs || []).filter(Boolean);
  if (!list.length) {
    return;
  }

  try {
    await cloud.deleteFile({
      fileList: list
    });
  } catch (err) {
    console.error('cleanup chronicle import files failed', err);
  }
}

async function importZipImagesForChronicle(event) {
  const zipFileID = event.zipFileID || '';
  const gradeYear = normalizeText(event.gradeYear);
  const chronicleId = normalizeText(event.chronicleId);
  const startIndex = Math.max(parseInt(event.startIndex, 10) || 0, 0);
  const limit = Math.min(Math.max(parseInt(event.limit, 10) || MAX_IMAGE_COUNT, 1), MAX_IMAGE_COUNT);

  if (!zipFileID) {
    throw new Error('缺少 ZIP 图片包');
  }
  if (!gradeYear) {
    throw new Error('缺少年级参数');
  }
  if (!chronicleId) {
    throw new Error('缺少人物志编号');
  }

  const zipDownloadRes = await cloud.downloadFile({ fileID: zipFileID });
  const zipEntries = sortZipImages(await readZipEntries(zipDownloadRes.fileContent)).slice(0, limit);

  if (!zipEntries.length) {
    throw new Error('ZIP 中未找到可导入图片');
  }

  let uploadedImages = [];
  try {
    uploadedImages = await uploadChronicleImages(gradeYear, chronicleId, zipEntries, startIndex);
    return {
      success: true,
      imported: uploadedImages.length,
      images: uploadedImages
    };
  } catch (err) {
    await cleanupUploadedFiles(uploadedImages.map(function(item) {
      return item.fileID;
    }));
    throw err;
  }
}

exports.main = async function(event) {
  try {
    if (event && event.action === 'importZipImages') {
      return await importZipImagesForChronicle(event);
    }

    const excelFileID = event.excelFileID || event.fileID || '';
    const zipFileID = event.zipFileID || '';
    const gradeYear = normalizeText(event.gradeYear);
    const offset = Math.max(parseInt(event.offset, 10) || 0, 0);
    const batchSize = Math.max(parseInt(event.batchSize, 10) || DEFAULT_BATCH_SIZE, 1);

    if (!excelFileID) {
      throw new Error('\u7f3a\u5c11 Excel \u6587\u4ef6');
    }
    if (!zipFileID) {
      throw new Error('\u7f3a\u5c11 ZIP \u56fe\u7247\u5305');
    }
    if (!gradeYear) {
      throw new Error('\u7f3a\u5c11\u5e74\u7ea7\u53c2\u6570');
    }

    const excelDownloadRes = await cloud.downloadFile({ fileID: excelFileID });
    const zipDownloadRes = await cloud.downloadFile({ fileID: zipFileID });
    const workbook = XLSX.read(excelDownloadRes.fileContent, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw new Error('Excel \u4e2d\u6ca1\u6709\u53ef\u7528\u5de5\u4f5c\u8868');
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: ''
    });

    const chronicleRows = buildChronicleRows(rows);
    const zipEntries = await readZipEntries(zipDownloadRes.fileContent);
    const imageMap = groupImagesByPerson(zipEntries);

    if (!chronicleRows.length || offset >= chronicleRows.length) {
      return {
        success: true,
        imported: 0,
        totalRows: chronicleRows.length,
        nextOffset: chronicleRows.length,
        hasMore: false
      };
    }

    const batchRows = chronicleRows.slice(offset, offset + batchSize);

    for (let i = 0; i < batchRows.length; i++) {
      const row = batchRows[i];
      const chronicleId = generateChronicleId(offset + i);
      const now = Date.now();
      const rowImages = imageMap[row.personKey] || [];
      let uploadedImages = [];

      try {
        uploadedImages = await uploadChronicleImages(gradeYear, chronicleId, rowImages);
        const sortOrder = now * 1000 + i;

        await db.collection(COLLECTION_NAME).add({
          data: {
            id: chronicleId,
            gradeYear: gradeYear,
            gradeLabel: formatGradeLabel(gradeYear),
            personName: row.personName || '',
            content: row.content || '',
            coverImage: null,
            coverFileId: '',
            images: uploadedImages,
            createdAt: now,
            updatedAt: now,
            sortOrder: sortOrder
          }
        });
      } catch (rowErr) {
        await cleanupUploadedFiles(uploadedImages.map(function(item) {
          return item.fileID;
        }));
        throw rowErr;
      }
    }

    const nextOffset = offset + batchRows.length;

    return {
      success: true,
      imported: batchRows.length,
      totalRows: chronicleRows.length,
      nextOffset: nextOffset,
      hasMore: nextOffset < chronicleRows.length
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: err.message || '\u5bfc\u5165\u4eba\u7269\u5fd7\u5931\u8d25'
    };
  }
};
