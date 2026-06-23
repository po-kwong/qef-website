const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
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

assert.match(html, /<html lang="zh-Hant">/);
assert.match(html, /assets\/styles\.css/);
assert.match(html, /config\.js/);
assert.match(html, /assets\/app\.js/);

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

assert.match(app, /window\.QefSiteTest/, "app should expose test hooks");
assert.match(app, /DEFAULT_JSONP_TIMEOUT_MS/, "frontend should use a named JSONP timeout");
assert.doesNotMatch(app, /}, 20000\)/, "frontend should not hard-code a 20 second API timeout");
assert.match(app, /buildSampleSiteData/, "frontend should be able to render sample data before live API returns");
assert.match(app, /showWarning/, "frontend should keep fallback content visible on slow API failures");
assert.match(app, /COURSE_CONTENT_CATEGORY = "課程內容"/, "frontend should use the new course content category");
assert.match(app, /renderCourseContentCard/, "course content should use the album-style card renderer");
assert.match(app, /renderCourseContentDetail/, "course content should use the album-style detail renderer");
assert.match(app, /function renderSectionControl/, "main sections should render as cue-card controls");
assert.match(app, /<button class="nav-link/, "main section controls should be buttons, not plain links");
assert.match(app, /type="button"/, "cue-card controls should not submit or navigate by default");
assert.match(app, /aria-pressed="/, "cue-card controls should expose their selected state");
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
