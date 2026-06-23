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
  QEF_Settings / QEF_Pages / QEF_Photos / QEF_Metrics
        ↓
Google Drive 圖片 ID 或相片資料夾 ID
```

## 主要檔案

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 前台 HTML 結構 |
| `config.js` | 網站設定、Google Sheet 後台資料、示例 fallback |
| `assets/styles.css` | 前台視覺及 responsive 樣式 |
| `assets/app.js` | API 載入、分頁切換、內容及相片渲染 |
| `apps-script/Code.gs` | Apps Script read-only API 參考碼 |
| `tests/site-structure.test.js` | 靜態結構檢查 |

## Google Sheet 後台

Spreadsheet ID：

```text
1CmPaRF6o9K2Gjx2Ga59yRdao6KPbWrnU8tCKqsnt1m8
```

已新增 QEF 專用 tabs：

- `QEF_Settings`
- `QEF_Pages`
- `QEF_Photos`
- `QEF_Metrics`

`Albums` 是原有相簿資料，不應因 QEF 網站而修改。

## 部署

1. 將 `apps-script/Code.gs` 貼到 Google Apps Script 專案。
2. 部署為 Web App，權限使用可讀取該 Google Sheet 的執行身份。
3. 取得 `/exec` URL。
4. 將 URL 填入 `config.js` 的 `apiBaseUrl`。
5. 將網站推到 GitHub Pages。

如未設定 `apiBaseUrl`，前台會使用 `config.js` 內的示例資料，方便先預覽設計。
