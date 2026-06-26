(function () {
  "use strict";

  const CONFIG = window.QEF_SITE_CONFIG || {};
  const PLACEHOLDER_API = "";
  const DEFAULT_JSONP_TIMEOUT_MS = 90000;
  const COURSE_CONTENT_CATEGORY = "課程內容";
  const IMAGE_SIZES = {
    hero: 1200,
    card: 800,
    gallery: 800,
    mosaic: 640,
    thumb: 400
  };

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
    const samplePreview = shouldRenderSamplePreview();

    if (samplePreview) {
      renderSiteData(buildSampleSiteData());
    } else {
      showLoading();
    }

    loadSiteData()
      .then(function (data) {
        renderSiteData(data);
      })
      .catch(function (error) {
        if (CONFIG.useSampleDataWhenApiMissing) {
          if (!samplePreview) renderSiteData(buildSampleSiteData());
          showWarning("暫時未能連線至 Google Sheet，頁面已改用預設內容。稍後重新整理可再次嘗試。");
        } else {
          showError(error.message || "未能載入 QEF 計劃資料。");
        }
      });
  }

  function cacheElements() {
    els = {
      schoolNameZh: document.getElementById("schoolNameZh"),
      schoolNameEn: document.getElementById("schoolNameEn"),
      heroTitle: document.getElementById("heroTitle"),
      siteSubtitle: document.getElementById("siteSubtitle"),
      planTitle: document.getElementById("planTitle"),
      heroVisual: document.getElementById("heroVisual"),
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

  function shouldRenderSamplePreview() {
    return Boolean((!CONFIG.apiBaseUrl || CONFIG.apiBaseUrl === PLACEHOLDER_API) && CONFIG.useSampleDataWhenApiMissing);
  }

  function buildSampleSiteData() {
    return {
      ok: true,
      settings: {
        site_title: CONFIG.siteTitle,
        school_name_zh: CONFIG.schoolNameZh,
        school_name_en: CONFIG.schoolNameEn,
        site_subtitle: CONFIG.siteSubtitle,
        plan_title: CONFIG.planTitle,
        homepage_intro: "",
        footer_text: CONFIG.footerText
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
          imageId: extractDriveId(item.imageId || item.coverImageId || item["封面圖片ID"] || item["主要圖片ID"]),
          folderId: extractDriveId(item.folderId || item.driveFolderId || item["資料夾ID"] || item["相片資料夾ID"]),
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
          imageId: extractDriveId(item.imageId || item["圖片ID"]),
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
    const footerText = state.settings.footer_text || CONFIG.footerText || "QEF 計劃公開介紹網站";

    document.title = siteTitle;
    setText(els.schoolNameZh, schoolZh);
    setText(els.schoolNameEn, schoolEn);
    setText(els.heroTitle, siteTitle);
    setText(els.siteSubtitle, subtitle);
    setText(els.planTitle, planTitle);
    setText(els.footerSchool, schoolZh);
    setText(els.footerText, footerText);

    renderNav();
    renderHeroVisual();
    renderMetrics();
  }

  function renderNav() {
    const sections = getNavSections();
    const controls = sections.map(renderSectionControl);

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

  function renderHeroVisual() {
    if (!els.heroVisual) return;

    const photos = getHeroVisualPhotos();
    els.heroVisual.className = "hero-visual hero-photo-collage" + (photos.length ? "" : " is-placeholder");
    els.heroVisual.innerHTML = photos.length ? renderHeroPhotoCollage(photos) : renderHeroPhotoPlaceholders();
  }

  function getHeroVisualPhotos() {
    const candidates = [];
    const seen = new Set();

    getNavSections().forEach(function (section) {
      const imageUrl = getSectionCoverUrl(section, IMAGE_SIZES.hero);
      if (imageUrl) {
        candidates.push({
          src: imageUrl,
          caption: section.navTitle || section.title,
          order: section.order
        });
      }
    });

    state.photos.forEach(function (photo) {
      const imageUrl = getPhotoImageUrl(photo, IMAGE_SIZES.hero);
      if (imageUrl) {
        candidates.push({
          src: imageUrl,
          caption: photo.caption || "QEF 計劃相片",
          order: photo.order
        });
      }
    });

    return candidates.filter(function (photo) {
      if (seen.has(photo.src)) return false;
      seen.add(photo.src);
      return true;
    }).slice(0, 4);
  }

  function renderHeroPhotoCollage(photos) {
    const mainPhoto = photos[0];
    const thumbPhotos = photos.slice(1, 4);

    return `
      ${renderHeroPhotoTile(mainPhoto, 0, true)}
      <div class="hero-photo-stack">
        ${thumbPhotos.map(function (photo, index) {
          return renderHeroPhotoTile(photo, index + 1, false);
        }).join("")}
      </div>
    `;
  }

  function renderHeroPhotoTile(photo, index, isMain) {
    const imageUrl = photo && photo.src;
    const caption = (photo && photo.caption) || "QEF 計劃相片";
    const tileClass = isMain ? "hero-photo-main" : "hero-photo-thumb";

    if (!imageUrl) {
      return `
        <figure class="${tileClass} hero-photo-placeholder tone-${(index % 4) + 1}" aria-hidden="true"></figure>
      `;
    }

    return `
      <figure class="${tileClass}">
        <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(caption)}" decoding="async" fetchpriority="${isMain ? "high" : "low"}" ${isMain ? "" : "loading=\"lazy\""} />
      </figure>
    `;
  }

  function renderHeroPhotoPlaceholders() {
    return `
      <figure class="hero-photo-main hero-photo-placeholder tone-1" aria-hidden="true"></figure>
      <div class="hero-photo-stack">
        <figure class="hero-photo-thumb hero-photo-placeholder tone-2" aria-hidden="true"></figure>
        <figure class="hero-photo-thumb hero-photo-placeholder tone-3" aria-hidden="true"></figure>
        <figure class="hero-photo-thumb hero-photo-placeholder tone-4" aria-hidden="true"></figure>
      </div>
    `;
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
    bindMainContentCarousel();
    alignActiveMainContentCard();
  }

  function renderHome(section) {
    const homepageIntro = String(state.settings.homepage_intro || "").trim();
    const displaySection = homepageIntro
      ? Object.assign({}, section, {
        summary: homepageIntro.split(/\r?\n/)[0],
        body: homepageIntro
      })
      : section;
    const modules = state.sections.filter(function (item) {
      return item.category === COURSE_CONTENT_CATEGORY;
    });

    return `
      ${renderMainContentCarousel(displaySection)}

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
      ${renderMainContentCarousel()}

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

  function renderMainContentCarousel(displaySection) {
    const sections = getNavSections();
    const cards = sections.map(function (section) {
      return renderMainContentCard(displaySection && section.id === displaySection.id ? displaySection : section);
    }).join("");

    return `
      <section class="main-content-carousel" aria-label="QEF 分頁重點展示">
        <button class="main-content-arrow" type="button" data-main-carousel-direction="prev" aria-label="上一個分頁">‹</button>
        <div class="main-content-card-track">
          ${cards}
        </div>
        <button class="main-content-arrow" type="button" data-main-carousel-direction="next" aria-label="下一個分頁">›</button>
      </section>
    `;
  }

  function renderMainContentCard(section) {
    const isActive = section.id === state.activeSectionId;
    const activeClass = isActive ? " is-active" : "";
    const pressed = isActive ? "true" : "false";
    const coverUrl = getSectionCoverUrl(section, IMAGE_SIZES.card);
    const backgroundStyle = coverUrl ? ` style="--card-bg: url(&quot;${escapeAttr(coverUrl)}&quot;);"` : "";
    const detailText = getDistinctSectionBody(section);

    return `
      <button class="main-content-card${activeClass}" type="button" data-section-id="${escapeAttr(section.id)}" aria-pressed="${pressed}"${backgroundStyle}>
        <span class="main-content-scrim"></span>
        <span class="main-content-copy">
          <span class="section-kicker">${escapeHtml(section.category || "QEF Project")}</span>
          <strong>${escapeHtml(section.title)}</strong>
          ${section.summary ? `<span class="lead">${escapeHtml(section.summary)}</span>` : ""}
          ${detailText ? `<span class="main-content-detail">${escapeHtml(detailText)}</span>` : ""}
        </span>
      </button>
    `;
  }

  function getDistinctSectionBody(section) {
    const summary = normalizeInlineText(section && section.summary);
    const body = normalizeInlineText(section && section.body);
    if (!body) return "";
    if (!summary) return body;
    if (body === summary) return "";
    if (body.startsWith(summary)) {
      return body.slice(summary.length).replace(/^[\s。！？；:：,，.]+/, "").trim();
    }
    return body;
  }

  function normalizeInlineText(text) {
    return String(text == null ? "" : text).replace(/\s+/g, " ").trim();
  }

  function bindMainContentCarousel() {
    if (!els.pageView) return;

    els.pageView.querySelectorAll(".main-content-card[data-section-id]").forEach(function (control) {
      control.addEventListener("click", handleSectionClick);
    });

    els.pageView.querySelectorAll("[data-main-carousel-direction]").forEach(function (control) {
      control.addEventListener("click", handleMainContentSlide);
    });
  }

  function handleMainContentSlide(event) {
    const control = event.target.closest("[data-main-carousel-direction]");
    if (!control) return;

    const sections = getNavSections();
    if (!sections.length) return;

    const currentIndex = Math.max(0, sections.findIndex(function (section) {
      return section.id === state.activeSectionId;
    }));
    const direction = control.dataset.mainCarouselDirection === "prev" ? -1 : 1;
    const nextIndex = (currentIndex + direction + sections.length) % sections.length;

    state.activeSectionId = sections[nextIndex].id;
    renderNav();
    renderPage();
  }

  function alignActiveMainContentCard() {
    if (!els.pageView) return;

    const track = els.pageView.querySelector(".main-content-card-track");
    const activeCard = els.pageView.querySelector(".main-content-card.is-active");
    if (track && activeCard && typeof track.scrollTo === "function") {
      track.scrollTo({ left: activeCard.offsetLeft, behavior: "auto" });
    }
  }

  function renderCourseContentCard(section) {
    const coverUrl = getSectionCoverUrl(section, IMAGE_SIZES.card);
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
          ${coverUrl ? `<img src="${escapeAttr(coverUrl)}" alt="${escapeAttr(section.title)}" loading="lazy" decoding="async" />` : `<div class="course-card-placeholder">${escapeHtml(section.navTitle || section.title)}</div>`}
        </div>
      </article>
    `;
  }

  function renderCourseContentDetail(section) {
    const photos = getPhotosForSection(section.id);
    const coverUrl = getSectionCoverUrl(section, IMAGE_SIZES.hero);
    const countLabel = photos.length ? String(photos.length) + " 張相片" : "相片稍後加入";

    return `
      <a class="back-link" href="./#course-content">返回課程內容</a>

      <article class="course-detail-hero">
        ${coverUrl ? `<img src="${escapeAttr(coverUrl)}" alt="${escapeAttr(section.title)}" decoding="async" fetchpriority="high" />` : ""}
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
    const imageUrl = getPhotoImageUrl(photo, IMAGE_SIZES.mosaic);
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
        <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(caption)}" loading="lazy" decoding="async" />
        <figcaption>${escapeHtml(caption)}</figcaption>
      </figure>
    `;
  }

  function renderGalleryPhoto(photo, index) {
    const imageUrl = getPhotoImageUrl(photo, IMAGE_SIZES.gallery);
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
        <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(caption)}" loading="lazy" decoding="async" />
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

  function getSectionCoverUrl(section, size) {
    const coverFromSection = driveThumbnailUrl(section.imageId, size);
    if (coverFromSection) return coverFromSection;

    const firstPhoto = getPhotosForSection(section.id)[0];
    return firstPhoto ? getPhotoImageUrl(firstPhoto, size) : "";
  }

  function getPhotoImageUrl(photo, size) {
    if (!photo) return "";
    const driveId = extractDriveId(photo.imageId) || extractDriveId(photo.src);
    return driveId ? driveThumbnailUrl(driveId, size) : photo.src;
  }

  function driveThumbnailUrl(imageId, size) {
    const id = extractDriveId(imageId);
    const requestedSize = Number(size || IMAGE_SIZES.gallery);
    const safeSize = Number.isFinite(requestedSize) && requestedSize > 0 ? Math.round(requestedSize) : IMAGE_SIZES.gallery;
    return id ? "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w" + safeSize : "";
  }

  function extractDriveId(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^[A-Za-z0-9_-]{20,}$/.test(text)) return text;

    try {
      const url = new URL(text);
      const queryId = url.searchParams.get("id");
      if (queryId) return queryId.trim();

      const pathMatch = url.pathname.match(/\/(?:file\/d|folders)\/([A-Za-z0-9_-]{20,})/);
      if (pathMatch) return pathMatch[1];
    } catch (error) {
      // Plain IDs are handled above; malformed links fall through to regex recovery.
    }

    const match = text.match(/(?:id=|\/d\/|\/folders\/)([A-Za-z0-9_-]{20,})/);
    return match ? match[1] : text;
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
    extractDriveId,
    findSection,
    getPhotoImageUrl,
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
