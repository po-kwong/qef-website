const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notStrictEqual(start, -1, `${name} should exist`);
  const next = source.indexOf("\n  function ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function loadConfig() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(read("config.js"), sandbox, { filename: "config.js" });
  return sandbox.window.QEF_SITE_CONFIG;
}

const html = read("index.html");
const css = read("assets/styles.css");
const app = read("assets/app.js");
const codeGs = read("apps-script/Code.gs");
const config = loadConfig();
const heroPhotoTileFunction = extractFunction(app, "renderHeroPhotoTile");
const heroPhotoPlaceholdersFunction = extractFunction(app, "renderHeroPhotoPlaceholders");
const driveThumbnailUrlFunction = extractFunction(app, "driveThumbnailUrl");
const getPhotoImageUrlFunction = extractFunction(app, "getPhotoImageUrl");
const makeThumbnailUrlFunction = extractFunction(codeGs, "makeThumbnailUrl_");
const liveProbe = read("scripts/probe-live-site.js");
const snapshotScriptPath = path.join(root, "scripts", "snapshot-qef-defaults.js");
const snapshotScript = fs.existsSync(snapshotScriptPath) ? read("scripts/snapshot-qef-defaults.js") : "";
const renderShellFunction = extractFunction(app, "renderShell");
const initFunction = extractFunction(app, "init");
const renderPageFunction = extractFunction(app, "renderPage");
const syncPageChromeFunction = extractFunction(app, "syncPageChrome");
const renderMainContentCardFunction = extractFunction(app, "renderMainContentCard");
const normalizeSectionsFunction = extractFunction(app, "normalizeSections");
const getDistinctSectionBodyFunction = extractFunction(app, "getDistinctSectionBody");
const splitDescriptionParagraphsFunction = extractFunction(app, "splitDescriptionParagraphs");
const getSummaryFromDescriptionFunction = extractFunction(codeGs, "getSummaryFromDescription_");

assert.match(html, /<html lang="zh-Hant">/);
assert.match(html, /assets\/styles\.css\?v=[^"]+/, "stylesheet URL should include an asset version to bypass stale GitHub Pages/browser cache");
assert.match(html, /config\.js\?v=[^"]+/, "config URL should include an asset version to refresh the snapshot after deploys");
assert.match(html, /assets\/app\.js\?v=[^"]+/, "app URL should include an asset version to bypass stale GitHub Pages/browser cache");
assert.doesNotMatch(html, /href="\.\/assets\/styles\.css"/, "stylesheet should not be referenced without a cache-busting version");
assert.doesNotMatch(html, /src="\.\/assets\/app\.js"/, "app script should not be referenced without a cache-busting version");
assert.match(html, /id="heroVisual"/, "hero visual should have a JS-rendered photo collage mount");
assert.ok(fs.existsSync(path.join(root, "assets", "school-logo.png")), "school logo asset should exist");
assert.match(html, /<header class="site-header">[\s\S]*class="brand"[\s\S]*assets\/school-logo\.png/, "header brand should include the school logo");
assert.match(html, /id="schoolNameZh"/, "header brand should include the Chinese school name mount");
assert.match(html, /id="schoolNameEn"/, "header brand should include the English school name mount");
assert.match(html, /id="heroTitle"/, "hero title should be addressable from live settings");
assert.match(html, /<title>普光高中教育︰實境教學<\/title>/, "initial HTML title should match the current config snapshot");
assert.match(html, /<h1 id="heroTitle">普光高中教育︰實境教學<\/h1>/, "initial hero title should not show stale pre-snapshot content while API loads");
assert.match(html, /<nav class="site-nav" id="siteNav"[^>]*><\/nav>/, "top nav should stay an empty dynamic mount");

assert.ok(config, "QEF_SITE_CONFIG should exist");
assert.strictEqual(config.schoolNameZh, "香海正覺蓮社佛教普光學校");
assert.ok(Array.isArray(config.sections), "sections should be an array");
assert.ok(config.sections.length >= 5, "site should include homepage plus at least four content sections");
assert.ok(config.sections.some((section) => section.id === "home"), "home section should exist");
assert.ok(config.sections.every((section) => section.title && section.summary), "each section needs title and summary");
assert.ok(config.googleSheet, "config should document the Google Sheet backend");
assert.strictEqual(config.googleSheet.spreadsheetId, "1hplWteuEJGSkNrn0S2AyzHoDxw_DJK_DW_XRyHL4FQM");
assert.deepStrictEqual(Array.from(config.googleSheet.tabs), ["QEF_Settings", "QEF_Pages", "QEF_Metrics"]);
assert.strictEqual(config.googleDrive.photoRootFolderId, "1wibEm9nltRtrFjoLIN0yuKWYUwVF5MuB");
assert.ok(config.apiTimeoutMs >= 90000, "live Apps Script API timeout should allow slow cold starts");
assert.ok(config.photos.some((photo) => photo.imageId), "fallback photos should include real Drive image IDs");
assert.ok(
  config.photos.some((photo) => photo.pageId === "light-food-prep" && photo.imageId),
  "nested course folders should have fallback photos"
);

assert.match(css, /@media \(max-width: 760px\)/, "mobile breakpoint should exist");
assert.match(css, /\.photo-mosaic/, "photo mosaic styles should exist");
assert.match(css, /\.hero-photo-collage/, "hero visual should render as a photo collage");
assert.match(css, /\.hero-photo-main/, "hero collage should include a main featured photo");
assert.doesNotMatch(css, /\.site-header\s*\{\s*display:\s*none/, "header should show the logo and school names");
assert.match(css, /\.site-header \.site-nav\s*\{[\s\S]*?display:\s*none/, "top header navigation should remain hidden");

assert.match(app, /window\.QefSiteTest/, "app should expose test hooks");
assert.match(app, /DEFAULT_JSONP_TIMEOUT_MS/, "frontend should use a named JSONP timeout");
assert.doesNotMatch(app, /}, 20000\)/, "frontend should not hard-code a 20 second API timeout");
assert.match(app, /buildSampleSiteData/, "frontend should be able to render sample data before live API returns");
assert.match(initFunction, /const samplePreview = shouldRenderSamplePreview\(\)/, "frontend should distinguish local sample preview from live API loading");
assert.match(initFunction, /const fallbackData = buildSampleSiteData\(\)/, "frontend should build a config.js snapshot before live API returns");
assert.match(initFunction, /renderSiteData\(fallbackData\)/, "frontend should render the config.js snapshot immediately instead of showing stale HTML while API loads");
assert.match(app, /function shouldRenderSamplePreview/, "sample data should be a no-API preview path, not the normal live API first paint");
assert.doesNotMatch(app, /function shouldRenderSampleWhileApiLoads/, "live API loading should not render stale sample content first");
assert.match(app, /heroTitle: document\.getElementById\("heroTitle"\)/, "frontend should cache the hero title mount");
assert.match(renderShellFunction, /setText\(els\.heroTitle, siteTitle\)/, "QEF_Settings site_title should update the visible hero title");
assert.match(renderShellFunction, /state\.settings\.footer_text/, "QEF_Settings footer_text should be able to update the footer");
assert.strictEqual(config.siteTitle, "普光高中教育︰實境教學", "fallback site title should match the live QEF setting");
assert.doesNotMatch(app, /homepage_intro/, "homepage card copy should come from QEF_Pages 相關簡介, not QEF_Settings homepage_intro");
assert.match(normalizeSectionsFunction, /const description = getSectionDescription\(item\)/, "frontend should normalize each row through one QEF_Pages description source");
assert.match(normalizeSectionsFunction, /summary: getDescriptionLead\(description\)/, "card lead should come from the first description paragraph");
assert.match(normalizeSectionsFunction, /body: description/, "card body should keep the full QEF_Pages description for detail splitting");
assert.match(splitDescriptionParagraphsFunction, /split\(\/\\r\?\\n\\s\*\\r\?\\n\/\)/, "QEF_Pages description paragraphs should be separated by one blank line");
assert.match(getDistinctSectionBodyFunction, /splitDescriptionParagraphs\(section && section\.body\)/, "white detail text should be derived from the full description body");
assert.match(getDistinctSectionBodyFunction, /descriptionParagraphs\.slice\(1\)\.join\(" "\)/, "white detail text should use paragraphs after the lead");
assert.match(getSummaryFromDescriptionFunction, /splitDescriptionParagraphs_\(description\)/, "Apps Script summary should follow the same paragraph split contract");
assert.match(app, /showWarning/, "frontend should keep fallback content visible on slow API failures");
assert.match(app, /function renderHeroVisual/, "frontend should render hero visual from site photos");
assert.match(app, /function getHeroVisualPhotos/, "frontend should select photos for the hero collage");
assert.match(app, /function extractDriveId/, "frontend should accept full Google Drive image links in Sheet fields");
assert.match(app, /searchParams\.get\("id"\)/, "frontend should extract Drive IDs from open?id links");
assert.match(app, /const IMAGE_SIZES = \{/, "frontend should centralize thumbnail sizes by UI purpose");
assert.match(driveThumbnailUrlFunction, /function driveThumbnailUrl\(imageId, size\)/, "Drive thumbnail helper should accept an explicit size");
assert.match(driveThumbnailUrlFunction, /Number\(size \|\| IMAGE_SIZES\.gallery\)/, "Drive thumbnail helper should default to gallery-sized images");
assert.doesNotMatch(driveThumbnailUrlFunction, /w1600/, "Drive thumbnail helper should not force every image to w1600");
assert.match(getPhotoImageUrlFunction, /function getPhotoImageUrl\(photo, size\)/, "photo URL helper should accept an explicit thumbnail size");
assert.match(getPhotoImageUrlFunction, /extractDriveId\(photo\.src\)/, "photo URL helper should resize Drive thumbnailUrl values returned by Apps Script");
assert.match(app, /heroVisual/, "frontend should cache the hero visual mount");
assert.match(app, /hero-photo-collage/, "frontend should output hero photo collage markup");
assert.match(app, /hero-photo-placeholder/, "hero visual should keep placeholders when photos are missing");
assert.match(heroPhotoTileFunction, /<img src="\$\{escapeAttr\(imageUrl\)\}" alt="\$\{escapeAttr\(caption\)\}/, "hero photos should keep accessible alt text");
assert.match(heroPhotoTileFunction, /decoding="async"/, "hero photos should decode asynchronously");
assert.match(heroPhotoTileFunction, /fetchpriority="\$\{isMain \? "high" : "low"\}"/, "hero should prioritize the main photo and de-prioritize small hero thumbnails");
assert.doesNotMatch(
  heroPhotoTileFunction,
  /<figcaption/,
  "hero photo collage should not show visible caption labels over photos"
);
assert.doesNotMatch(
  heroPhotoPlaceholdersFunction,
  /<figcaption|<span>QEF<\/span>/,
  "hero placeholders should stay visual-only without visible text"
);
assert.doesNotMatch(
  html,
  /id="heroVisual"[\s\S]*?<figcaption|id="heroVisual"[\s\S]*?<span>QEF<\/span>/,
  "initial hero placeholder should not show visible labels before JavaScript loads"
);
assert.doesNotMatch(css, /\.hero-photo-main figcaption/, "hero photo collage caption overlay styles should not remain");
assert.doesNotMatch(css, /\.hero-photo-thumb figcaption/, "hero thumbnail caption overlay styles should not remain");
assert.doesNotMatch(css, /\.hero-photo-placeholder figcaption/, "hero placeholder caption styles should not remain");
assert.match(app, /COURSE_CONTENT_CATEGORY = "課程內容"/, "frontend should use the new course content category");
assert.match(app, /renderCourseContentCard/, "course content should use the album-style card renderer");
assert.match(app, /renderCourseContentDetail/, "course content should use the album-style detail renderer");
assert.match(renderPageFunction, /syncPageChrome\(section\)/, "course detail pages should update page chrome visibility before rendering");
assert.match(syncPageChromeFunction, /document\.body\.classList\.toggle\(\s*"is-course-detail-page"/, "frontend should mark nested course detail pages with a body class");
assert.match(syncPageChromeFunction, /section\.category === COURSE_CONTENT_CATEGORY/, "only course content detail pages should use the compact page chrome");
assert.match(css, /\.is-course-detail-page \.hero-band,\s*\.is-course-detail-page \.summary-band\s*\{[\s\S]*display:\s*none/, "nested course detail pages should hide the homepage hero and metrics");
assert.match(app, /function renderSectionControl/, "main sections should render as cue-card controls");
assert.doesNotMatch(app, /function renderSectionCarousel/, "section tabs should stay as compact controls when the main content card rotates");
assert.match(app, /function renderMainContentCarousel/, "main content area should render as a carousel");
assert.match(app, /function renderMainContentCard/, "main content carousel should render content cards");
assert.match(renderMainContentCardFunction, /const detailText = getDistinctSectionBody\(section\)/, "main content cards should remove duplicated summary/body text");
assert.match(renderMainContentCardFunction, /main-content-detail/, "main content cards should style optional detail text separately");
assert.match(app, /function getDistinctSectionBody/, "frontend should keep carousel overview copy concise");
assert.match(app, /main-content-card-track/, "main content carousel should include a horizontal card track");
assert.match(app, /data-main-carousel-direction/, "main content carousel should include left and right controls");
assert.match(app, /handleMainContentSlide/, "main content carousel controls should switch sections");
assert.match(app, /getSectionCoverUrl\(section, IMAGE_SIZES\.card\)/, "main content cards should use card-sized section images as backgrounds");
assert.doesNotMatch(app, /arrangementTitle/, "home should not render the old Project Areas block");
assert.doesNotMatch(app, /renderFeatureCard/, "old Project Areas cards should not remain");
assert.doesNotMatch(app, /feature-grid/, "old Project Areas grid should not remain");
assert.match(css, /\.main-content-card/, "main content cards should have dedicated styles");
assert.match(css, /background-image:.*var\(--card-bg\)/, "main content card styles should support background images");
assert.match(css, /--sky:\s*#[0-9a-f]{6}/i, "colorful theme should include a sky accent token");
assert.match(css, /--sun:\s*#[0-9a-f]{6}/i, "colorful theme should include a sun accent token");
assert.match(css, /--rose:\s*#[0-9a-f]{6}/i, "colorful theme should include a rose accent token");
assert.match(css, /--violet:\s*#[0-9a-f]{6}/i, "colorful theme should include a violet accent token");
assert.match(css, /\.hero-band\s*\{[\s\S]*linear-gradient[\s\S]*linear-gradient/, "hero should use a richer colorful background");
assert.match(css, /\.metric-card:nth-child\(4n \+ 1\)[\s\S]*--metric-accent/, "metric cards should use rotating accent colors");
assert.match(
  css,
  /\.course-card-media,\s*\n\.course-card-placeholder\s*\{[\s\S]*?aspect-ratio:\s*16\s*\/\s*9/,
  "course cover frames should use one stable 16:9 ratio"
);
assert.match(
  css,
  /\.course-card-media img\s*\{[\s\S]*?display:\s*block[\s\S]*?object-fit:\s*cover/,
  "course cover images should fill the fixed frame without stretching"
);
assert.match(app, /<button class="nav-link/, "main section controls should be buttons, not plain links");
assert.match(app, /type="button"/, "cue-card controls should not submit or navigate by default");
assert.match(app, /aria-pressed="/, "cue-card controls should expose their selected state");
assert.match(css, /\.section-tabs\s*\{[\s\S]*?flex-wrap:\s*wrap/, "page-level section tabs should remain visible and responsive");
assert.doesNotMatch(app, /window\.history\.pushState/, "section switching should stay on the page without changing the URL");
assert.doesNotMatch(app, /其他部分/, "old related section label should not remain");
assert.doesNotMatch(app, /課程範疇/, "old course category label should not remain");
assert.match(codeGs, /QEF_Pages/);
assert.doesNotMatch(codeGs, /QEF_Photos/, "Apps Script should no longer read QEF_Photos");
assert.match(codeGs, /相關代號/, "Apps Script should read the new QEF_Pages schema");
assert.match(codeGs, /相關名稱/, "Apps Script should read the new QEF_Pages schema");
assert.match(codeGs, /資料夾ID/, "Apps Script should read the new QEF_Pages schema");
assert.match(codeGs, /封面圖片ID/, "Apps Script should read the new QEF_Pages schema");
assert.match(codeGs, /const description = getText_\(row\['相關簡介'\]\)/, "Apps Script card copy should come directly from QEF_Pages 相關簡介");
assert.doesNotMatch(codeGs, /詳細介紹|頁面摘要/, "Apps Script should not fall back to hidden legacy description columns for card copy");
assert.match(codeGs, /acc\[header\] === undefined/, "Apps Script should keep the first value when hidden legacy headers are present");
assert.match(codeGs, /doGet/);
assert.match(codeGs, /jsonp/);
assert.match(codeGs, /collectImagesFromFolder_/, "Apps Script should collect nested Drive folder photos");
assert.match(codeGs, /CacheService\.getScriptCache/, "Apps Script should cache expensive site payloads");
assert.match(codeGs, /getCachedSitePayload_/, "Apps Script should cache the site API response");
assert.match(codeGs, /clearQefCache/, "Apps Script should expose a manual cache clear helper");
assert.match(codeGs, /warmQefSiteCache/, "Apps Script should expose a manual cache warm helper");
assert.match(codeGs, /DEFAULT_THUMBNAIL_SIZE = 800/, "Apps Script should return moderate default thumbnail URLs for folder photos");
assert.match(makeThumbnailUrlFunction, /function makeThumbnailUrl_\(imageId, size\)/, "Apps Script thumbnail helper should accept an explicit size");
assert.match(makeThumbnailUrlFunction, /Number\(size \|\| DEFAULT_THUMBNAIL_SIZE\)/, "Apps Script thumbnail helper should default to the configured thumbnail size");
assert.doesNotMatch(makeThumbnailUrlFunction, /w1600/, "Apps Script should not force every folder photo URL to w1600");

assert.match(liveProbe, /cacheVersion/, "live probe should detect whether the deployed Apps Script is the current cache-versioned backend");
assert.match(liveProbe, /deployed cacheVersion/, "live probe should warn when the deployed Apps Script cache version lags behind local Code.gs");
assert.match(liveProbe, /QEF_Photos/, "live probe should warn when the deployed API still exposes the retired QEF_Photos contract");
assert.match(liveProbe, /light-food-prep/, "live probe should check the known course cover-image regression row");
assert.ok(fs.existsSync(snapshotScriptPath), "snapshot tool should exist for refreshing config.js fallback data from live QEF_Pages");
assert.match(snapshotScript, /action=site/, "snapshot tool should read the public Apps Script site payload");
assert.match(snapshotScript, /apiBaseUrl/, "snapshot tool should preserve the configured Apps Script URL");
assert.match(snapshotScript, /sections:\s*payload\.pages/, "snapshot tool should copy QEF_Pages into config.js sections");
assert.match(snapshotScript, /photos:\s*payload\.photos/, "snapshot tool should copy live Drive photos into config.js photos");
assert.match(snapshotScript, /metrics:\s*payload\.metrics/, "snapshot tool should copy QEF_Metrics into config.js metrics");

console.log("QEF static site structure checks passed.");
