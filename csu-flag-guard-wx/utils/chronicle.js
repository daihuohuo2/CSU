var COLLECTION_NAME = 'chronicles';
var PAGE_SIZE = 5;
var GRADE_START = 2023;
var GRADE_END = 2012;
var FETCH_LIMIT = 20;
var TEMP_FILE_URL_BATCH_SIZE = 20;
var MAX_COVER_IMAGE_COUNT = 1;
var MAX_GALLERY_IMAGE_COUNT = 9;
var MAX_IMAGE_COUNT = MAX_COVER_IMAGE_COUNT + MAX_GALLERY_IMAGE_COUNT;

function buildGradeOptions() {
  var grades = [];
  for (var year = GRADE_START; year >= GRADE_END; year--) {
    grades.push({
      year: String(year),
      label: year + '级',
      shortLabel: String(year).slice(2)
    });
  }
  grades.push({
    year: '18届',
    label: '18届',
    shortLabel: '18'
  });
  return grades;
}

function getCollection() {
  return wx.cloud.database().collection(COLLECTION_NAME);
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function buildSections(content) {
  var text = normalizeText(content);
  if (!text) {
    return [];
  }

  return text.split(/\r?\n+/).map(function(item) {
    return item.trim();
  }).filter(Boolean);
}

function normalizeImageId(image, index) {
  if (image && image.imageId) {
    return image.imageId;
  }

  var fileID = image && image.fileID ? String(image.fileID) : '';
  if (fileID) {
    return 'img_' + fileID.slice(-12).replace(/[^\w]/g, '');
  }

  return 'img_' + String(index + 1);
}

function normalizeImages(images) {
  var list = Array.isArray(images) ? images.slice() : [];
  return list.filter(function(item) {
    return item && item.fileID;
  }).sort(function(a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  }).map(function(item, index) {
    return {
      imageId: normalizeImageId(item, index),
      fileID: item.fileID,
      sortOrder: index + 1,
      caption: normalizeText(item.caption),
      fileName: normalizeText(item.fileName),
      uploadedAt: Number(item.uploadedAt || 0),
      tempFileURL: normalizeText(item.tempFileURL)
    };
  });
}

function normalizeSingleImage(image) {
  if (!image || !image.fileID) {
    return null;
  }

  return {
    imageId: normalizeImageId(image, 0),
    fileID: image.fileID,
    sortOrder: 1,
    caption: normalizeText(image.caption),
    fileName: normalizeText(image.fileName),
    uploadedAt: Number(image.uploadedAt || 0),
    tempFileURL: normalizeText(image.tempFileURL)
  };
}

function buildChronicleImagesForStorage(images) {
  return normalizeImages(images).map(function(item, index) {
    return {
      imageId: item.imageId || ('img_' + String(index + 1)),
      fileID: item.fileID,
      sortOrder: index + 1,
      caption: item.caption || '',
      fileName: item.fileName || '',
      uploadedAt: item.uploadedAt || Date.now()
    };
  });
}

function buildChronicleImageForStorage(image) {
  var normalized = normalizeSingleImage(image);
  if (!normalized) {
    return null;
  }

  return {
    imageId: normalized.imageId,
    fileID: normalized.fileID,
    sortOrder: 1,
    caption: normalized.caption || '',
    fileName: normalized.fileName || '',
    uploadedAt: normalized.uploadedAt || Date.now()
  };
}

function getFileExtension(fileName) {
  var text = normalizeText(fileName);
  var matched = text.match(/(\.[^.\/\\]+)$/);
  return matched ? matched[1].toLowerCase() : '.jpg';
}

function getFileBaseName(fileName) {
  var text = normalizeText(fileName);
  var parts = text.split(/[\/\\]/);
  return parts[parts.length - 1] || '';
}

function buildImageCloudPath(gradeYear, chronicleId, index, fileName) {
  var year = normalizeText(gradeYear) || 'unknown';
  var id = normalizeText(chronicleId) || 'chronicle';
  var ext = getFileExtension(fileName);
  var safeIndex = String(index + 1).padStart(2, '0');
  return 'chronicles/' + year + '/' + id + '/' + Date.now() + '_' + safeIndex + ext;
}

function buildCoverCloudPath(gradeYear, chronicleId, fileName) {
  var year = normalizeText(gradeYear) || 'unknown';
  var id = normalizeText(chronicleId) || 'chronicle';
  var ext = getFileExtension(fileName);
  return 'chronicles/' + year + '/' + id + '/cover_' + Date.now() + ext;
}

async function fetchChronicleById(id) {
  var res = await getCollection().where({
    id: String(id)
  }).limit(1).get();

  if (!res.data || !res.data.length) {
    return null;
  }

  var plain = Object.assign({}, res.data[0]);
  plain._docId = plain._id;
  delete plain._id;
  return plain;
}

async function getTempFileUrlMap(fileIDs) {
  var list = [];
  (fileIDs || []).forEach(function(fileID) {
    if (fileID && list.indexOf(fileID) === -1) {
      list.push(fileID);
    }
  });

  if (!list.length) {
    return {};
  }

  try {
    var map = {};
    for (var i = 0; i < list.length; i += TEMP_FILE_URL_BATCH_SIZE) {
      var batch = list.slice(i, i + TEMP_FILE_URL_BATCH_SIZE);
      var res = await wx.cloud.getTempFileURL({
        fileList: batch
      });
      (res.fileList || []).forEach(function(item) {
        if (item.fileID && item.tempFileURL) {
          map[item.fileID] = item.tempFileURL;
        }
      });
    }
    return map;
  } catch (err) {
    console.error('get chronicle temp file url failed', err);
    return {};
  }
}

function attachImageTempUrls(images, tempUrlMap) {
  var normalized = normalizeImages(images);
  return normalized.map(function(item) {
    return Object.assign({}, item, {
      tempFileURL: (tempUrlMap && tempUrlMap[item.fileID]) || item.tempFileURL || ''
    });
  });
}

async function resolveChronicleImages(images) {
  var normalized = normalizeImages(images);
  var tempUrlMap = await getTempFileUrlMap(normalized.map(function(item) {
    return item.fileID;
  }));
  return attachImageTempUrls(normalized, tempUrlMap);
}

async function resolveChronicleEntries(entries, options) {
  var settings = Object.assign({
    resolveImages: true
  }, options || {});
  var enrichedEntries = (entries || []).map(enrichChronicle);
  var fileIDs = [];

  enrichedEntries.forEach(function(entry) {
    if (entry.coverImage && entry.coverImage.fileID && fileIDs.indexOf(entry.coverImage.fileID) === -1) {
      fileIDs.push(entry.coverImage.fileID);
    }
    if (entry.coverFileId && fileIDs.indexOf(entry.coverFileId) === -1) {
      fileIDs.push(entry.coverFileId);
    }
    if (settings.resolveImages) {
      (entry.images || []).forEach(function(image) {
        if (image.fileID && fileIDs.indexOf(image.fileID) === -1) {
          fileIDs.push(image.fileID);
        }
      });
    }
  });

  var tempUrlMap = await getTempFileUrlMap(fileIDs);
  return enrichedEntries.map(function(entry) {
    var images = settings.resolveImages
      ? attachImageTempUrls(entry.images, tempUrlMap)
      : normalizeImages(entry.images);
    var coverFallback = images[0] ? Object.assign({}, images[0], {
      sortOrder: 1
    }) : null;
    var persistedCover = normalizeSingleImage(entry.coverImage) || (entry.coverFileId ? {
      imageId: normalizeImageId({ fileID: entry.coverFileId }, 0),
      fileID: entry.coverFileId,
      sortOrder: 1,
      caption: '',
      fileName: '',
      uploadedAt: 0,
      tempFileURL: ''
    } : null);
    var coverImage = persistedCover || coverFallback;
    if (coverImage) {
      coverImage = Object.assign({}, coverImage, {
        tempFileURL: (tempUrlMap && tempUrlMap[coverImage.fileID]) || coverImage.tempFileURL || ''
      });
    }
    return Object.assign({}, entry, {
      coverImage: coverImage,
      images: images,
      previewUrls: settings.resolveImages ? images.map(function(image) {
        return image.tempFileURL;
      }).filter(Boolean) : []
    });
  });
}

async function deleteCloudFiles(fileIDs) {
  var list = [];
  (fileIDs || []).forEach(function(fileID) {
    if (fileID && list.indexOf(fileID) === -1) {
      list.push(fileID);
    }
  });

  if (!list.length) {
    return;
  }

  await wx.cloud.deleteFile({
    fileList: list
  });
}

async function fetchAllByQuery(query) {
  var result = [];
  var offset = 0;
  var hasQuery = query && Object.keys(query).length > 0;

  while (true) {
    var ref = hasQuery ? getCollection().where(query) : getCollection();
    var res = await ref.skip(offset).limit(FETCH_LIMIT).get();
    var data = res.data || [];
    result = result.concat(data);

    if (data.length < FETCH_LIMIT) {
      break;
    }
    offset += data.length;
  }

  return result;
}

async function fetchAllChronicles() {
  return fetchAllByQuery({});
}

async function fetchChroniclesByGrade(gradeYear) {
  var rows = await fetchAllByQuery({
    gradeYear: String(gradeYear)
  });

  return rows.sort(function(a, b) {
    var aOrder = Number(a.sortOrder || 0);
    var bOrder = Number(b.sortOrder || 0);
    if (aOrder || bOrder) {
      return aOrder - bOrder;
    }

    var aTime = Number(a.createdAt || a.updatedAt || 0);
    var bTime = Number(b.createdAt || b.updatedAt || 0);
    if (aTime !== bTime) {
      return aTime - bTime;
    }

    var aId = normalizeText(a._id || a.id);
    var bId = normalizeText(b._id || b.id);
    return aId.localeCompare(bId);
  });
}

function enrichChronicle(entry) {
  var content = normalizeText(entry.content);
  var images = normalizeImages(entry.images);
  var coverImage = normalizeSingleImage(entry.coverImage) || (entry.coverFileId ? {
    imageId: normalizeImageId({ fileID: entry.coverFileId }, 0),
    fileID: entry.coverFileId,
    sortOrder: 1,
    caption: '',
    fileName: '',
    uploadedAt: 0,
    tempFileURL: ''
  } : null);
  return Object.assign({}, entry, {
    personName: normalizeText(entry.personName) || '未命名人物',
    content: content,
    sections: buildSections(content),
    coverImage: coverImage,
    images: images,
    coverFileId: normalizeText(entry.coverFileId || (coverImage && coverImage.fileID) || (images[0] && images[0].fileID) || '')
  });
}

function buildPagedEntries(entries, currentPage, pageSize) {
  var size = pageSize || PAGE_SIZE;
  var page = Math.max(Number(currentPage) || 1, 1);
  var totalPages = Math.max(Math.ceil((entries || []).length / size), 1);
  var safePage = Math.min(page, totalPages);
  var start = (safePage - 1) * size;

  return {
    currentPage: safePage,
    totalPages: totalPages,
    pageEntries: (entries || []).slice(start, start + size)
  };
}

module.exports = {
  COLLECTION_NAME: COLLECTION_NAME,
  MAX_COVER_IMAGE_COUNT: MAX_COVER_IMAGE_COUNT,
  MAX_GALLERY_IMAGE_COUNT: MAX_GALLERY_IMAGE_COUNT,
  MAX_IMAGE_COUNT: MAX_IMAGE_COUNT,
  PAGE_SIZE: PAGE_SIZE,
  attachImageTempUrls: attachImageTempUrls,
  buildChronicleImageForStorage: buildChronicleImageForStorage,
  buildChronicleImagesForStorage: buildChronicleImagesForStorage,
  buildCoverCloudPath: buildCoverCloudPath,
  buildImageCloudPath: buildImageCloudPath,
  buildGradeOptions: buildGradeOptions,
  buildPagedEntries: buildPagedEntries,
  buildSections: buildSections,
  deleteCloudFiles: deleteCloudFiles,
  enrichChronicle: enrichChronicle,
  fetchChronicleById: fetchChronicleById,
  fetchAllChronicles: fetchAllChronicles,
  fetchChroniclesByGrade: fetchChroniclesByGrade,
  getFileBaseName: getFileBaseName,
  getCollection: getCollection,
  getTempFileUrlMap: getTempFileUrlMap,
  normalizeText: normalizeText,
  normalizeImages: normalizeImages,
  normalizeSingleImage: normalizeSingleImage,
  resolveChronicleEntries: resolveChronicleEntries,
  resolveChronicleImages: resolveChronicleImages
};
