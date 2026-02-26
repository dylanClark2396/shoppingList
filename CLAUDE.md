# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A home organization project-management app. Users create **Projects** → **Spaces** → **Measurements**, then assign products from a master catalog to each measurement. Three sub-projects:

- `frontend/` — Vue 3 + TypeScript SPA
- `backend/` — Node.js Express REST API
- `python/` — Excel-to-JSON data pipeline for the master product catalog

Package manager is **pnpm** for both frontend and backend.

## Commands

### Frontend (`frontend/`)
```bash
pnpm dev          # dev server (Vite)
pnpm build        # type-check + build to dist/
pnpm type-check   # vue-tsc only
```

### Backend (`backend/`)
```bash
pnpm dev    # nodemon server.js (auto-reload)
pnpm start  # node server.js
pnpm build  # esbuild bundle → dist/server.js
```

### Python (`python/`)
```bash
# Activate venv first
python masterProductListToJson.py          # Excel → output/data.json + output/images/
python masterProductListToJsonMultiOutput.py  # same but multi-file output
```

## Architecture

### Data model (nested hierarchy, stored flat in JSON/DynamoDB)
```
Project { id, name, spaces[] }
  └── Space { id, name, measurements[] }
        └── Measurement { id, name, quantity, category, dimensions{depth,width,height}, note, products[], images[] }
              └── Product { sku, item, dimensions, price, vendor, quantity, total, notes, images[], sheet_names[] }
```

IDs are generated as `Date.now() + Math.floor(Math.random() * 1000)`. Products are uniquely identified by **SKU** within a measurement (no duplicate SKUs allowed).

### Backend — two server variants
- **`server.js`** — active file-based implementation. Persists projects to `backend/data/projects.json` using atomic write (write to `.tmp`, then rename). Reads master product catalog from `../python/output/data.json`.
- **`server-dynamodb.js`** — DynamoDB variant (region `us-east-1`, tables `Projects` + `Products`). Not currently deployed;

The deployed backend is `server.js`, bundled via esbuild and uploaded to S3 on push to `main`.

### Frontend key files
- `src/apiRoutes.ts` — all API endpoint URLs; reads `VITE_API_BASE` env var (defaults to `http://localhost:3000`)
- `src/composables/useApi.ts` — single composable wrapping all fetch calls with typed responses
- `src/models.ts` — TypeScript interfaces for the full data hierarchy
- `src/router/index.ts` — two routes: `/` (Projects list) and `/project/:id` (Project detail)

PrimeVue components are **auto-imported** via `unplugin-vue-components` + `PrimeVueResolver` — no manual imports needed in `.vue` files.

### Python pipeline
`masterProductListToJson.py` reads `MasterProductList.xlsx`, normalizes column names (maps `sku_number` → `sku`), extracts embedded images by parsing the xlsx zip internals, and writes `output/data.json` + `output/images/`. The backend's file-based server points to this output directory.

### Deployment
- **Frontend** → GitHub Pages via `deploy-frontend.yml`; sets `VITE_API_BASE=https://api.prjmanager.com`
- **Backend** → AWS EC2/instance via `deploy-api.yml`; bundles with esbuild and uploads `dist/` + `package.json` zip to S3 using OIDC auth (`AWS_DEPLOY_ROLE`, `DEPLOY_BUCKET` secrets)
