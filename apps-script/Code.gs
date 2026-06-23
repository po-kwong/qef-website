const SPREADSHEET_ID = '1CmPaRF6o9K2Gjx2Ga59yRdao6KPbWrnU8tCKqsnt1m8';

const TABS = {
  settings: 'QEF_Settings',
  pages: 'QEF_Pages',
  photos: 'QEF_Photos',
  metrics: 'QEF_Metrics'
};

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action || 'site';

  try {
    const payload = action === 'health'
      ? { ok: true, service: 'qef-site-api', tabs: TABS }
      : getSitePayload_();

    return output_(payload, params.callback);
  } catch (error) {
    return output_({ ok: false, error: String(error && error.message || error) }, params.callback);
  }
}

function getSitePayload_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const settings = readSettings_(ss.getSheetByName(TABS.settings));
  const pages = readPages_(ss.getSheetByName(TABS.pages));
  const sheetPhotos = readPhotos_(ss.getSheetByName(TABS.photos));
  const metrics = readMetrics_(ss.getSheetByName(TABS.metrics));
  const folderPhotos = collectFolderPhotos_(pages);

  return {
    ok: true,
    settings,
    pages,
    photos: sheetPhotos.concat(folderPhotos),
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
    .filter(function (row) {
      return isPublic_(row['公開顯示']);
    })
    .map(function (row) {
      return {
        id: String(row['頁面代號'] || '').trim(),
        title: String(row['頁面名稱'] || '').trim(),
        navTitle: String(row['導航名稱'] || row['頁面名稱'] || '').trim(),
        category: String(row['分類'] || '').trim(),
        order: Number(row['排序'] || 999),
        summary: String(row['頁面摘要'] || '').trim(),
        body: String(row['詳細介紹'] || '').trim(),
        imageId: String(row['主要圖片ID'] || '').trim(),
        folderId: String(row['相片資料夾ID'] || '').trim(),
        published: true
      };
    })
    .filter(function (page) {
      return page.id && page.title;
    })
    .sort(sortByOrder_);
}

function readPhotos_(sheet) {
  return readObjects_(sheet)
    .filter(function (row) {
      return isPublic_(row['公開顯示']);
    })
    .map(function (row) {
      const imageId = String(row['圖片ID'] || '').trim();
      return {
        id: String(row['相片代號'] || '').trim(),
        pageId: String(row['頁面代號'] || '').trim(),
        imageId,
        thumbnailUrl: imageId ? makeThumbnailUrl_(imageId) : '',
        caption: String(row['圖片說明'] || '').trim(),
        order: Number(row['排序'] || 999),
        published: true
      };
    })
    .filter(function (photo) {
      return photo.pageId;
    })
    .sort(sortByOrder_);
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
      const folder = DriveApp.getFolderById(page.folderId);
      const files = folder.getFiles();
      let order = 1000;

      while (files.hasNext()) {
        const file = files.next();
        if (!isImageFile_(file)) continue;

        const imageId = file.getId();
        photos.push({
          id: page.id + '-' + imageId,
          pageId: page.id,
          imageId,
          thumbnailUrl: makeThumbnailUrl_(imageId),
          caption: page.title,
          order: order++,
          published: true
        });
      }
    } catch (error) {
      // Folder access is optional; page content still works when folder photos are unavailable.
    }
  });

  return photos;
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
      if (header) acc[header] = row[index];
      return acc;
    }, {});
  });
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

function makeThumbnailUrl_(imageId) {
  return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(imageId) + '&sz=w1600';
}

function sortByOrder_(a, b) {
  return Number(a.order || 999) - Number(b.order || 999);
}
