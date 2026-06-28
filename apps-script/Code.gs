const SPREADSHEET_ID = '1hplWteuEJGSkNrn0S2AyzHoDxw_DJK_DW_XRyHL4FQM';

const TABS = {
  settings: 'QEF_Settings',
  pages: 'QEF_Pages',
  metrics: 'QEF_Metrics'
};

const PHOTO_ROOT_FOLDER_ID = '1wibEm9nltRtrFjoLIN0yuKWYUwVF5MuB';
const COURSE_CONTENT_CATEGORY = '課程內容';
const NAV_CATEGORY_ORDER = [
  '計劃簡介',
  '實況咖啡店',
  '課程安排',
  '電子營運',
  '學習歷程',
  '社區連繫',
  '預期成效'
];
const MAX_FOLDER_PHOTOS_PER_PAGE = 12;
const MAX_FOLDER_PHOTO_DEPTH = 3;
const DEFAULT_THUMBNAIL_SIZE = 800;
const CACHE_VERSION = '2026-06-28-v1';
const SITE_CACHE_KEY = 'qef-site:' + CACHE_VERSION;
const SITE_CACHE_TTL_SECONDS = 600;
const FOLDER_PHOTO_CACHE_TTL_SECONDS = 21600;

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action || 'site';

  try {
    let payload;

    if (action === 'health') {
      payload = getHealthPayload_();
    } else if (action === 'site') {
      payload = getCachedSitePayload_();
    } else {
      payload = { ok: false, error: 'Unknown action: ' + action };
    }

    return output_(payload, params.callback);
  } catch (error) {
    return output_({ ok: false, error: String(error && error.message || error) }, params.callback);
  }
}

function getHealthPayload_() {
  return {
    ok: true,
    service: 'qef-site-api',
    tabs: TABS,
    photoRootFolderId: PHOTO_ROOT_FOLDER_ID,
    cacheVersion: CACHE_VERSION
  };
}

function getCachedSitePayload_() {
  const cached = getCachedJson_(SITE_CACHE_KEY);
  if (cached) return cached;

  const payload = getSitePayload_();
  putCachedJson_(SITE_CACHE_KEY, payload, SITE_CACHE_TTL_SECONDS);
  return payload;
}

function getSitePayload_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const settings = readSettings_(ss.getSheetByName(TABS.settings));
  const pages = readPages_(ss.getSheetByName(TABS.pages));
  const metrics = readMetrics_(ss.getSheetByName(TABS.metrics));
  const folderPhotos = collectFolderPhotos_(pages);

  return {
    ok: true,
    settings,
    pages,
    photos: folderPhotos,
    metrics
  };
}

function readSettings_(sheet) {
  const rows = readObjects_(sheet);
  return rows.reduce(function (acc, row) {
    const key = String(row['設定鍵'] || '').trim();
    if (key) acc[key] = row['設定值'] || '';
    return acc;
  }, {});
}

function readPages_(sheet) {
  return readObjects_(sheet)
    .map(mapPageRow_)
    .filter(function (page) {
      return page.id && page.title && page.published;
    })
    .sort(sortByOrder_);
}

function mapPageRow_(row, index) {
  const category = getText_(row['分類']);
  const description = getText_(row['相關簡介']);
  const id = getText_(row['相關代號'] || row['頁面代號']);
  const title = getText_(row['相關名稱'] || row['頁面名稱']);
  const order = Number(row['排序'] || '') || index + 1;

  return {
    id,
    title,
    navTitle: getNavTitle_(row, title, category),
    category,
    order,
    date: formatDateForApi_(row['活動日期']),
    summary: getSummaryFromDescription_(description),
    body: description,
    imageId: getText_(row['封面圖片ID'] || row['主要圖片ID']),
    folderId: getText_(row['資料夾ID'] || row['相片資料夾ID']),
    published: isPublic_(row['公開顯示'])
  };
}

function getNavTitle_(row, title, category) {
  const explicitNavTitle = getText_(row['導航名稱']);
  if (explicitNavTitle) return explicitNavTitle;
  if (NAV_CATEGORY_ORDER.indexOf(category) >= 0) return category;
  return title;
}

function getSummaryFromDescription_(description) {
  const paragraphs = splitDescriptionParagraphs_(description);
  return paragraphs[0] || '';
}

function splitDescriptionParagraphs_(description) {
  return getText_(description)
    .split(/\r?\n\s*\r?\n/)
    .map(function (paragraph) {
      return paragraph.replace(/\s+/g, ' ').trim();
    })
    .filter(function (paragraph) {
      return paragraph;
    });
}

function formatDateForApi_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  return getText_(value);
}

function readMetrics_(sheet) {
  return readObjects_(sheet)
    .filter(function (row) {
      return isPublic_(row['公開顯示']);
    })
    .map(function (row) {
      return {
        id: String(row['指標代號'] || '').trim(),
        label: String(row['顯示名稱'] || '').trim(),
        value: String(row['數值'] || '').trim(),
        detail: String(row['補充文字'] || '').trim(),
        order: Number(row['排序'] || 999),
        published: true
      };
    })
    .filter(function (metric) {
      return metric.label && metric.value;
    })
    .sort(sortByOrder_);
}

function collectFolderPhotos_(pages) {
  const photos = [];

  pages.forEach(function (page) {
    if (!page.folderId) return;

    try {
      const imageFiles = getCachedFolderPhotoFiles_(page);

      imageFiles.forEach(function (file, index) {
        const imageId = file.imageId;
        photos.push({
          id: page.id + '-' + imageId,
          pageId: page.id,
          imageId,
          thumbnailUrl: makeThumbnailUrl_(imageId),
          caption: buildPhotoCaption_(page.title, file.fileName),
          order: Number(file.order || 1000 + index),
          published: true
        });
      });
    } catch (error) {
      // Folder access is optional; page content still works when folder photos are unavailable.
    }
  });

  return photos;
}

function getCachedFolderPhotoFiles_(page) {
  const cacheKey = buildFolderPhotoCacheKey_(page);
  const cached = getCachedJson_(cacheKey);
  if (Array.isArray(cached)) return cached;

  const folder = DriveApp.getFolderById(page.folderId);
  const imageFiles = collectImagesFromFolder_(folder, 0, MAX_FOLDER_PHOTO_DEPTH, MAX_FOLDER_PHOTOS_PER_PAGE);
  const photoFiles = imageFiles.map(function (file, index) {
    return {
      imageId: file.getId(),
      fileName: file.getName(),
      order: 1000 + index
    };
  });

  putCachedJson_(cacheKey, photoFiles, FOLDER_PHOTO_CACHE_TTL_SECONDS);
  return photoFiles;
}

function buildFolderPhotoCacheKey_(page) {
  return [
    'qef-folder',
    CACHE_VERSION,
    page.id,
    page.folderId,
    MAX_FOLDER_PHOTOS_PER_PAGE,
    MAX_FOLDER_PHOTO_DEPTH
  ].join(':');
}

function collectImagesFromFolder_(folder, depth, maxDepth, maxPhotos) {
  const images = [];
  const files = folder.getFiles();

  while (files.hasNext() && images.length < maxPhotos) {
    const file = files.next();
    if (isImageFile_(file)) images.push(file);
  }

  if (depth >= maxDepth || images.length >= maxPhotos) {
    return images;
  }

  const childFolders = folder.getFolders();
  while (childFolders.hasNext() && images.length < maxPhotos) {
    const childImages = collectImagesFromFolder_(
      childFolders.next(),
      depth + 1,
      maxDepth,
      maxPhotos - images.length
    );

    childImages.forEach(function (file) {
      if (images.length < maxPhotos) images.push(file);
    });
  }

  return images;
}

function clearQefCache() {
  const cache = CacheService.getScriptCache();
  const keys = [SITE_CACHE_KEY];

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const pages = readPages_(ss.getSheetByName(TABS.pages));
    pages.forEach(function (page) {
      if (page.folderId) keys.push(buildFolderPhotoCacheKey_(page));
    });
  } catch (error) {
    // If Sheet access fails, still clear the site cache key.
  }

  cache.removeAll(keys);
  return { ok: true, removedKeys: keys.length };
}

function warmQefSiteCache() {
  clearQefCache();
  const payload = getCachedSitePayload_();
  return {
    ok: true,
    pages: payload.pages.length,
    photos: payload.photos.length,
    metrics: payload.metrics.length
  };
}

function getCachedJson_(key) {
  try {
    const raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function putCachedJson_(key, value, ttlSeconds) {
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(value), ttlSeconds);
  } catch (error) {
    // Cache writes are best effort; API output should still work without cache.
  }
}

function readObjects_(sheet) {
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function (value) {
    return String(value || '').trim();
  });

  return values.slice(1).map(function (row) {
    return headers.reduce(function (acc, header, index) {
      if (header && acc[header] === undefined) acc[header] = row[index];
      return acc;
    }, {});
  });
}

function getText_(value) {
  return String(value == null ? '' : value).trim();
}

function output_(payload, callback) {
  const json = JSON.stringify(payload);

  // jsonp callback support for GitHub Pages.
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function isPublic_(value) {
  if (value === true) return true;
  if (value === false) return false;
  const text = String(value || '').trim().toUpperCase();
  return text === '' || text === 'TRUE' || text === 'YES' || text === 'Y' || text === '1';
}

function isImageFile_(file) {
  const mime = file.getMimeType() || '';
  return mime.indexOf('image/') === 0;
}

function makeThumbnailUrl_(imageId, size) {
  const requestedSize = Number(size || DEFAULT_THUMBNAIL_SIZE);
  const safeSize = isFinite(requestedSize) && requestedSize > 0 ? Math.round(requestedSize) : DEFAULT_THUMBNAIL_SIZE;
  return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(imageId) + '&sz=w' + safeSize;
}

function buildPhotoCaption_(pageTitle, fileName) {
  const name = String(fileName || '').replace(/\.[^.]+$/, '').trim();
  return name || getText_(pageTitle);
}

function sortByOrder_(a, b) {
  return Number(a.order || 999) - Number(b.order || 999);
}
