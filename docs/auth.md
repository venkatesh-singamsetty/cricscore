# 🔐 Authentication & Authorization

CricScore uses **AWS Cognito User Pools** for identity management with a tiered role model supporting public viewers, authenticated scorers, guest scorers, and admins.

---

## 🏛️ Auth Architecture Overview

```mermaid
graph TD
    A[User Visits App] --> B{Has Session?}
    B -- No --> C[Amplify Authenticator UI]
    B -- Yes --> D{User Role?}
    C --> E[Sign Up / Sign In]
    C --> F[Continue as Guest]
    F --> G["Guest Cognito Account Created (guest-timestamp@cricscore.local)"]
    E --> H[Cognito JWT Token Issued]
    G --> H
    H --> D
    D -- Regular User --> I[Scorer View]
    D -- Admin Group --> J[Settings (Admin Panel) + Scorer View]
    D -- No token --> K[Viewer Only]
```

---

## 👤 User Roles

| Role          | Access                                                                    | Identity                                                                                    |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Viewer 🌍** | Public scoreboard, live feeds, match history                              | No auth required                                                                            |
| **Scorer 🎮** | Create & score matches, email reports, view own matches                   | Cognito User + JWT                                                                          |
| **Guest 🎮**  | Create and score matches; account and match data persist until cleaned up | Auto-generated Cognito account                                                              |
| **Admin ⚡**  | Administrative operations and user management                             | Cognito `Admin` group; some backend operations also permit the configured super-admin email |

---

## 🔑 Authentication Flow

### Regular Sign-In / Sign-Up

1. User clicks **SCORER** tab → redirected to Amplify Authenticator
2. Amplify handles Sign Up (with `given_name`, `family_name`, `email`) and Sign In
3. On success, `Hub.listen("auth", "signedIn")` fires → `fetchAuthSession()` retrieves the JWT
4. JWT payload is decoded to extract `email` and `cognito:groups`
5. `userToken` state is set; if user is in `Admin` group, `isAdmin = true`

### Guest Mode

1. User clicks **Continue as Guest** button in Authenticator footer
2. App calls `signOut()` to clear any existing session
3. A shadow Cognito account is created: `signUp({ username: "guest-{timestamp}@cricscore.local" })`
4. Immediately signed in with `signIn()`
5. `isGuestScorer = true` state is set; user gets full Scorer functionality
6. Guest matches are tracked by their `scorer_email` (the guest email)
7. Guest accounts can be deleted by Admins via the Settings (Admin Panel) or AI Chat

### Sign Out

1. User clicks **SIGN OUT** in the top nav
2. `signOut()` is called via `aws-amplify/auth`
3. All auth state is cleared: `userToken`, `isAdmin`, `userEmail` reset to null
4. View resets to `VIEWER`

### Cross-Session Identity Guard

- A `prevEmailRef` ref tracks the last known user email
- When `userEmail` changes (e.g., guest → real user), all match state is automatically cleared:
  - `matchStatus`, `matchId`, `teamA/B`, `currentInnings`, `previousInnings` all reset
  - `hasRestored` resets to `false` so fresh state restoration from `localStorage` occurs
  - View resets to `VIEWER`; `hubKey` increments to force LiveScoreboard refresh
- This prevents stale guest match data from appearing to a newly logged-in user

---

## 🛡️ Authorization Model

### Frontend Guards

```typescript
// In App.tsx — check if user can access SCORER view
if (target === "SCORER" && userToken) setView("SCORER");
// Admin panel requires Cognito Admin group
if (target === "ADMIN" && isAdmin) setView("ADMIN_PANEL");
```

### Backend JWT Validation (API Gateway)

All authenticated routes use an **API Gateway JWT Authorizer** configured against the Cognito User Pool.

```javascript
// match-api/index.js
const getClaims = (event) => {
  const authorizer = event.requestContext?.authorizer || {};
  return authorizer.jwt?.claims || authorizer.claims || {};
};

const isAuthorized = (event, matchRecord) => {
  const claims = getClaims(event);
  const isSuperAdmin = claims.email === process.env.ADMIN_REPORT_EMAIL;
  const hasAdminGroup = (claims["cognito:groups"] || []).includes("Admin");
  if (isSuperAdmin || hasAdminGroup) return true;
  if (matchRecord && claims.email === matchRecord.scorer_email) return true;
  return false;
};
```

**JWT-protected scorer endpoints**: `POST /match`, `PATCH /match/{matchId}`, `DELETE /match/{matchId}`, `POST /match/{matchId}/innings`, `POST /match/{matchId}/email`, and `POST /update-score`. Match-specific operations additionally check ownership or admin access in the Lambda.

**JWT-protected administrative endpoints**: `DELETE /matches`, `GET/DELETE /admin/users`, `POST/DELETE /admin/users/roles`, `DELETE /admin/users/guests`, `DELETE /admin/matches/guests`, and `DELETE /admin/matches/incomplete`. The Lambda performs the admin check.

Public routes such as `GET /matches`, match-read routes, `/chat`, `/chat/summary`, `/match/predict`, and `/rules/*` do not use the API Gateway JWT authorizer. In particular, `/chat` currently accepts `isAdmin` in the request body and uses it to enable destructive MCP tools without verifying it against a Cognito claim. Frontend visibility is not an authorization control; the chat/rule routes need backend authorization before being considered admin-protected.

---

## 👥 Admin User Management

The Settings tab (Admin Panel) provides full user lifecycle management:

### List Users (`GET /admin/users`)

- Queries Cognito User Pool via `ListUsersCommand`
- Returns: `username`, `email`, `status`, `isAdmin`, `isScorer` flags

### Promote/Demote Roles (`POST/DELETE /admin/users/roles`)

- `POST`: Adds user to Cognito group via `AdminAddUserToGroupCommand`
- `DELETE`: Removes user from Cognito group via `AdminRemoveUserFromGroupCommand`
- Supported roles: `Admin`, `Scorer`

### Delete User (`DELETE /admin/users`)

- Hard-deletes a user from Cognito via `AdminDeleteUserCommand`
- Cascades to delete all match records owned by that user's email
- **Admin-only**: Only users in the `Admin` Cognito group can perform this action

### Delete Guest Data (via Admin API)

The administrative API exposes separate routes for deleting guest users and guest matches. The MCP chat also conditionally registers guest-cleanup tools based on the request body's `isAdmin` flag; that flag is not validated against Cognito claims, so the chat tool gating must not be relied on as an authorization boundary.

- The `deleteGuestData` MCP tool filters users whose `email` attribute starts with `guest-` and ends with `@cricscore.local`
- Cognito users are deleted via `AdminDeleteUserCommand`
- Match records are removed via cascading database deletes

---

## 🗝️ Session Token Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Amplify as Amplify Auth SDK
    participant Cognito as AWS Cognito
    participant App as React App
    participant API as API Gateway + Lambda

    User->>Amplify: signIn(email, password)
    Amplify->>Cognito: InitiateAuth
    Cognito-->>Amplify: JWT tokens (ID + Access + Refresh)
    Amplify-->>App: Hub event signedIn
    App->>Amplify: fetchAuthSession()
    Amplify-->>App: tokens.idToken JWT
    App->>App: Decode payload -> email, cognito:groups
    App->>API: Request with Authorization Bearer JWT
    API->>Cognito: Validate JWT via JWT Authorizer
    Cognito-->>API: Claims verified
    API-->>App: Protected resource response
```

---

## 🔒 Cognito Infrastructure Configuration

| Setting                | Value                                                                             |
| ---------------------- | --------------------------------------------------------------------------------- |
| **User Pool**          | `${var.project_name}-user-pool` (Terraform managed; differs by environment)       |
| **Auth Flows**         | `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_USER_SRP_AUTH`, and `ALLOW_REFRESH_TOKEN_AUTH` |
| **Sign-in Alias**      | Email                                                                             |
| **Signup Form Fields** | Email, given name, and family name; Terraform auto-verifies email                 |
| **Admin Group**        | `Admin` (Cognito User Group)                                                      |
| **Token Validity**     | Not explicitly set in the Terraform user-pool client; Cognito defaults apply      |
| **Admin Permissions**  | Lambda execution role permissions are managed in `infra/terraform/iam.tf`         |

---

## 🧪 Auth-Related Test Coverage

| Test                                    | File                               | Status |
| --------------------------------------- | ---------------------------------- | ------ |
| DELETE /match unauthorized → 403        | `match-api/index.test.js`          | ✅     |
| DELETE /match authorized (owner) → 200  | `match-api/index.test.js`          | ✅     |
| POST /match without JWT → 401           | `match-api/index.test.js`          | ✅     |
| Admin group can delete any match        | `match-api/index.test.js`          | ✅     |
| GET /admin/users non-admin → 403        | `match-api/index.test.js`          | ✅     |
| Guest user detection by email attribute | `chat-api/mcp/tools/tools.test.js` | ✅     |

---

© 2026 CricScore Documentation
