# Full-Project Code Review — australienBlog / web_blog

Date: 2026-04-23  
Scope: `server/`, `website/`, `flutter_app/`

---

## Statistics

| Area | Files | LOC (approx.) |
|---|---|---|
| `server/` | 20 | 1,744 |
| `website/` | 34 | 2,900 |
| `flutter_app/lib/` | 42 | 2,865+ |

| Severity | Count |
|---|---|
| **Critical** | 9 |
| **Medium** | 11 |
| **Low** | 8 |
| **Total** | **28** |

---

## Critical Issues

### C-1 — XSS via unsanitised `point.title`/`point.desc` in map popups
**File:** `website/src/components/mapHelpers.js:20-37`  
User-controlled strings are interpolated directly into `innerHTML`. An attacker who controls blog data can execute arbitrary JavaScript in every visitor's browser when a map popup opens.  
**Fix:** Use `textContent` / `createElement` instead of raw `innerHTML` interpolation.

### C-2 — `getValidAccessToken()` never checks token expiry
**File:** `flutter_app/lib/services/auth_service.dart:194-199`  
Returns the stored access token without checking the JWT `exp` claim. After 15 minutes every request silently sends an expired token, gets a 401, then retries — doubling network cost. Non-retryable paths error silently.  
**Fix:** Decode `exp` from the JWT on retrieval; proactively refresh when within ~30 s of expiry.

### C-3 — Fire-and-forget `initializeFromServer()` after login/register
**Files:** `flutter_app/lib/pages/login_page.dart:37`, `flutter_app/lib/pages/register_page.dart:54`  
`SyncService().initializeFromServer()` is neither awaited nor has `.catchError`. The app navigates away immediately. Any error (network, missing blog in `AuthService`) is silently dropped.  
**Fix:** `await` and show a loading indicator, or at minimum attach `.catchError`.

### C-4 — Fire-and-forget `syncFromStorage()` in StorageService
**File:** `flutter_app/lib/services/storage_service.dart:54,124`  
`SyncService().syncFromStorage()` is called without `await` or `.catchError` from `savePointsAndTrips` and `deletePointMedia`. Sync errors are invisible.  
**Fix:** Expose the Future to callers or add `.catchError`.

### C-5 — `String.hashCode` used for sync change detection (non-deterministic)
**File:** `flutter_app/lib/services/sync_service.dart:503,525`  
Dart's `hashCode` is salted per-isolate and not stable across process restarts. Two identical strings produce different hashes in different runs → sync always reports "changed" after app restart → redundant full syncs every launch.  
**Fix:** Use `sha256.convert(utf8.encode(content)).toString()` from `package:crypto`.

### C-6 — Read-password cookie not `HttpOnly` — exfiltrable via XSS
**Files:** `website/src/utils.js:12-14`, `website/src/controller/useTripLoader.js:110`  
The raw read password is stored in a JS-accessible cookie (`SameSite=Strict; Secure` but no `HttpOnly`). Any XSS (see C-1) can trivially steal it via `document.cookie`.  
**Fix:** Store in `sessionStorage` instead, or have the server set the cookie after verifying the password (server-set cookies can be `HttpOnly`).

### C-7 — `_downloadJson` uses the public reader endpoint instead of the editor endpoint
**File:** `flutter_app/lib/services/sync_service.dart:676-691`  
The owner downloads their own data via `/blogs/:slug/files/*` (public reader route, protected by `X-Read-Token`) while sending a Bearer JWT. The JWT is ignored on that route. If the blog has a read password set, this returns 401 and `initializeFromServer` aborts with "Failed to download metadata".  
**Fix:** Use an authenticated editor endpoint for owner data downloads.

### C-8 — Circular dependency: `storage_service.dart` ↔ `sync_service.dart`
`StorageService.savePointsAndTrips()` calls `SyncService()`, and `SyncService` holds a `StorageService` reference. Both are singleton singletons. This creates fragile instantiation order and makes either service impossible to test in isolation.  
**Fix:** Have `StorageService` emit a callback/event instead of calling `SyncService` directly; or pass a sync trigger as a parameter.

### C-9 — `storage_service.dart` and `settings_page.dart` import `main.dart`
**Files:** `flutter_app/lib/services/storage_service.dart`, `flutter_app/lib/pages/settings_page.dart`  
Both import `main.dart` to access the `useModernPicker` top-level global. Importing the app entry point from a service layer couples the service to the bootstrap context and prevents standalone testing.  
**Fix:** Extract `useModernPicker` into a dedicated `AppConfig` or `settings_config.dart` file.

---

## Medium Issues

### M-1 — `presentBlog`/`presentUser` duplicated between `auth.js` and `me.js`
**Files:** `server/routes/auth.js:54-75`, `server/routes/me.js:25-40`  
Near-identical functions defined twice. Any field change must be made in both places.  
**Fix:** Extract to `server/utils/presenters.js`.

### M-2 — `greatCircleArc` duplicated between server and client
**Files:** `server/services/routing.js:75-121`, `website/src/controller/routingService.js:36-122`  
Same algorithm, same constants (`ROUTE_MAX_DETOUR_FACTOR = 5`, `MAX_SNAP_DISTANCE = 1000 m`). Any fix must be applied in both places.  
**Fix:** Document the shared contract explicitly; centralize the constants.

### M-3 — `_authHeaders` duplicated in `SyncService` and `ApiService`
**Files:** `flutter_app/lib/services/sync_service.dart:138-142`, `flutter_app/lib/services/api_service.dart:15-19`  
Identical private helper for building Bearer headers.  
**Fix:** Extract to a static method in `AuthService` or a shared `http_helpers.dart`.

### M-4 — `_extractError` duplicated in `AuthService` and `BlogSettingsPage`
**Files:** `flutter_app/lib/services/auth_service.dart:152-158`, `flutter_app/lib/pages/blog_settings_page.dart:153-158`  
Exact same body. Should be a shared utility.

### M-5 — `Trip.getDateRange()` hardcodes German month abbreviations
**File:** `website/src/model/Trip.js:64-70`  
Always renders "Mär", "Okt" etc. regardless of the active language. EN-language blogs show German month names.  
**Fix:** Use `Intl.DateTimeFormat` with the blog locale.

### M-6 — `require('../config')` called inline 3× inside handlers in `auth.js`
**File:** `server/routes/auth.js:133,165,187`  
`ACCESS_TOKEN_TTL_SEC` is re-required inside handler bodies even though `config` is already destructured at the top of the file.  
**Fix:** Add `ACCESS_TOKEN_TTL_SEC` to the top-level destructure.

### M-7 — `PasswortGate.jsx` ignores the `isLoading` prop it receives
**File:** `website/src/components/PasswortGate.jsx`  
`isLoading={loading}` is passed from `App.jsx` but never used inside the component. The submit button stays fully interactive with no feedback after submission.  
**Fix:** Disable the button and show a spinner when `isLoading` is true.

### M-8 — `calculateBounds` uses Euclidean distance for outlier detection
**File:** `website/src/components/MapView.jsx:241-257`  
Outlier-filtering uses `Math.sqrt((p.lat-avg)² + (p.lng-avg)²)` — inaccurate for geo coordinates, especially at high/low latitudes (Australia). `haversineDistance` already exists in `model/geo.js`.  
**Fix:** Use `haversineDistance(p.lat, p.lng, avgLat, avgLng)`.

### M-9 — `_hasInternet()` does a DNS lookup to `google.com`
**File:** `flutter_app/lib/services/sync_service.dart:716-722`  
Fails in Google-blocked regions and enterprise networks; leaks app activity to Google DNS. The actual dependency is `baseUrl`, not `google.com`.  
**Fix:** Use `connectivity_plus` or try a HEAD request to `baseUrl`.

### M-10 — `loadPointsAndTrips` duplicates `loadPoints`/`loadTrips` logic
**File:** `flutter_app/lib/services/storage_service.dart:19-42`  
The combined method manually reads and parses both files, duplicating what the individual methods already do.  
**Fix:** `return {'points': await loadPoints(), 'trips': await loadTrips()};`

### M-11 — `model/routeStyles.js` imports `lucide-react` (UI in model layer)
**File:** `website/src/model/routeStyles.js`  
A pure data/style constants file imports a React icon library. Icons should live in the component (`Legend.jsx`) that renders them, not in the data model.

---

## Low Issues

### L-1 — Filename typo: `PasswortGate.jsx` (German spelling)
All other files use English naming. Rename to `PasswordGate.jsx`.

### L-2 — `VAPID_PUBLIC_KEY` hardcoded in `constants.js`
**File:** `website/src/constants.js:7`  
Key rotation requires a code change + redeployment. The server reads it from env vars — the website should too (via `VITE_VAPID_PUBLIC_KEY` or `/meta` endpoint).

### L-3 — `window.location.reload()` used as pull-to-refresh
**File:** `website/src/components/PointDetail.jsx:89`  
Full page reload destroys React state and refetches all assets. Should call into the data layer to refetch only trip data.

### L-4 — 89 `print()` calls in Flutter production code
**Files:** `sync_service.dart`, `create_point_page.dart`, `browse_files_page.dart`, others  
`print()` is always active including release builds; leaks internal state to device logs.  
**Fix:** Replace with `debugPrint` (suppressed in release).

### L-5 — `revokeAllRefreshTokensForUser` exported but never called
**File:** `server/services/auth.js:93-97`  
Dead export. Keep it (useful for "sign out all devices") but document it or wire it up.

### L-6 — Background notification strings bypass i18n in `main.dart`
**File:** `flutter_app/lib/main.dart:280-303`  
Hardcoded DE/EN `List<String>` diverges from `AppLocalizations`. Adding a third language requires editing `main.dart`.

### L-7 — `InterestPoint.id` and `TripElement.id` are sequential `int` — collision-prone for multi-device
**Files:** `flutter_app/lib/model/interest_point.dart`, `flutter_app/lib/model/trip.dart`  
Two devices adding offline records will generate the same integer IDs. Server merge treats them as the same record → silent data loss.  
**Fix:** Switch to client-generated UUIDs (consistent with user/blog model).

### L-8 — Missing `Cache-Control: no-store` on `/me/blog/list`
**File:** `server/routes/editor.js`  
Authenticated directory listing has no cache headers; a proxy could serve one user's file list to another.  
**Fix:** `res.setHeader('Cache-Control', 'no-store, private')`.
