# Data Model

## `QEF_Settings`

| Column | Purpose |
| --- | --- |
| `設定鍵` | Stable config key, e.g. `site_title` |
| `設定值` | Public value shown on the site |
| `說明` | Internal note |

## `QEF_Pages`

| Column | Purpose |
| --- | --- |
| `頁面代號` | Stable ID used in URL, e.g. `learning-space` |
| `頁面名稱` | Page title |
| `導航名稱` | Short nav label |
| `分類` | `首頁`, `安排`, `學習歷程`, `成果`, or `課程範疇` |
| `排序` | Navigation and card order |
| `頁面摘要` | Short public summary |
| `詳細介紹` | Main page body text |
| `主要圖片ID` | Optional Google Drive image ID |
| `相片資料夾ID` | Optional Google Drive folder ID |
| `公開顯示` | Checkbox; TRUE rows are public |
| `內部備註` | Internal note, not shown |

## `QEF_Photos`

| Column | Purpose |
| --- | --- |
| `相片代號` | Stable photo row ID |
| `頁面代號` | Links the photo to `QEF_Pages.頁面代號` |
| `圖片ID` | Google Drive image file ID |
| `圖片說明` | Public alt/caption text |
| `排序` | Order within page |
| `公開顯示` | Checkbox; TRUE rows are public |
| `內部備註` | Internal note, not shown |

## `QEF_Metrics`

| Column | Purpose |
| --- | --- |
| `指標代號` | Stable metric ID |
| `顯示名稱` | Label, e.g. `學生` |
| `數值` | Display value, e.g. `100 人` |
| `補充文字` | Supporting text |
| `排序` | Display order |
| `公開顯示` | Checkbox; TRUE rows are public |
