# Auth & Organisation Architecture Plan

> **Status:** Refined — decisions locked, ready to implement
> **Stack:** AWS Cognito + Google OAuth · Node.js Express · DynamoDB · Vue 3 + TypeScript

---

## Decisions Locked

| Decision | Choice |
|---|---|
| v1 scope | Auth + user isolation (personal projects only) |
| v2 scope | Organisations, shared projects, role permissions |
| Signup gate | Invite-only from day one (Cognito Pre-Sign-Up Lambda) |
| Token storage | `localStorage` |
| Cognito setup | AWS Console (manual) |
| AWS region | `us-east-2` (matches existing backend + DynamoDB) |
| JWT verification | `aws-jwt-verify` npm package |
| Multi-org | Deferred to v2 |
| Audit logging | Deferred to v2 |
| Super-admin role | Deferred to v2 |

---

## Phase 1 — Auth + Personal Projects

### Overview

```
Admin seeds invitations table in DynamoDB console
        ↓
Invited user goes to prjmanager.com/login
        ↓
"Sign in with Google" → Cognito Hosted UI
        ↓
Cognito Pre-Sign-Up Lambda fires
  └─ Email not in invitations → reject
  └─ Email found (pending) → allow sign-up
        ↓
Cognito Post-Confirmation Lambda fires
  → Creates user row in `users` table (Cognito sub as id)
  → Marks invitation as accepted
        ↓
Cognito redirects to prjmanager.com/callback with auth code
        ↓
Vue exchanges code for tokens → stores access token in localStorage
        ↓
All API calls include: Authorization: Bearer <token>
        ↓
Express requireAuth middleware verifies token via Cognito JWKS
        ↓
Every project query filters by owner_id = user.sub
```

---

### 1. DynamoDB Tables

#### `users` — new table

```
PK: id          String  (Cognito sub — permanent unique ID)
    email       String
    name        String
    created_at  Number  (epoch ms)
```

Access pattern: get by id (PK lookup) — no GSI needed.

#### `invitations` — new table

```
PK: email       String
    status      String  ('pending' | 'accepted')
    created_at  Number  (epoch ms)
```

> v1 keeps this simple: admin inserts rows directly in the DynamoDB console.
> No token, no expiry, no email sending in v1 — those are v2 additions.

Access pattern: get by email (PK lookup in Lambda).

#### `projects` — existing table, add two attributes

```
  id          Number  (existing PK — unchanged)
  name        String  (existing)
  spaces      List    (existing)
+ owner_id    String  (Cognito sub of creator — NEW)
+ created_at  Number  (epoch ms — NEW)
```

**Migration:** existing projects have no `owner_id`. Run a one-time script to tag them with a designated admin sub, or leave them unowned and handle `owner_id` being absent as a special case.

> GSI on `owner_id` is not needed at current scale. A Scan with FilterExpression is fine. Add the GSI if the table grows large.

---

### 2. Cognito Setup (AWS Console)

1. Create a **User Pool** in `us-east-2`
   - Sign-in: email
   - MFA: off (v1)
   - Self-registration: **disabled** (enforced by Pre-Sign-Up Lambda)

2. Add **Google as a federated identity provider**
   - Create OAuth client in Google Cloud Console
   - Paste Client ID + Secret into Cognito

3. Create an **App Client**
   - Auth flows: Authorization code grant
   - Callback URL: `https://prjmanager.com/callback`, `http://localhost:5173/callback`
   - Sign-out URL: `https://prjmanager.com/login`, `http://localhost:5173/login`
   - OAuth scopes: `openid email profile`

4. Set up **Hosted UI** domain (e.g. `auth.prjmanager.com` or a Cognito-generated domain)

5. Attach **Pre-Sign-Up Lambda** to the user pool trigger

6. Attach **Post-Confirmation Lambda** to the user pool trigger

Outputs needed for env vars:
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `COGNITO_DOMAIN` (the Hosted UI base URL)

---

### 3. Backend Changes (`server.js`)

#### Install dependency
```bash
pnpm add aws-jwt-verify
```

#### New env vars (`.env` + EC2 environment)
```
COGNITO_USER_POOL_ID=us-east-2_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
```

#### Auth middleware
```javascript
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID,
});

const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    req.user = await verifier.verify(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

#### Updated routes

**GET /projects** — return only the authenticated user's projects:
```javascript
app.get('/projects', requireAuth, async (req, res) => {
  const result = await db.send(new ScanCommand({
    TableName: PROJECT_TABLE,
    FilterExpression: 'owner_id = :uid',
    ExpressionAttributeValues: { ':uid': req.user.sub },
  }));
  res.json(result.Items || []);
});
```

**POST /projects** — stamp `owner_id` on creation:
```javascript
const newProject = {
  id: generateId(),
  name: req.body.name,
  spaces: [...],
  owner_id: req.user.sub,   // add this
  created_at: Date.now(),   // add this
};
```

**All other project routes** — add `requireAuth` + verify the project belongs to `req.user.sub` before mutating:
```javascript
// After fetching project, before any write:
if (project.owner_id !== req.user.sub) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

**CORS** — lock down to the frontend origin:
```javascript
app.use(cors({ origin: ['https://prjmanager.com', 'http://localhost:5173'] }));
```

#### Lambda: Pre-Sign-Up
```javascript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-2' }));

export const handler = async (event) => {
  const email = event.request.userAttributes.email;

  const result = await db.send(new GetCommand({
    TableName: 'invitations',
    Key: { email },
  }));

  if (!result.Item || result.Item.status !== 'pending') {
    throw new Error('No valid invitation found for this email.');
  }

  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;
  return event;
};
```

#### Lambda: Post-Confirmation
```javascript
export const handler = async (event) => {
  const { sub, email, name } = event.request.userAttributes;

  await db.send(new PutCommand({
    TableName: 'users',
    Item: { id: sub, email, name: name || email, created_at: Date.now() },
  }));

  await db.send(new UpdateCommand({
    TableName: 'invitations',
    Key: { email },
    UpdateExpression: 'SET #s = :accepted',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':accepted': 'accepted' },
  }));

  return event;
};
```

---

### 4. Frontend Changes (`frontend/`)

#### New Vue routes (`src/router/index.ts`)

```typescript
{ path: '/login',    component: () => import('@/views/LoginView.vue') },
{ path: '/callback', component: () => import('@/views/CallbackView.vue') },
```

Add a navigation guard to redirect unauthenticated users to `/login`:
```typescript
router.beforeEach((to) => {
  const publicRoutes = ['/login', '/callback'];
  const token = localStorage.getItem('access_token');
  if (!publicRoutes.includes(to.path) && !token) {
    return '/login';
  }
});
```

#### `useAuth` composable (`src/composables/useAuth.ts`)

```typescript
const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/callback`;

export function useAuth() {
  const isAuthenticated = computed(() => !!localStorage.getItem('access_token'));

  const login = () => {
    const url = new URL(`${COGNITO_DOMAIN}/oauth2/authorize`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    url.searchParams.set('scope', 'openid email profile');
    window.location.href = url.toString();
  };

  const handleCallback = async (code: string) => {
    const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });
    const tokens = await res.json();
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
  };

  return { isAuthenticated, login, handleCallback, logout };
}
```

#### New env vars (`frontend/.env.production`)
```
VITE_COGNITO_DOMAIN=https://auth.prjmanager.com
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
```

#### Update `useApi.ts` — inject auth header

Add a helper and apply it to every fetch call:
```typescript
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Example — apply to all fetch calls:
const res = await fetch(API_ROUTES.projects, {
  headers: { ...authHeaders() },
});
```

#### New views

**`LoginView.vue`** — single PrimeVue `Button` that calls `useAuth().login()`.

**`CallbackView.vue`** — on mount, reads `?code=` from the URL, calls `handleCallback(code)`, then `router.push('/')`.

---

### 5. Feature Checklist (v1)

- [x] `FEAT-001` — Cognito User Pool + Google OAuth (AWS Console)
- [ ] `FEAT-002` — Pre-Sign-Up Lambda (invitations whitelist check)
- [ ] `FEAT-003` — Post-Confirmation Lambda (create user row, mark invite accepted)
- [ ] `FEAT-004` — Provision `users` + `invitations` DynamoDB tables
- [ ] `FEAT-005` — Migrate existing `projects` rows (add `owner_id`)
- [ ] `FEAT-006` — `requireAuth` middleware + ownership guard on all project routes
- [ ] `FEAT-007` — Lock CORS to `prjmanager.com`
- [ ] `FEAT-008` — Frontend: `/login` + `/callback` routes + navigation guard
- [ ] `FEAT-009` — `useAuth` composable (login, handleCallback, logout)
- [ ] `FEAT-010` — `useApi.ts`: inject `Authorization` header on all fetch calls
- [ ] `FEAT-011` — `LoginView.vue` + `CallbackView.vue` (PrimeVue components)
- [ ] `FEAT-012` — Add Cognito env vars to GitHub Actions secrets + EC2 environment

---

## Phase 2 — Organisations & Sharing (deferred)

Unlocked after Phase 1 ships. Adds:

- `organizations` + `org_members` DynamoDB tables
- Invite-by-email flow with SES + token-based invite links (`/join?token=xyz`)
- Org project visibility (owner_id OR org_id filter)
- Role enforcement middleware (owner / admin / member)
- Org management UI (create org, invite members, manage roles)
- Token refresh flow (Cognito refresh token → new access token)
- Possibly: multi-org support (user belongs to > 1 org)
