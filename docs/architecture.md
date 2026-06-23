# Architecture

## Overview

The QEF website follows the same publishing pattern as the school photo gallery, but with a QEF-specific data contract.

```text
Static frontend on GitHub Pages
  ↓ JSONP request
Apps Script read-only API
  ↓
Google Sheet QEF tabs
  ↓
Google Drive image IDs or folder IDs
```

The frontend can also run without an API URL by falling back to sample content in `config.js`.

## Frontend

- `index.html` holds semantic page regions and static asset references.
- `config.js` holds public configuration and fallback content.
- `assets/styles.css` defines the visual system and responsive layout.
- `assets/app.js` loads API data, normalizes records, renders navigation, pages, metrics, and photo mosaics.

## Backend

`apps-script/Code.gs` exposes:

- `?action=site`: full QEF website payload.
- `?action=health`: API status check.

The API supports JSON and JSONP. GitHub Pages should use JSONP for the same deployment style as `shine-photo-gallery`.

## Security

- The API is read-only.
- No frontend secrets are used.
- Google Drive image access depends on Drive sharing and the Apps Script executing account.
- Do not place private student data in public-facing Sheet fields.
