(function () {
  "use strict";

  const CONFIG = window.QEF_SITE_CONFIG || {};
  const PLACEHOLDER_API = "";
  const DEFAULT_JSONP_TIMEOUT_MS = 90000;
  const COURSE_CONTENT_CATEGORY = "課程內容";

  const state = {
    settings: {},
    sections: [],
    photos: [],
    metrics: [],
    activeSectionId: "home"
  };

  let els = {};

  function init() {
    cacheElements();
    state.activeSectionId = getActiveSectionId(window.location.search);

    if (shouldRenderSampleWhileApiLoads()) {
      renderSiteData(buildSampleSiteData());
      showStatus(
        "is-loading",
        "正在讀取最新內容",
        "Google 相片資料較多，可能需時約 1 分鐘；現先顯示網站預設內容。"
      );
    } else {
      showLoading();
    }

    loadSiteData()
      .then(function (data) {
        renderSiteData(data);
      })
      .catch(function (error) {
        if (shouldRenderSampleWhileApiLoads()) {
          showWarning("暫時未能連線至 Google Sheet，頁面已先顯示預設內容。稍後重新整理可再次嘗試。");
        } else {
          showError(error.message || "未能載入 QEF 計劃資料。");
        }
      });
  }

  function cacheElements() {
    els = {
      schoolNameZh: document.getElementById("schoolNameZh"),
      schoolNameEn: document.getElementById("schoolNameEn"),
      siteSubtitle: document.getElementById("siteSubtitle"),
      planTitle: document.getElementById("planTitle"),
      footerSchool: document.getElementById("footerSchool"),
      footerText: document.getElementById("footerText"),
      siteNav: document.getElementById("siteNav"),
      sectionTabs: document.getElementById("sectionTabs"),
      metricRow: document.getElementById("metricRow"),
      status: document.getElementById("status"),
      pageView: document.getElementById("pageView")
    };
  }

  function loadSiteData() {
    if (CONFIG.apiBaseUrl && CONFIG.apiBaseUrl !== PLACEHOLDER_API) {
      const url = buildApiUrl("site");
      return (CONFIG.apiMode || "jsonp") === "jsonp" ? jsonp(url) : fetchJson(url);
    }

    if (CONFIG.useSampleDataWhenApiMissing) {
      return Promise.resolve(buildSampleSiteData());
    }

    return Promise.reject(new Error("尚未設定 Apps Script API URL。"));
  }

  function shouldRenderSampleWhileApiLoads() {
    return Boolean(CONFIG.apiBaseUrl && CONFIG.apiBaseUrl !== PLACEHOLDER_API && CONFIG.useSampleDataWhenApiMissing);
  }

  function buildSampleSiteData() {
    return {
      ok: true,
      settings: {
        site_title: CONFIG.siteTitle,
        school_name_zh: CONFIG.schoolNameZh,
        school_name_en: CONFIG.schoolNameEn,
        site_subtitle: CONFIG.siteSubtitle,
        plan_title: CONFIG.planTitle
      },
      pages: CONFIG.sections || [],
      photos: CONFIG.photos || [],
      metrics: CONFIG.metrics || []
    };
  }

  function renderSiteData(data) {
    applyData(data);
    renderShell();
    renderPage();
  }

  function buildApiUrl(action) {
    const params = new URLSearchParams({ action: action });
    return CONFIG.apiBaseUrl + (CONFIG.apiBaseUrl.includes("?") ? "&" : "?") + params.toString();
  }

  function fetchJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error("API request failed: " + response.status);
      return response.json();
    });
  }

  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      const callback = "qef_jsonp_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const separator = url.includes("?") ? "&" : "?";
      const timeoutMs = Number(CONFIG.apiTimeoutMs || DEFAULT_JSONP_TIMEOUT_MS);
      const timer = window.setTimeout(function () {
        cleanup();
        reject(new Error("Apps Script API 載入逾時。"));
      }, timeoutMs);

      function cleanup() {
        window.clearTimeout(timer);
        delete window[callback];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callback] = function (payload) {
        cleanup();
        resolve(payload);
      };

      script.onerror = function () {
        cleanup();
        reject(new Error("Apps Script API 無法連線。"));
      };

      script.src = url + separator + "callback=" + encodeURIComponent(callback);
      document.body.appendChild(script);
    });
  }

  function applyData(data) {
    if (!data || data.ok === false) {
      throw new Error((data && data.error) || "API 回傳格式不正確。");
    }

    state.settings = data.settings || {};
    state.sections = normalizeSections(data.pages || CONFIG.sections || []);
    state.photos = normalizePhotos(data.photos || CONFIG.photos || []);
    state.metrics = normalizeMetrics(data.metrics || CONFIG.metrics || []);

    if (!findSection(state.activeSectionId)) {
      state.activeSectionId = "home";
    }
  }

  function normalizeSections(items) {
    return items
      .map(function (item) {
        return {
          id: normalizeSectionId(item.id || item.pageId || item.relatedId || item["相關代號"] || item["頁面代號"]),
          title: String(item.title || item.name || item.relatedName || item["相關名稱"] || item["頁面名稱"] || "").trim(),
          navTitle: String(item.navTitle || item["導航名稱"] || item["分類"] || item.title || "").trim(),
          category: normalizeCategory(item.category || item["分類"]),
          order: Number(item.order || item["排序"] || 999),
          date: String(item.date || item.activityDate || item["活動日期"] || "").trim(),
          summary: String(item.summary || item["頁面摘要"] || item.description || item["相關簡介"] || "").trim().split(/\r?\n/)[0],
          body: String(item.body || item.description || item["相關簡介"] || item["詳細介紹"] || item.summary || "").trim(),
          imageId: String(item.imageId || item.coverImageId || item["封面圖片ID"] || item["主要圖片ID"] || "").trim(),
          folderId: String(item.folderId || item.driveFolderId || item["資料夾ID"] || item["相片資料夾ID"] || "").trim(),
          published: parseBoolean(item.published !== undefined ? item.published : item["公開顯示"])
        };
      })
      .filter(function (item) {
        return item.id && item.title && item.published;
      })
      .sort(function (a, b) {
        return a.order - b.order || a.title.localeCompare(b.title, "zh-Hant");
      });
  }

  function normalizePhotos(items) {
    return items
      .map(function (item) {
        return {
          id: String(item.id || item.photoId || item["相片代號"] || "").trim(),
          pageId: normalizeSectionId(item.pageId || item["頁面代號"]),
          imageId: String(item.imageId || item["圖片ID"] || "").trim(),
          src: String(item.src || item.thumbnailUrl || "").trim(),
          caption: String(item.caption || item["圖片說明"] || "").trim(),
          order: Number(item.order || item["排序"] || 999),
          published: parseBoolean(item.published !== undefined ? item.published : item["公開顯示"])
        };
      })
      .filter(function (item) {
        return item.pageId && item.published;
      })
      .sort(function (a, b) {
        return a.order - b.order || a.id.localeCompare(b.id);
      });
  }

  function normalizeMetrics(items) {
    return items
      .map(function (item) {
        return {
          id: String(item.id || item.metricId || item["指標代號"] || "").trim(),
          label: String(item.label || item["顯示名稱"] || "").trim(),
          value: String(item.value || item["數值"] || "").trim(),
          detail: String(item.detail || item["補充文字"] || "").trim(),
          order: Number(item.order || item["排序"] || 999),
          published: parseBoolean(item.published !== undefined ? item.published : item["公開顯示"])
        };
      })
      .filter(function (item) {
        return item.label && item.value && item.published;
      })
      .sort(function (a, b) {
        return a.order - b.order || a.label.localeCompare(b.label, "zh-Hant");
      });
  }

  function renderShell() {
    const schoolZh = state.settings.school_name_zh || CONFIG.schoolNameZh || "";
    const schoolEn = state.settings.school_name_en || CONFIG.schoolNameEn || "";
    const siteTitle = state.settings.site_title || CONFIG.siteTitle || "普光 QEF 計劃";
    const subtitle = state.settings.site_subtitle || CONFIG.siteSubtitle || "";
    const planTitle = state.settings.plan_title || CONFIG.planTitle || "";

    document.title = siteTitle;
    setText(els.schoolNameZh, schoolZh);
    setText(els.schoolNameEn, schoolEn);
    setText(els.siteSubtitle, subtitle);
    setText(els.planTitle, planTitle);
    setText(els.footerSchool, schoolZh);
    setText(els.footerText, CONFIG.footerText || "QEF 計劃公開介紹網站");

    renderNav();
    renderMetrics();
  }

  function renderNav() {
    const controls = getNavSections().map(renderSectionControl);

    if (els.siteNav) els.siteNav.innerHTML = controls.join("");
    if (els.sectionTabs) els.sectionTabs.innerHTML = controls.join("");

    document.querySelectorAll(".site-nav [data-section-id], .section-tabs [data-section-id]").forEach(function (control) {
      control.addEventListener("click", handleSectionClick);
    });
  }

  function renderSectionControl(section) {
    const isActive = section.id === state.activeSectionId;
    const activeClass = isActive ? " is-active" : "";
    const pressed = isActive ? "true" : "false";
    const label = section.navTitle || section.title;

    return `<button class="nav-link cue-card-nav${activeClass}" type="button" data-section-id="${escapeAttr(section.id)}" aria-pressed="${pressed}">${escapeHtml(label)}</button>`;
  }

  function handleSectionClick(event) {
    const control = event.target.closest("[data-section-id]");
    if (!control) return;

    const nextId = normalizeSectionId(control.dataset.sectionId);
    if (!findSection(nextId)) return;

    event.preventDefault();
    state.activeSectionId = nextId;
    renderNav();
    renderPage();
  }

  function renderMetrics() {
    if (!els.metricRow) return;

    els.metricRow.innerHTML = state.metrics.map(function (metric) {
      return `
        <article class="metric-card">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.value)}</strong>
          <p>${escapeHtml(metric.detail)}</p>
        </article>
      `;
    }).join("");
  }

  function renderPage() {
    const section = findSection(state.activeSectionId) || findSection("home") || state.sections[0];
    if (!section || !els.pageView) {
      showError("未有可顯示的 QEF 分頁。");
      return;
    }

    hideStatus();
    els.pageView.hidden = false;
    if (section.category === COURSE_CONTENT_CATEGORY) {
      els.pageView.innerHTML = renderCourseContentDetail(section);
      return;
    }

    els.pageView.innerHTML = section.id === "home" ? renderHome(section) : renderDetail(section);
  }

  function renderHome(section) {
    const highlights = state.sections.filter(function (item) {
      return item.id !== "home" && item.category !== COURSE_CONTENT_CATEGORY;
    });
    const modules = state.sections.filter(function (item) {
      return item.category === COURSE_CONTENT_CATEGORY;
    });

    return `
      <article class="intro-layout">
        <div class="intro-copy">
          <p class="section-kicker">${escapeHtml(section.category || "QEF Project")}</p>
          <h2>${escapeHtml(section.title)}</h2>
          <p class="lead">${escapeHtml(section.summary)}</p>
          <p>${escapeHtml(section.body)}</p>
        </div>
        ${renderPhotoMosaic(section)}
      </article>

      <section class="content-section" aria-labelledby="arrangementTitle">
        <div class="section-heading">
          <p class="section-kicker">Project Areas</p>
          <h2 id="arrangementTitle">計劃分頁</h2>
        </div>
        <div class="feature-grid">
          ${highlights.map(renderFeatureCard).join("")}
        </div>
      </section>

      ${modules.length ? `
        <section class="content-section course-content-section" id="course-content" aria-labelledby="moduleTitle">
          <div class="section-heading">
            <p class="section-kicker">Course Content</p>
            <h2 id="moduleTitle">課程內容</h2>
          </div>
          <div class="course-content-grid">
            ${modules.map(renderCourseContentCard).join("")}
          </div>
        </section>
      ` : ""}
    `;
  }

  function renderDetail(section) {
    const siblingSections = state.sections.filter(function (item) {
      return item.category === COURSE_CONTENT_CATEGORY;
    }).slice(0, 3);

    return `
      <article class="detail-layout">
        <div class="detail-main">
          <p class="section-kicker">${escapeHtml(section.category || "QEF Project")}</p>
          <h2>${escapeHtml(section.title)}</h2>
          <p class="lead">${escapeHtml(section.summary)}</p>
          <p>${escapeHtml(section.body)}</p>
        </div>
        ${renderPhotoMosaic(section)}
      </article>

      <section class="content-section" aria-labelledby="relatedTitle">
        <div class="section-heading">
          <p class="section-kicker">More</p>
          <h2 id="relatedTitle">課程內容</h2>
        </div>
        <div class="course-content-grid compact">
          ${siblingSections.map(renderCourseContentCard).join("")}
        </div>
      </section>
    `;
  }

  function renderCourseContentCard(section) {
    const coverUrl = getSectionCoverUrl(section);
    const photos = getPhotosForSection(section.id);
    const photoCount = photos.length;

    return `
      <article class="course-card">
        <div class="course-card-copy">
          <span class="course-pill">${escapeHtml(section.category || COURSE_CONTENT_CATEGORY)}</span>
          <h3>${escapeHtml(section.title)}</h3>
          <p>${escapeHtml(section.summary || section.body)}</p>
          <div class="course-meta">
            ${section.date ? `<span>${escapeHtml(section.date)}</span>` : ""}
            <span>${photoCount ? escapeHtml(String(photoCount) + " 張相片") : "相片稍後加入"}</span>
          </div>
          <a class="course-button" href="${escapeAttr(makeSectionHref(section.id))}" data-section-id="${escapeAttr(section.id)}">查看相簿</a>
        </div>
        <div class="course-card-media">
          ${coverUrl ? `<img src="${escapeAttr(coverUrl)}" alt="${escapeAttr(section.title)}" loading="lazy" />` : `<div class="course-card-placeholder">${escapeHtml(section.navTitle || section.title)}</div>`}
        </div>
      </article>
    `;
  }

  function renderCourseContentDetail(section) {
    const photos = getPhotosForSection(section.id);
    const coverUrl = getSectionCoverUrl(section);
    const countLabel = photos.length ? String(photos.length) + " 張相片" : "相片稍後加入";

    return `
      <a class="back-link" href="./#course-content">返回課程內容</a>

      <article class="course-detail-hero">
        ${coverUrl ? `<img src="${escapeAttr(coverUrl)}" alt="${escapeAttr(section.title)}" />` : ""}
        <div class="course-detail-overlay">
          <span class="course-pill">${escapeHtml(section.category || COURSE_CONTENT_CATEGORY)}</span>
          <h2>${escapeHtml(section.title)}</h2>
          <p>${escapeHtml(section.body || section.summary)}</p>
          <div class="course-detail-meta">
            ${section.date ? `<span>${escapeHtml(section.date)}</span>` : ""}
            <span>${escapeHtml(countLabel)}</span>
          </div>
        </div>
      </article>

      <section class="course-gallery-section" aria-labelledby="courseGalleryTitle">
        <div class="section-heading">
          <p class="section-kicker">Gallery</p>
          <h2 id="courseGalleryTitle">相片記錄</h2>
        </div>
        <div class="course-gallery">
          ${(photos.length ? photos : [{ caption: section.title, imageId: section.imageId }]).map(renderGalleryPhoto).join("")}
        </div>
      </section>
    `;
  }

  function renderFeatureCard(section) {
    return `
      <article class="feature-card">
        <span>${escapeHtml(section.category || "QEF")}</span>
        <h3>${escapeHtml(section.title)}</h3>
        <p>${escapeHtml(section.summary)}</p>
        <a href="${escapeAttr(makeSectionHref(section.id))}" data-section-id="${escapeAttr(section.id)}">查看內容</a>
      </article>
    `;
  }

  function renderPhotoMosaic(section) {
    const photos = getPhotosForSection(section.id);
    const visiblePhotos = photos.length ? photos : [
      { caption: section.title, pageId: section.id, order: 1 },
      { caption: section.summary, pageId: section.id, order: 2 },
      { caption: "相片稍後加入", pageId: section.id, order: 3 }
    ];

    return `
      <div class="photo-mosaic" aria-label="${escapeAttr(section.title)}相片">
        ${visiblePhotos.slice(0, 4).map(renderPhotoTile).join("")}
      </div>
    `;
  }

  function renderPhotoTile(photo, index) {
    const imageUrl = photo.src || driveThumbnailUrl(photo.imageId);
    const caption = photo.caption || "QEF 計劃相片";

    if (!imageUrl) {
      return `
        <figure class="photo-tile placeholder-tile tone-${(index % 4) + 1}">
          <figcaption>${escapeHtml(caption)}</figcaption>
        </figure>
      `;
    }

    return `
      <figure class="photo-tile">
        <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(caption)}" loading="lazy" />
        <figcaption>${escapeHtml(caption)}</figcaption>
      </figure>
    `;
  }

  function renderGalleryPhoto(photo, index) {
    const imageUrl = photo.src || driveThumbnailUrl(photo.imageId);
    const caption = photo.caption || "QEF 計劃相片";

    if (!imageUrl) {
      return `
        <figure class="gallery-photo placeholder-tile tone-${(index % 4) + 1}">
          <figcaption>${escapeHtml(caption)}</figcaption>
        </figure>
      `;
    }

    return `
      <figure class="gallery-photo">
        <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(caption)}" loading="lazy" />
        <figcaption>${escapeHtml(caption)}</figcaption>
      </figure>
    `;
  }

  function getPhotosForSection(sectionId) {
    const section = findSection(sectionId);
    const photos = state.photos.filter(function (photo) {
      return photo.pageId === sectionId;
    });

    if (section && section.imageId) {
      photos.unshift({
        id: section.id + "-cover",
        pageId: section.id,
        imageId: section.imageId,
        caption: section.title,
        order: 0,
        published: true
      });
    }

    return dedupePhotos(photos);
  }

  function dedupePhotos(photos) {
    const seen = new Set();

    return photos.filter(function (photo) {
      const key = photo.imageId || photo.src || photo.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getNavSections() {
    return state.sections.filter(function (section) {
      return section.category !== COURSE_CONTENT_CATEGORY;
    });
  }

  function getSectionCoverUrl(section) {
    const coverFromSection = driveThumbnailUrl(section.imageId);
    if (coverFromSection) return coverFromSection;

    const firstPhoto = getPhotosForSection(section.id)[0];
    return firstPhoto ? firstPhoto.src || driveThumbnailUrl(firstPhoto.imageId) : "";
  }

  function driveThumbnailUrl(imageId) {
    const id = String(imageId || "").trim();
    return id ? "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w1600" : "";
  }

  function getActiveSectionId(search) {
    const params = new URLSearchParams(search || "");
    return normalizeSectionId(params.get("section") || "home");
  }

  function normalizeSectionId(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeCategory(value) {
    const text = String(value || "").trim();
    return text === "\u8ab2\u7a0b\u7bc4\u7587" ? COURSE_CONTENT_CATEGORY : text;
  }

  function findSection(sectionId) {
    const normalized = normalizeSectionId(sectionId);
    return state.sections.find(function (section) {
      return section.id === normalized;
    });
  }

  function makeSectionHref(sectionId) {
    return sectionId === "home" ? "./" : "./?section=" + encodeURIComponent(sectionId);
  }

  function parseBoolean(value) {
    if (value === undefined || value === null || value === "") return true;
    if (value === true) return true;
    if (value === false) return false;
    const text = String(value).trim().toUpperCase();
    return ["TRUE", "YES", "Y", "1", "公開"].includes(text);
  }

  function showLoading() {
    if (els.status) {
      els.status.hidden = false;
      els.status.className = "status is-loading";
    }
    if (els.pageView) els.pageView.hidden = true;
  }

  function hideStatus() {
    if (els.status) els.status.hidden = true;
  }

  function showError(message) {
    if (els.status) {
      els.status.hidden = false;
      els.status.className = "status is-error";
      els.status.innerHTML = `<strong>資料載入失敗</strong><span>${escapeHtml(message)}</span>`;
    }
    if (els.pageView) els.pageView.hidden = true;
  }

  function showWarning(message) {
    showStatus("is-warning", "暫時顯示預設內容", message);
    if (els.pageView) els.pageView.hidden = false;
  }

  function showStatus(statusClass, title, message) {
    if (!els.status) return;

    els.status.hidden = false;
    els.status.className = "status " + statusClass;
    els.status.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  }

  function setText(element, value) {
    if (element) element.textContent = value || "";
  }

  function escapeHtml(text) {
    return String(text == null ? "" : text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(text) {
    return escapeHtml(text).replaceAll("`", "&#096;");
  }

  window.addEventListener("popstate", function () {
    state.activeSectionId = getActiveSectionId(window.location.search);
    renderNav();
    renderPage();
  });

  window.QefSiteTest = {
    buildSampleSiteData,
    driveThumbnailUrl,
    findSection,
    getActiveSectionId,
    getNavSections,
    normalizeSectionId,
    normalizeSections,
    parseBoolean
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
