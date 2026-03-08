# Architecture

## Overview

A home organization and project-management app. Users create Projects, add Spaces to each project, define Measurements within each space, and assign products from a master catalog to each measurement.

The system has three main sub-projects: a Vue 3 frontend SPA, a Node.js Express REST API, and AWS Lambda functions for auth triggers and product catalog ingestion.

---

## System Diagram

```
Browser (prjmanager.com)
        |
        | HTTPS
        v
  GitHub Pages          AWS Cognito (hosted UI)
  Vue 3 SPA  <----OAuth2 authorization code---->  Cognito User Pool
        |
        | Bearer JWT (access token)
        v
  api.prjmanager.com
  API Gateway HTTP API
        |
        v
  Lambda: prjmanager-api
  Express + @vendia/serverless-express
        |
        +----> DynamoDB: projects table
        +----> DynamoDB: products table
        +----> S3: space images bucket (presigned upload URLs)

  S3: convert-product-excel bucket
        |
        | s3:ObjectCreated trigger
        v
  Lambda: product-ingestion
        |
        +----> DynamoDB: products table
        +----> S3: product images bucket
```

---

## Frontend (`frontend/`)

**Stack:** Vue 3, TypeScript, Vite, Vue Router, PrimeVue (Aura theme)

**Hosted on:** GitHub Pages (`prjmanager.com`)

**Key files:**

| File | Purpose |
|------|---------|
| `src/models.ts` | TypeScript interfaces: `Project`, `Space`, `Measurement`, `Product`, `Dimension` |
| `src/apiRoutes.ts` | All API endpoint URL builders; reads `VITE_API_BASE` env var |
| `src/composables/useApi.ts` | Single composable wrapping all fetch calls with typed responses and auth headers |
| `src/composables/useAuth.ts` | Cognito OAuth2 flow: login redirect, token exchange callback, logout |
| `src/router/index.ts` | Routes + navigation guard that redirects unauthenticated users to `/login` |
| `src/views/Projects.vue` | Projects list page (`/`) |
| `src/views/Project.vue` | Project detail page (`/project/:id`) — spaces, measurements, products |
| `src/views/LoginView.vue` | Login page with Cognito redirect |
| `src/views/CallbackView.vue` | OAuth2 callback handler; exchanges code for tokens, stores in `localStorage` |
| `src/components/MeasurementCard.vue` | Card UI for a single measurement and its assigned products |

**Authentication flow:**
1. User visits any protected route without an `access_token` in `localStorage` → redirected to `/login`
2. `/login` redirects to Cognito hosted UI with `response_type=code`
3. Cognito redirects back to `/callback?code=...`
4. `CallbackView` POSTs the code to Cognito's `/oauth2/token` endpoint and stores `access_token` + `refresh_token` in `localStorage`
5. All subsequent API calls include `Authorization: Bearer <access_token>`

**PrimeVue:** Components are auto-imported via `unplugin-vue-components` + `PrimeVueResolver`. No manual imports needed in `.vue` files.

---

## Backend (`backend/server.js`)

**Stack:** Node.js, Express, `@vendia/serverless-express`, AWS SDK v3

**Hosted on:** AWS Lambda (`prjmanager-api`) behind API Gateway HTTP API (`api.prjmanager.com`)

**External services used:**

| Service | Purpose |
|---------|---------|
| AWS Cognito (`aws-jwt-verify`) | Verifies Bearer JWTs on protected routes |
| DynamoDB `projects` (us-east-2) | Stores all project data |
| DynamoDB `products` (us-east-2) | Read-only master product catalog |
| S3 (images bucket) | Generates presigned PUT URLs for space photo uploads; deletes objects on image removal |

**Auth middleware (`requireAuth`):** Extracts the Bearer token from `Authorization` header, verifies it with `CognitoJwtVerifier`, and attaches decoded claims to `req.user`. All project/space/measurement/product routes require auth. Master products routes (`GET /products`, `GET /products/:id`) are public.

**Data ownership:** Every project is stored with an `owner_id` field set to `req.user.sub` (Cognito user ID). All reads and mutations check `project.owner_id === req.user.sub` before proceeding.

**Storage pattern:** The entire project document (including nested spaces, measurements, and products) is stored and retrieved as a single DynamoDB item. Mutations load the full document, modify the nested structure in memory, and write it back.

### REST API

```
GET    /health

# Projects (all require auth)
GET    /projects
GET    /projects/:id
POST   /projects
PATCH  /projects/:id
DELETE /projects/:id

# Spaces
POST   /projects/:projectId/spaces
PATCH  /projects/:projectId/spaces/:spaceId
DELETE /projects/:projectId/spaces/:spaceId

# Space Images
GET    /projects/:projectId/spaces/:spaceId/upload-url   # returns presigned S3 PUT URL
DELETE /projects/:projectId/spaces/:spaceId/images       # deletes from S3 + removes URL from project doc

# Measurements
POST   /projects/:projectId/spaces/:spaceId/measurements
PATCH  /projects/:projectId/spaces/:spaceId/measurements/:measurementId
DELETE /projects/:projectId/spaces/:spaceId/measurements/:measurementId

# Products in a measurement
POST   /projects/:projectId/spaces/:spaceId/measurements/:measurementId/products
PATCH  /projects/:projectId/spaces/:spaceId/measurements/:measurementId/products/:sku
DELETE /projects/:projectId/spaces/:spaceId/measurements/:measurementId/products/:sku

# Master product catalog (public)
GET    /products
GET    /products/:id
```

---

## Data Model

```
Project
  id          number   (Date.now() + random 0–999)
  name        string
  owner_id    string   (Cognito sub)
  created_at  number
  spaces      Space[]

Space
  id            number
  name          string
  images        string[]   (S3 public URLs)
  measurements  Measurement[]

Measurement
  id          number
  name        string
  quantity    number | null
  category    string | null
  dimensions  { depth, width, height } | null
  note        string
  images      string[]
  products    Product[]

Product  (assigned to a measurement; sourced from master catalog)
  sku         number   (unique within a measurement)
  item        string
  dimensions  string
  price       number
  vendor      string
  sheetName   string
  notes       string
  quantity    number
  total       number
  images      string[]
```

---

## Lambda Functions (`backend/lambda/`)

### `pre-sign-up`

**Trigger:** Cognito Pre Sign-Up

Checks the DynamoDB `invitations` table for a `pending` invitation matching the registering user's email. If no valid invitation exists, registration is rejected. Prevents open self-registration.

### `post-confirmation`

**Trigger:** Cognito Post Confirmation

After a user confirms their account, creates a record in the DynamoDB `users` table (`id`, `email`, `name`, `created_at`) and marks the user's invitation record as `accepted`.

### `product-ingestion`

**Trigger:** S3 `ObjectCreated` on the `convert-product-excel` bucket

When an `.xlsx` file is uploaded to the trigger bucket, this Lambda:
1. Downloads the file to `/tmp`
2. Parses all sheets with pandas, normalizing column names (e.g. `sku_number` → `sku`)
3. Extracts embedded images by parsing the xlsx zip internals (DrawingML relationships)
4. Uploads product images to the product images S3 bucket under `product-images/<sku>.<ext>`
5. Batch-writes all unique SKU records to the DynamoDB `products` table (replacing previous data)
6. Cleans up `/tmp`

---

## DynamoDB Tables

| Table | Partition Key | Description |
|-------|--------------|-------------|
| `projects` | `id` (Number) | Full project documents including nested spaces/measurements/products |
| `products` | `sku` (Number) | Master product catalog populated by Lambda ingestion |
| `users` | `id` (String, Cognito sub) | User profiles created on Cognito confirmation |
| `invitations` | `email` (String) | Invitation list; status: `pending` → `accepted` |

All tables are in `us-east-2`.

---

## S3 Buckets

| Bucket | Purpose |
|--------|---------|
| Space images bucket (`S3_IMAGES_BUCKET`) | User-uploaded space photos; accessed via presigned URLs generated by the API |
| Product images bucket (`PRODUCT_IMAGE_BUCKET`) | Product images extracted and uploaded by the ingestion Lambda |
| Excel upload bucket (`convert-product-excel`) | Drop zone for `MasterProductList.xlsx`; S3 event triggers ingestion Lambda |
| Deploy bucket (`DEPLOY_BUCKET`) | CI/CD artifact staging (backend zip, Lambda zips) |

---

## CI/CD (GitHub Actions)

All workflows trigger on push to `main` for their respective paths. AWS credentials are obtained via OIDC (no long-lived secrets).

| Workflow | Trigger path | What it does |
|----------|-------------|--------------|
| `deploy-frontend.yml` | `frontend/**` | `pnpm build` → deploy to GitHub Pages |
| `deploy-api.yml` | `backend/**`, `infra/api.yml` | esbuild bundle → zip → S3 → `cloudformation deploy` → `lambda update-function-code` |
| `deploy-product-ingestion.yml` | `backend/lambda/product-ingestion/**` | pip bundle → zip → S3 → Lambda create/update + S3 trigger config |
| `deploy-post-confirmation.yml` | `backend/lambda/post-confirmation/**` | pip bundle → zip → S3 → Lambda create/update |
| `deploy-pre-sign-up.yml` | `backend/lambda/pre-sign-up/**` | pip bundle → zip → S3 → Lambda create/update |

**Backend deployment detail:** The workflow builds the bundle, uploads `api-release.zip` to S3, then runs `cloudformation deploy` against `infra/api.yml` to create or update the Lambda function and API Gateway stack. A follow-up `lambda update-function-code` call forces the function to pick up the new zip (CloudFormation won't redeploy code if the S3 key is unchanged).

---

## Environment Variables

### Frontend (Vite build-time)

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE` | API base URL (production: `https://api.prjmanager.com`) |
| `VITE_COGNITO_DOMAIN` | Cognito hosted UI domain |
| `VITE_COGNITO_CLIENT_ID` | Cognito app client ID |

### Backend (runtime `.env` on EC2)

| Variable | Description |
|----------|-------------|
| `COGNITO_USER_POOL_ID` | For JWT verification |
| `COGNITO_CLIENT_ID` | For JWT verification |
| `S3_IMAGES_BUCKET` | Bucket name for space photo uploads |

### Lambda: product-ingestion

| Variable | Description |
|----------|-------------|
| `PRODUCTS_TABLE` | DynamoDB table name (default: `Products`) |
| `PRODUCT_IMAGE_BUCKET` | S3 bucket for extracted product images |
