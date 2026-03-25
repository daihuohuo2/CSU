var COLLECTION_NAME = 'chronicles';
var PAGE_SIZE = 5;
var GRADE_START = 2023;
var GRADE_END = 2012;
var FETCH_LIMIT = 20;

function buildGradeOptions() {
  var grades = [];
  for (var year = GRADE_START; year >= GRADE_END; year--) {
    grades.push({
      year: String(year),
      label: year + '级',
      shortLabel: String(year).slice(2)
    });
  }
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
  return Object.assign({}, entry, {
    content: content,
    sections: buildSections(content)
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
  PAGE_SIZE: PAGE_SIZE,
  buildGradeOptions: buildGradeOptions,
  buildPagedEntries: buildPagedEntries,
  buildSections: buildSections,
  enrichChronicle: enrichChronicle,
  fetchAllChronicles: fetchAllChronicles,
  fetchChroniclesByGrade: fetchChroniclesByGrade,
  getCollection: getCollection,
  normalizeText: normalizeText
};
