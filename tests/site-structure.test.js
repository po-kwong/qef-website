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
assert.strictEqual(config.googleSheet.spreadsheetId, "1CmPaRF6o9K2Gjx2Ga59yRdao6KPbWrnU8tCKqsnt1m8");
assert.deepStrictEqual(Array.from(config.googleSheet.tabs), ["QEF_Settings", "QEF_Pages", "QEF_Photos", "QEF_Metrics"]);

assert.match(css, /@media \(max-width: 760px\)/, "mobile breakpoint should exist");
assert.match(css, /\.photo-mosaic/, "photo mosaic styles should exist");

assert.match(app, /window\.QefSiteTest/, "app should expose test hooks");
assert.match(codeGs, /QEF_Pages/);
assert.match(codeGs, /doGet/);
assert.match(codeGs, /jsonp/);

console.log("QEF static site structure checks passed.");
