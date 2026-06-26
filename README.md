# 普光 QEF 計劃網站

這是一個參考 `shine-photo-gallery` 架構建立的 QEF 計劃公開介紹網站。前台可用 GitHub Pages 發佈，後台資料由 Google Sheet 管理，再由 Google Apps Script 以 read-only API 提供。

## 架構

```text
GitHub Pages
  index.html / config.js / assets/styles.css / assets/app.js
        ↓ JSONP
Google Apps Script Web App
        ↓
Google Sheet：尚計劃活動相簿資料庫
  QEF_Settings / QEF_Pages / QEF_Metrics
        ↓
Google Drive 圖片 ID 或相片資料夾 ID
```

## 主要檔案

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 前台 HTML 結構 |
| `config.js` | 網站設定、Google Sheet 後台資料、示例 fallback |
| `assets/styles.css` | 前台視覺及 responsive 樣式 |
| `assets/app.js` | API 載入、分頁切換、內容及相片渲染；API 載入較慢時先顯示示例內容 |
| `apps-script/Code.gs` | Apps Script read-only API 參考碼；包含整站及相片資料夾快取 |
| `scripts/probe-live-site.js` | 部署後檢查 Apps Script 版本、快取狀態、封面圖片ID 及 live payload 速度 |
| `tests/site-structure.test.js` | 靜態結構檢查 |

## Google Sheet 後台

Spreadsheet ID：

```text
1hplWteuEJGSkNrn0S2AyzHoDxw_DJK_DW_XRyHL4FQM
```

已新增 QEF 專用 tabs：

- `QEF_Settings`
- `QEF_Pages`
- `QEF_Metrics`

`QEF_Pages` 現已合併頁面、課程內容及封面相片設定。`QEF_Photos` 已停用，只保留作舊資料備份，網站不再讀取。

`QEF_Settings` 可控制頁面可見文字，包括 `site_title`、`school_name_zh`、`school_name_en`、`site_subtitle`、`plan_title`、`homepage_intro` 及 `footer_text`。如要改首頁下方的指標卡，例如推行時期或受惠人數，請改 `QEF_Metrics`。

`Albums` 是原有相簿資料，不應因 QEF 網站而修改。

## 部署

1. 將 `apps-script/Code.gs` 貼到 Google Apps Script 專案。
2. 部署為 Web App，權限使用可讀取該 Google Sheet 的執行身份。
3. 在 Apps Script 編輯器先執行 `clearQefCache()`，再執行 `warmQefSiteCache()`，先建立整站快取。
4. 取得 `/exec` URL。
5. 將 URL 填入 `config.js` 的 `apiBaseUrl`。
6. 將網站推到 GitHub Pages。
7. 部署後執行 `node scripts/probe-live-site.js`；`health` 應有 `cacheVersion`，不應再出現 `QEF_Photos`，`QEF_Settings` 必要 key 應回傳，而已填 `QEF_Pages!G 封面圖片ID` 的課程 row 應回傳 `imageId`。

如未設定 `apiBaseUrl`，前台會使用 `config.js` 內的示例資料，方便先預覽設計。

已設定 `apiBaseUrl` 時，前台會先顯示載入狀態，等 Apps Script API 回傳後才渲染 Google Sheet 最新內容，避免先看到預設內容或預設圖片再跳到新版。只有未設定 API 或 API 載入失敗時，才會使用 `config.js` 的示例資料作預覽或 fallback。Apps Script 會快取 `site` payload 約 10 分鐘，相片資料夾掃描結果最多 6 小時；如剛修改相片資料夾或重新部署，可在 Apps Script 執行 `clearQefCache()` 或 `warmQefSiteCache()`。
