# AGENTS.md

## 專案名稱

普光 QEF 計劃網站

## 專案定位

本專案是一個以 GitHub Pages 發佈的公開 QEF 計劃介紹網站，用作展示本校「創設實況學習場地（咖啡店）」計劃的目標、安排、課程、學習歷程、社區連繫及預期成效。

前台由純 HTML、CSS、JavaScript 組成；後台資料由 Google Apps Script 以公開 read-only API 方式提供，資料來源為 Google Sheet 及 Google Drive 圖片。

## 正式架構

```text
GitHub Pages
  index.html / config.js / assets/styles.css / assets/app.js
        ↓ JSONP
Google Apps Script Web App
        ↓
Google Sheet：QEF_Settings / QEF_Pages / QEF_Photos / QEF_Metrics
        ↓
Google Drive：相片圖片 ID 或相片資料夾 ID
```

## 重要原則

1. 不使用 Netlify。
2. 不使用 Netlify Functions。
3. 不在前台保存 API_SECRET、密碼、token 或私人金鑰。
4. 前台只可讀取公開 read-only API。
5. Google Sheet 後台只供管理 QEF 網站公開內容，不應放未審核學生私隱資料。
6. 網頁設計方向應為公開計劃介紹 / portfolio 風格，不是後台 dashboard。
7. 一般修改版面、顏色、卡片設計、分頁互動時，只修改 `index.html` / `config.js` / `assets/styles.css` / `assets/app.js`。
8. 修改 Google Sheet 欄名、讀取 Drive 方法或 API response 時，才修改 `apps-script/Code.gs`，並提醒 Jason 需要重新部署 Apps Script。

## Google Sheet 規則

Spreadsheet ID：

```text
1CmPaRF6o9K2Gjx2Ga59yRdao6KPbWrnU8tCKqsnt1m8
```

QEF 專用工作頁：

- `QEF_Settings`
- `QEF_Pages`
- `QEF_Photos`
- `QEF_Metrics`

原有 `Albums` 工作頁屬相簿專案資料，不應因 QEF 網站修改。

## 修改後測試清單

1. 首頁可正常載入。
2. 導航可切換不同 QEF 分頁。
3. 未設定 Apps Script URL 時，可使用 `config.js` 示例資料預覽。
4. 設定 Apps Script URL 後，可讀取 Google Sheet 後台資料。
5. `QEF_Pages` 只有 `公開顯示 = TRUE` 的頁面會顯示。
6. `QEF_Photos` 只有 `公開顯示 = TRUE` 的相片會顯示。
7. `分類 = 課程範疇` 的分頁不放在頂部導航，應在首頁內容卡片顯示。
8. 相片 ID 留空時，前台顯示設計預留圖格，不應出現壞圖示。
9. 手機版正常。
10. Apps Script `?action=health` 可回傳 `ok: true`。
11. `node tests/site-structure.test.js` 通過。
