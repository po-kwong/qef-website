# Data Model

## `QEF_Settings`

| Column | Purpose |
| --- | --- |
| `設定鍵` | Stable config key, e.g. `site_title` |
| `設定值` | Public value shown on the site |
| `說明` | Internal note |

Supported visible setting keys:

| Key | Visible site target |
| --- | --- |
| `site_title` | Browser title and homepage hero H1 |
| `school_name_zh` | Header brand and footer school name |
| `school_name_en` | Header brand English name |
| `site_subtitle` | Homepage hero subtitle |
| `plan_title` | Homepage hero plan title |
| `footer_text` | Footer description text |

Other keys can remain in `QEF_Settings` as administrative notes or future
configuration. If a public metric card such as the project period or beneficiary
count needs to change, update `QEF_Metrics`.

## `QEF_Pages`

| Column | Purpose |
| --- | --- |
| `相關代號` | Stable ID used in URL, e.g. `learning-space` |
| `相關名稱` | Page, activity, or course-content title |
| `資料夾ID` | Optional Google Drive folder ID for the gallery |
| `分類` | `計劃簡介`, `實況咖啡店`, `課程安排`, `電子營運`, `學習歷程`, `社區連繫`, `預期成效`, or `課程內容` |
| `活動日期` | Optional activity date, displayed on album-style pages |
| `相關簡介` | Public card text. The first paragraph is the lead/主旨段; after one blank line, following paragraph(s) become the white explanation/detail text. |
| `封面圖片ID` | Optional Google Drive image ID for the card or hero cover |
| `公開顯示` | Checkbox; TRUE rows are public |
| `內部備註` | Internal note, not shown |

Rows whose `分類` is one of the seven main section labels appear in top
navigation. Rows whose `分類` is `課程內容` appear as album-style course-content
cards and detail pages.

For main-section cards, do not use `QEF_Settings` for the card copy. Put both
the lead and detail copy in the row's `相關簡介`: first paragraph for the lead,
one blank line, then the white explanation/detail paragraph(s).

Columns `J:T` may contain hidden legacy compatibility values while an older Apps
Script deployment is still active. Day-to-day editing should use only columns
`A:I`.

Photo folders may point to a course-level folder under the QEF photo root folder
`1wibEm9nltRtrFjoLIN0yuKWYUwVF5MuB`. The Apps Script API reads image files in
that folder and nested child folders, then returns public thumbnail URLs for the
frontend. If `封面圖片ID` is filled, the frontend uses that image as the card,
detail hero, and first gallery image before falling back to the first folder
photo.

Folder-photo captions use the Drive file name without its extension; the course
or album title is not prepended to each photo caption.

Folder photo scans are cached per page/folder for up to 6 hours to avoid slow
Drive traversal on every public page load. After changing Drive folder contents,
run `clearQefCache()` or `warmQefSiteCache()` in the Apps Script editor if the
website must update immediately.

## `QEF_Photos`

This tab is a legacy backup only. The website no longer reads it. Add or edit
cover images in `QEF_Pages.封面圖片ID`, and add gallery photos by placing image
files inside the row's `QEF_Pages.資料夾ID` Drive folder.

Sheet content is included in the cached `site` payload for about 10 minutes.
Run `clearQefCache()` and then `warmQefSiteCache()` after urgent Sheet edits if
the public website must refresh before normal cache expiry.

## `QEF_Metrics`

| Column | Purpose |
| --- | --- |
| `指標代號` | Stable metric ID |
| `顯示名稱` | Label, e.g. `學生` |
| `數值` | Display value, e.g. `100 人` |
| `補充文字` | Supporting text |
| `排序` | Display order |
| `公開顯示` | Checkbox; TRUE rows are public |
