#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const configPath = path.join(root, "config.js");

function loadConfig() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(configPath, "utf8"), sandbox, { filename: configPath });
  return sandbox.window.QEF_SITE_CONFIG || {};
}

function buildApiUrl(baseUrl, action) {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}action=${encodeURIComponent(action)}`;
}

async function timedJson(url) {
  const started = Date.now();
  const response = await fetch(url);
  const text = await response.text();
  const elapsedMs = Date.now() - started;
  let json;

  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 160)}`);
  }

  return {
    elapsedMs,
    status: response.status,
    bytes: Buffer.byteLength(text, "utf8"),
    headers: Object.fromEntries(response.headers.entries()),
    json
  };
}

function warn(message) {
  console.warn(`WARN ${message}`);
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

async function main() {
  const config = loadConfig();
  const apiBaseUrl = process.argv[2] || config.apiBaseUrl;

  if (!apiBaseUrl) {
    fail("No Apps Script URL found. Pass one as an argument or set config.js apiBaseUrl.");
    return;
  }

  console.log(`API ${apiBaseUrl}`);

  const health = await timedJson(buildApiUrl(apiBaseUrl, "health"));
  console.log(`health status=${health.status} ms=${health.elapsedMs} bytes=${health.bytes}`);

  if (health.json.ok !== true) fail("health did not return ok:true");
  if (!health.json.cacheVersion) fail("health is missing cacheVersion; deployed Code.gs is likely old");
  if (JSON.stringify(health.json).includes("QEF_Photos")) {
    fail("health still exposes QEF_Photos; redeploy the current apps-script/Code.gs");
  }

  const site = await timedJson(buildApiUrl(apiBaseUrl, "site"));
  const pages = Array.isArray(site.json.pages) ? site.json.pages : [];
  const photos = Array.isArray(site.json.photos) ? site.json.photos : [];
  const metrics = Array.isArray(site.json.metrics) ? site.json.metrics : [];
  const settings = site.json.settings && typeof site.json.settings === "object" ? site.json.settings : null;
  const lightFoodPrep = pages.find((page) => page.id === "light-food-prep");

  console.log(`site status=${site.status} ms=${site.elapsedMs} bytes=${site.bytes}`);
  console.log(`payload pages=${pages.length} photos=${photos.length} metrics=${metrics.length}`);
  console.log(`cacheVersion=${health.json.cacheVersion || "(missing)"}`);

  if (!settings) {
    fail("site payload is missing settings; QEF_Settings is not reaching the public API");
  } else {
    const requiredSettings = ["site_title", "school_name_zh", "school_name_en", "site_subtitle", "plan_title"];
    requiredSettings.forEach((key) => {
      if (!String(settings[key] || "").trim()) fail(`settings.${key} is empty`);
    });
    console.log(`settings site_title=${settings.site_title || "(missing)"}`);
    if (!String(settings.homepage_intro || "").trim()) warn("settings.homepage_intro is empty; homepage intro will fall back to QEF_Pages home content");
    if (!String(settings.footer_text || "").trim()) warn("settings.footer_text is empty; footer text will fall back to config.js");
  }

  if (site.elapsedMs > 10000) warn("site took more than 10 seconds; run warmQefSiteCache() after deployment or Drive folder changes");
  if (!lightFoodPrep) {
    fail("site payload is missing light-food-prep");
  } else if (!lightFoodPrep.imageId) {
    fail("light-food-prep imageId is empty; QEF_Pages 封面圖片ID is not reaching the public API");
  } else {
    console.log(`light-food-prep imageId=${lightFoodPrep.imageId}`);
  }

  const oversizedUrls = photos.filter((photo) => String(photo.thumbnailUrl || photo.src || "").includes("sz=w1600"));
  if (oversizedUrls.length) {
    warn(`${oversizedUrls.length} photo URLs still use sz=w1600`);
  }
}

main().catch((error) => {
  fail(error && error.message ? error.message : String(error));
});
