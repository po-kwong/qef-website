# Deployment

## Apps Script

1. Open the Apps Script project connected to the Google Sheet or create a standalone Apps Script project.
2. Paste `apps-script/Code.gs`.
3. Deploy as a Web App.
4. Execute as the account that can read the Google Sheet and Drive folders.
5. Allow access according to the intended public website policy.
6. Confirm the execution account can read the QEF photo root folder:

```text
https://drive.google.com/drive/folders/1wibEm9nltRtrFjoLIN0yuKWYUwVF5MuB
```

The API reads image files from `QEF_Pages.資料夾ID`, including nested child
folders, and returns Drive thumbnail URLs. `QEF_Photos` is no longer part of the
public API contract.

The Apps Script caches the full `site` payload for about 10 minutes and folder
photo metadata for up to 6 hours. After deploying `Code.gs` or changing Drive
folder contents, run `clearQefCache()` and then `warmQefSiteCache()` in the Apps
Script editor.

7. Run `clearQefCache()` and then `warmQefSiteCache()` in the Apps Script editor.
8. Test:

```text
<exec-url>?action=health
```

Expected response includes:

```json
{ "ok": true, "cacheVersion": "2026-06-25-v1" }
```

The response should not include `QEF_Photos`. If it still does, the deployed
Web App is using an older `Code.gs` version.

## Frontend

1. Paste the Apps Script `/exec` URL into `config.js` as `apiBaseUrl`.
2. Keep `apiMode: "jsonp"` unless the Apps Script deployment is confirmed to support direct JSON fetch from GitHub Pages.
3. Keep `apiTimeoutMs` high enough for Apps Script cold starts and Drive scans; the default is 90000 milliseconds.
4. Publish the folder through GitHub Pages.

## Live Probe

After deployment, run:

```bash
node scripts/probe-live-site.js
```

The probe reads `config.js` for the Apps Script URL, then checks:

- `?action=health` has `ok: true` and `cacheVersion`;
- the deployed API no longer exposes the retired `QEF_Photos` contract;
- `?action=site` returns page/photo/metric counts and response time;
- `QEF_Settings` required keys reach the public API;
- `light-food-prep.imageId` is present, proving `QEF_Pages.封面圖片ID` reaches the
  public API.

If you deploy to a new `/exec` URL before updating `config.js`, pass it directly:

```bash
node scripts/probe-live-site.js "https://script.google.com/macros/s/.../exec"
```

## Local Preview

The site can be opened directly from `index.html`. Before Apps Script is deployed, it uses fallback sample data from `config.js`. When an API URL is configured, the frontend may show the sample content first and replace it with the live Google Sheet payload after the Apps Script response arrives.
