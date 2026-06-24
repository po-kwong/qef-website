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

assert.match(html, /<html lang="zh-Hant">/);
assert.match(html, /assets\/styles\.css/);
assert.match(html, /config\.js/);
assert.match(html, /assets\/app\.js/);
assert.match(html, /id="heroVisual"/, "hero visual should have a JS-rendered photo collage mount");

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

assert.match(app, /window\.QefSiteTest/, "app should expose test hooks");
assert.match(app, /DEFAULT_JSONP_TIMEOUT_MS/, "frontend should use a named JSONP timeout");
assert.doesNotMatch(app, /}, 20000\)/, "frontend should not hard-code a 20 second API timeout");
assert.match(app, /buildSampleSiteData/, "frontend should be able to render sample data before live API returns");
assert.match(app, /showWarning/, "frontend should keep fallback content visible on slow API failures");
assert.match(app, /function renderHeroVisual/, "frontend should render hero visual from site photos");
assert.match(app, /function getHeroVisualPhotos/, "frontend should select photos for the hero collage");
assert.match(app, /function extractDriveId/, "frontend should accept full Google Drive image links in Sheet fields");
assert.match(app, /searchParams\.get\("id"\)/, "frontend should extract Drive IDs from open?id links");
assert.match(app, /heroVisual/, "frontend should cache the hero visual mount");
assert.match(app, /hero-photo-collage/, "frontend should output hero photo collage markup");
assert.match(app, /hero-photo-placeholder/, "hero visual should keep placeholders when photos are missing");
assert.match(heroPhotoTileFunction, /<img src="\$\{escapeAttr\(imageUrl\)\}" alt="\$\{escapeAttr\(caption\)\}/, "hero photos should keep accessible alt text");
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
assert.match(app, /function renderSectionControl/, "main sections should render as cue-card controls");
assert.doesNotMatch(app, /function renderSectionCarousel/, "section tabs should stay as compact controls when the main content card rotates");
assert.match(app, /function renderMainContentCarousel/, "main content area should render as a carousel");
assert.match(app, /function renderMainContentCard/, "main content carousel should render content cards");
assert.match(app, /main-content-card-track/, "main content carousel should include a horizontal card track");
assert.match(app, /data-main-carousel-direction/, "main content carousel should include left and right controls");
assert.match(app, /handleMainContentSlide/, "main content carousel controls should switch sections");
assert.match(app, /getSectionCoverUrl\(section\)/, "main content cards should use section images as backgrounds");
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
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.site-nav\s*\{[\s\S]*overflow-x:\s*auto/, "mobile top navigation should stay as horizontally scrollable cue cards");
assert.doesNotMatch(app, /window\.history\.pushState/, "section switching should stay on the page without changing the URL");
assert.doesNotMatch(app, /其他部分/, "old related section label should not remain");
assert.doesNotMatch(app, /課程範疇/, "old course category label should not remain");
assert.match(codeGs, /QEF_Pages/);
assert.doesNotMatch(codeGs, /QEF_Photos/, "Apps Script should no longer read QEF_Photos");
assert.match(codeGs, /相關代號/, "Apps Script should read the new QEF_Pages schema");
assert.match(codeGs, /相關名稱/, "Apps Script should read the new QEF_Pages schema");
assert.match(codeGs, /資料夾ID/, "Apps Script should read the new QEF_Pages schema");
assert.match(codeGs, /封面圖片ID/, "Apps Script should read the new QEF_Pages schema");
assert.match(codeGs, /acc\[header\] === undefined/, "Apps Script should keep the first value when hidden legacy headers are present");
assert.match(codeGs, /doGet/);
assert.match(codeGs, /jsonp/);
assert.match(codeGs, /collectImagesFromFolder_/, "Apps Script should collect nested Drive folder photos");
assert.match(codeGs, /CacheService\.getScriptCache/, "Apps Script should cache expensive site payloads");
assert.match(codeGs, /getCachedSitePayload_/, "Apps Script should cache the site API response");
assert.match(codeGs, /clearQefCache/, "Apps Script should expose a manual cache clear helper");
assert.match(codeGs, /warmQefSiteCache/, "Apps Script should expose a manual cache warm helper");

console.log("QEF static site structure checks passed.");
