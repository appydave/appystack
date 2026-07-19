# Security Fleet Audit & Hardening — RVETS / AppyStack apps

> **One doc, one job:** raise the whole RVETS app fleet to an *enterprise-deployed* localhost-security
> bar, and make the apps safe both to (a) run on a customer machine and (b) be embedded as a
> **KyberAgent companion extension** (their React client rendered in a sandboxed iframe over a gated
> seam to KyberAgent's chatbot/brain).
>
> Audited 2026-06-22 against live source. Every finding below cites `file:line`. This document is the
> single source of truth for the remediation; the remediation work itself happens *per app repo*, driven
> from here.

---

## 0. How to use this doc / pick it up in a fresh session

You are (probably) a Claude session opened in `~/dev/ad/apps/appystack`. This doc is the brief.

1. **Read this whole file first.** It contains the full fleet inventory, per-app findings with
   `file:line`, the remediation design (`@appydave/appystack-server` / `createSecureServer()`), and a
   prioritised rollout.
2. **The goal:** every app reaches the **4-rung bar** (CORS lock → 127.0.0.1 bind → loopback API token
   → per-origin CSP `frame-ancestors`). The biggest lever is a new **runtime** package
   `@appydave/appystack-server` that bakes in all four rungs, adopted per-app via one import swap.
   See §4 and §5.
3. **Start with the highest-risk action** (see §6): **flivoice command-injection (RCE)** at
   `flivoice/server/src/routes/jump.routes.ts:31` and `:72`. That is a one-file fix and should land
   before anything else.
4. **Order of work:** (a) stop the bleeding on the Critical/High apps individually (flivoice RCE,
   flihub/storage-panel twins, storyline, thumbrack, fligen) — these are *diverged copies*, so each is
   its own PR; (b) build `@appydave/appystack-server`; (c) swap every app onto it; (d) patch the
   `appystack/template` scaffold so future apps inherit the hardened defaults.
5. **READ-ONLY rule for the *audit*:** this audit did not modify any app. The *remediation* obviously
   does — but each app is a separate repo with its own git history; branch + PR per app.
6. **Embedding gate (§7):** do **not** surface any app as a KyberAgent extension until it has cleared
   rungs 1–3. The list of who is currently blocked is in §7.

---

## 1. Executive summary + the enterprise-bar rationale

### What these apps are

The fleet is ~11 local apps built on **RVETS** (React 19 + Vite + Express 5 + TypeScript + Socket.io),
plus the `appystack` template/scaffold itself. Architecture: a React client in the browser talks to a
**localhost Node/Express server**; that server uses the **filesystem as its database** (no DB); it is a
plain npm-workspaces monorepo (`client` / `server` / `shared`). The server runs with the **user's full
OS disk permissions**.

### Why "localhost" is not "safe"

These apps were written with a "it's just my machine, it's local dev" mental model. That model is wrong
for three independent reasons, and all three matter once an app ships to a customer or is embedded in
KyberAgent:

1. **A localhost server is reachable from any website the user visits.** A browser tab on
   `evil.example.com` can `fetch()` / submit a form to `http://localhost:5021`. **CORS does not stop the
   request from being processed** — it only governs whether the attacker can *read the response*. So any
   **state-changing** endpoint (move/rename/delete/write a file, exec a command, repoint a disk root,
   make the server fetch a URL) **fires its side effect regardless of CORS**. This is the dominant threat
   here: *drive-by file destruction / RCE / SSRF*.
2. **`listen(PORT)` with no host arg binds `0.0.0.0`** — every network interface, not just loopback. On a
   customer's office Wi-Fi or a coffee-shop LAN, **other machines on the network can reach the server
   directly** (no browser, no CORS at all). Every app in the fleet does this.
3. **There is no authentication anywhere.** The socket.io auth hook is a *commented-out stub* copied from
   the template into every app and never enabled. No route is gated. Anyone who can reach the port — a
   website, a LAN peer, another local process — can drive the full API.

### The enterprise-deployed bar (the target)

Because these may run **on customer machines** and be **embedded in KyberAgent**, the bar is no longer
"works on my laptop." The bar is: *a malicious website, a hostile LAN peer, and untrusted iframe
JavaScript can each be safely assumed to exist, and none of them can read, mutate, or execute through
this app's server.* Concretely that is the **4-rung hardening ladder** (§4) and the **3-tier identity
model** (§3).

### Headline findings (full detail in §5)

| # | App | Worst issue | Severity |
|---|---|---|---|
| 1 | **flivoice** | **Command injection (RCE)** — `execSync(`jump search "${query}"`)` and `execSync(`open "${path}"`)` from request body, in the **live** entrypoint | **Critical** |
| 2 | **flihub** + **flihub-storage-panel** (byte-identical twins) | Wide-open CORS (`cors()` + `origin:true`) **+ no auth** + dozens of request-derived `fs.move`/`remove`/`writeFile` with no path-traversal guard → **drive-by arbitrary file read / move / delete / write** | **Critical** |
| 3 | **storyline-app** | Unauthenticated arbitrary-path `fs.move` from raw body; unauth registration of any disk root | **Critical** |
| 4 | **fligen** | **SSRF** (`fetch(req.body.imageUrl)`), write-path traversal via unsanitised filename parts, unauth agent-over-socket, **no helmet** | **High** |
| 5 | **thumbrack** | Unauth arbitrary-path file rename/reorder + arbitrary `.png/.jpg` read returned to client | **High** |
| 6 | **flideck** | `PUT /api/config` repoints the served + writable `presentationsRoot` to any existing dir (no allow-list) | **High** |
| 7 | **angeleye** | **Reflect-any CORS in dev — and dev is the default** (`NODE_ENV` defaults to `development`); unauth `git pull` + process-exit trigger | **High** |
| 8 | **deckhand** | Persist arbitrary Ecamm `action` via `/api/button`, later injected into the Ecamm HTTP control path | **Med** |
| 9 | **dss-2026** | Unauth recursive `rmSync` (bounded to a hardcoded root, prefix-guard weakness) | **Med** |
| 10 | **watchtower** | Lowest-risk: no request-derived fs/exec at all (health+info only) | **Low** |
| — | **ALL apps** | `listen()` binds `0.0.0.0`; socket.io auth is a commented stub; no loopback token | **Med (systemic)** |

**No committed secrets** were found in any app (no tracked `.env`, no hardcoded `sk-`/`AKIA`/`ghp_`
keys; flivoice keeps its ElevenLabs key in an *untracked* `server/.env`). **No genuine
prototype-pollution sink** was found.

---

## 2. The leverage finding — config package vs runtime package

The prior shallow audit's central insight is **confirmed against source**:

- **`@appydave/appystack-config` ships ZERO runtime code.** Its `package.json` (`config/package.json`)
  `exports` map contains only `./eslint/*`, `./vitest/*`, `./typescript/*`, `./prettier` — ESLint,
  Vitest, TypeScript and Prettier configs. Its `files` array is `["eslint/","vitest/","typescript/",
  "prettier/","README.md"]`. **There is nothing to import at runtime.** Patching this package can never
  change a single line of how any server boots, binds, or authenticates.
- **The runtime server lives in a *copied* scaffold template** at
  `appystack/template/server/src/index.ts`. `create-appystack` copies this file into each new app, after
  which **there is no live link** — every app owns a **diverged copy**. (Confirmed by audit: flideck and
  fligen don't even use `@appydave/shared`; their `index.ts` structure differs from the
  `@appydave/shared`-based apps. The fleet has genuinely drifted.)
- **Consequence:** patching the *template* fixes only **future** apps created after the patch. It does
  **nothing** for the 11 apps already in the field. And patching the *config package* fixes nothing at
  runtime, ever.

**Therefore the real one-change-hardens-many lever is a NEW runtime package:**

```
@appydave/appystack-server  →  exports createSecureServer({ clientUrl, embedOrigins, token })
```

…which bakes in **all four hardening rungs**, is **versioned and installable** (so a bump + reinstall
re-hardens an app), and is adopted per app via **one import swap** in `server/src/index.ts`. The template
then imports it too, so future apps are born hardened. This is the spine of the remediation (§4–§6).

---

## 3. The three-tier identity model (target design)

A companion app embedded in KyberAgent crosses three trust boundaries. Each boundary uses a **different**
kind of credential. Conflating them (e.g. handing an API key to iframe JS) is the classic mistake — so
name them explicitly:

```
   ┌─────────────────────────────────────────────────────────────────────────┐
   │  TIER 1  surface → host           = FRAME IDENTITY                         │
   │  (untrusted iframe JS → KyberAgent kernel)                                 │
   │  Unforgeable, set by KyberAgent from the iframe's frame-identity.          │
   │  NEVER put an API key here — iframe JS is untrusted.                       │
   └─────────────────────────────────────────────────────────────────────────┘
                                   │  (KyberAgent mediates the seam only)
   ┌─────────────────────────────────────────────────────────────────────────┐
   │  TIER 2  daemon ↔ companion-server = API TOKEN                             │
   │  A loopback shared secret the COMPANION mints and holds.                   │
   │  ANY legitimate caller reads & presents it: KyberAgent's daemon, a Claude  │
   │  skill curling the app, another local tool. Randoms (a website, a LAN      │
   │  peer) don't have it → excluded.                                           │
   └─────────────────────────────────────────────────────────────────────────┘
                                   │
   ┌─────────────────────────────────────────────────────────────────────────┐
   │  TIER 3  companion's own disk     = OS PERMISSIONS                         │
   │  The server's intrinsic, OS-granted disk access. NOT mediated by           │
   │  KyberAgent. KyberAgent mediates only the seam conversation (Tier 1/2),    │
   │  never the app's own disk reach.                                           │
   └─────────────────────────────────────────────────────────────────────────┘
```

The hardening ladder (§4) operates entirely at **Tier 2** (and the CSP rung defends Tier 1's embedding).
Tier 3 is out of scope — we are not sandboxing the app's own disk; we are stopping *unauthorised callers*
from driving it.

---

## 4. The four-rung hardening ladder (target design)

Escalating; each rung closes a distinct attacker. `createSecureServer()` (§5) implements all four.

| Rung | Control | Kills | Maps to tier |
|---|---|---|---|
| **1** | **Lock CORS to specific origins** (never `origin:true` / bare `cors()`) | Drive-by website *reading* responses | Tier 2 |
| **2** | **Bind `127.0.0.1` only** (`listen(PORT, '127.0.0.1')`) | LAN peers reaching the server at all | Tier 2 |
| **3** | **Loopback API token** on every mutating/exec route + socket handshake | Any caller without the token — incl. a drive-by site whose *request* still fires under CORS | Tier 2 |
| **4** | **Per-origin CSP `frame-ancestors`** | Random sites embedding the app, while *allowing* KyberAgent to | Tier 1 (embedding) |

**Why rung 3 is the load-bearing one for this fleet.** Rung 1 (CORS) only hides *responses*; it does
**not** stop a drive-by POST's *side effect* (the file still gets moved/deleted). Rung 2 removes the LAN.
But the in-browser drive-by request still arrives on loopback. **Only the API token (rung 3) actually
refuses to execute a mutating request that lacks the secret.** For an app like flihub or storyline whose
danger is *side-effecting writes*, rungs 1+2 are necessary but **rung 3 is what makes it safe.** This is
why the rollout (§6) treats "token on write/exec routes" as the bar for embedding, not just CORS.

---

## 5. Per-app findings (with `file:line`) + minimal fix

> Conventions below: "drive-by reachable" = a website the user visits can trigger the side effect via
> `fetch`/form-POST. "Side effect fires under CORS" = the locked-CORS apps still *execute* the mutation
> even though the attacker can't read the reply.

### 5.0 Fleet inventory table

| App | Path | CORS | Bind | Framing (CSP) | Auth | Write / exec surface | Embeddable today? | Worst sev |
|---|---|---|---|---|---|---|---|---|
| **appystack (template)** | `apps/appystack/template` | locked `env.CLIENT_URL` (`server/src/index.ts:38`) | `listen(env.PORT)` → 0.0.0.0 | helmet default | commented stub | port-cleanup `execSync` only (not req) | n/a (scaffold) | Low |
| **flivoice** | `flivideo/flivoice` | locked `:5500` (`index.ts:48`) | `listen(PORT)` → 0.0.0.0 (`:244`) | none extra | **none (no stub)** | **execSync RCE** `jump.routes.ts:31,72` | **NO** | **Critical** |
| **flihub** | `flivideo/flihub` | **`cors()` + `origin:true`** (`index.ts:91,85`) | `listen(PORT)` → 0.0.0.0 (`:374`) | **no helmet** | **none** | **massive**: `fs.move`/`remove`/`writeFile` from raw req, no guard | **NO** | **Critical** |
| **flihub-storage-panel** | `flivideo/flihub-storage-panel` | **same (twin)** (`index.ts:91`) | `listen(PORT)` → 0.0.0.0 (`:370`) | **no helmet** | **none** | **same as flihub (byte-identical route files)** | **NO** | **Critical** |
| **storyline-app** | `flivideo/storyline-app` | locked `:5300` (`index.ts:42`) | `listen(PORT)` → 0.0.0.0 (`:279`) | helmet, **CSP+CORP off** (`:32`) | **none (no stub)** | arbitrary `fs.move` raw body `fs.service.ts:55`; root-register | **NO** | **Critical** |
| **fligen** | `flivideo/fligen` | locked `:5400` (`index.ts:53`) | `listen(PORT)` → 0.0.0.0 (`:172`) | **no helmet** | **none** | **SSRF** `save-to-catalog.ts:22`; write-traversal `catalog/storage.ts:152`; unauth agent socket | **NO** | **High** |
| **thumbrack** | `apps/thumbrack` | locked `:5020` (`index.ts:44`) | `listen(PORT)` → 0.0.0.0 (`:127`) | helmet, CORP relaxed (`:38`) | commented stub (`:83`) | arbitrary rename/reorder `rename.ts`; arbitrary png/jpg read `images.ts:26` | **NO** | **High** |
| **flideck** | `flivideo/flideck` | locked `:5200` (`index.ts:139`) | `listen(PORT)` → 0.0.0.0 (`:344`) | helmet (`:137`) | **none** | `PUT /api/config` root-repoint `config.ts:43`; CRUD guarded by `assertSafeId` | **NO** | **High** |
| **angeleye** | `apps/angeleye` | **reflect-any in dev (default)** `index.ts:42` | `listen(env.PORT)` → 0.0.0.0 (`:197`) | helmet + real CSP (`:52`) | commented stub (`:124`) | internal-dir writes (safe); unauth `git pull`+exit `git-sync.service.ts` | **NO** | **High** |
| **deckhand** | `apps/deckhand` | locked `:5030` (`index.ts:42`) | `listen(env.PORT)` → 0.0.0.0 (`:150`) | helmet (`:40`) | commented stub (`:79`) | persist arbitrary Ecamm `action` → HTTP-path inject; `exec('dns-sd…')` hardcoded | **NO** | **Med** |
| **dss-2026** | `apps/digital-stage-summit-2026` | locked `:5070` (`index.ts:41`) | `listen(env.PORT)` → 0.0.0.0 (`:137`) | helmet (`:39`) | commented stub (`:82`) | recursive `rmSync` bounded to hardcoded root `sync.ts:141`; `execSync('open …')` hardcoded | **NO** | **Med** |
| **watchtower** | `apps/watchtower` | locked `:5060` (`index.ts:36`) | `listen(env.PORT)` → 0.0.0.0 (`:118`) | helmet (`:34`) | commented stub (`:72`) | **none req-derived** (health+info only); startup `execSync` only | NO (needs rungs 1–3) | Low |

> "Embeddable today? = NO" for every app, because **none has rung 3 (token) and all bind 0.0.0.0**. Even
> watchtower, which has no dangerous surface, must clear rungs 1–3 before embedding so the seam's identity
> guarantees hold.

---

### 5.1 flivoice — Command injection (RCE) — **CRITICAL**

- **Live entrypoint is `index.ts`** (not `index-v2.ts`). `server/package.json` → `"dev": "tsx watch
  src/index.ts"`, `"start": "node dist/index.js"`; `index.ts:83` mounts `app.use('/api/jump',
  jumpRoutes)`; `server.listen` is at `index.ts:244`. `index-v2.ts` is **dead code** (no script
  references it) — it has the same injection shape (`index-v2.ts:170`) but does not run.
- **`jump.routes.ts:31`** — `POST /api/jump/search`:
  ```ts
  const { query } = req.body;                                   // :19
  const result = execSync(`jump search "${query}" --format json`, { encoding: 'utf-8' });  // :31
  ```
  Shell metacharacters in the JSON body execute. Payload e.g. `{"query":"\"; touch /tmp/pwned; \""}`.
- **`jump.routes.ts:72`** — `POST /api/jump/open`:
  ```ts
  const { path } = req.body;                 // :60
  execSync(`open "${path}"`, { encoding: 'utf-8' });   // :72
  ```
  Same — arbitrary command execution.
- Also live: `server/src/tools/elevenlabs/client-tools.ts:181` `exec(`jump search "${typedParams.query}"…`)`
  — same injection, but the input arrives from the ElevenLabs agent over the SDK, not a direct HTTP route.
- **Reachability:** CORS is correctly locked to `http://localhost:5500` (`index.ts:48`), so a generic
  drive-by site's `fetch` with `Content-Type: application/json` triggers a preflight the server rejects —
  narrowing the pure-browser vector. **But the exec still fires server-side for** any same-origin page on
  `:5500`, any non-browser LAN client (binds `0.0.0.0`), or a `text/plain` simple-request POST. Given RCE
  impact, this is **Critical regardless**.
- **Minimal fix (do this first, today):** replace `execSync(string)` with `execFileSync('jump',
  ['search', query, '--format', 'json'])` and `execFileSync('open', [path])` — array args, **no shell**,
  no interpolation. Validate `path` is an existing path under an allowed root. Then adopt rung 3 (token)
  so only token-holders can call `/api/jump/*` at all.

### 5.2 flihub + flihub-storage-panel — wide-open CORS + no auth + unguarded FS writes — **CRITICAL** (twins)

- **CORS reflects ANY origin:** `index.ts:91` `app.use(cors());` (bare → `Access-Control-Allow-Origin: *`)
  and `index.ts:84-85` socket.io `cors: { origin: true }` — the comment literally reads *"Reflects
  requesting origin (safe for local dev)"*; it is **not** safe. Any website can read responses.
- **No helmet, no socket auth, `httpServer.listen(PORT)` at `index.ts:374` → 0.0.0.0.**
- **Mutable disk root:** `config/configManager.ts` loads/saves `server/config.json` with
  `projectsRootDirectory` (default `~/dev/video-projects/v-appydave`, `:28`) and `watchDirectory`
  (`:26`). **`POST /api/config` (index.ts:120-151) lets any request repoint these to any path** and
  starts a chokidar watcher there.
- **Request-derived, unguarded FS mutations** (`expandPath` only expands `~`; `queryString()` does not
  sanitise; no `path.resolve`+`startsWith` containment):
  - `POST /api/rename` → `fs.move(originalPath, …)` `index.ts:230` (raw body) — **Critical** (move any file).
  - `POST /api/trash` → `fs.move(filePath, …)` `index.ts:327` — **Critical**.
  - `DELETE /api/assets/incoming/:encodedPath` → `fs.remove(filePath)` `assets.ts:378` — **Critical** (arbitrary delete).
  - `POST /api/projects/:code/inbox/write` → `fs.writeFile(filePath, content)` `projects.ts:775` — **Critical** (write anywhere).
  - `POST /api/assets/assign` → `fs.move(sourcePath, …)` `assets.ts:346` — **High**.
  - `GET /api/assets/image/:encodedPath` → `fs.createReadStream(filePath)` `assets.ts:415` — **High** (arbitrary read → client).
  - `GET /api/thumbs/image/:filename` `thumbs.ts:311`; `DELETE /api/thumbs/:filename` `thumbs.ts:418`;
    `POST /api/thumbs/reorder` `fs.rename` `thumbs.ts:344` — **High**.
  - `POST /api/manage/regen-shadows` `manage.ts:267` + `/regen-all` `manage.ts:771` → `fs.remove` from
    `req.body.files[]`, strips only `.mov/.mp4` so `"../../../x.mp4"` escapes — **High**.
  - Loose-regex traversal (Medium): `assets.ts:636/686/592`; transcript/srt read traversal
    `query/transcripts.ts:160/211/254` (sibling `query/inbox.ts:151-158` does it correctly — inconsistent omission).
- **Properly guarded already (reuse these patterns):** `DELETE /api/projects/:code` (`projects.ts:712`,
  rejects `..` + `path.resolve`); all `storage.ts` Hold/Archive `fs.rm` (`isValidCode` +
  `path.resolve`+`startsWith(root+sep)` at `:304/:518/:799/:800`); `thumbs.ts:388` (`fs.realpath`+startsWith);
  `video.ts` (reject `..` + folder whitelist). **child_process is all SAFE** — `spawn`/`execFile` with
  literal binaries (`rsync`/`git`/`ffmpeg`), array args, no `{shell:true}`.
- **Twin confirmation:** the dangerous route files (`assets.ts`, `thumbs.ts`, `projects.ts`, `manage.ts`)
  are **byte-identical** between flihub and flihub-storage-panel; the only `index.ts` diff is the
  `holdingPath`/`publishedPath` lines in the `POST /api/config` destructure (~`:131/:144`). **Every
  finding applies to both at the same line numbers.**
- **Minimal fix:** rung 1 (lock CORS to the real client origin + KyberAgent embed origin), rung 2 (bind
  127.0.0.1), rung 3 (token on every mutating route + the socket handshake), and a **shared path-traversal
  guard** (`assertWithinRoot(root, candidate)` using `path.resolve`+`startsWith(root + sep)`) applied to
  every `originalPath`/`filePath`/`sourcePath`/`encodedPath`. Lock `POST /api/config` behind the token and
  validate the new root against an allow-list. Because these are twins, fix flihub then port the diff.

### 5.3 storyline-app — unauth arbitrary `fs.move` + arbitrary root registration — **CRITICAL**

- CORS **locked** to `:5300` (`index.ts:42`); helmet present but **CSP and CORP disabled** (`:32`);
  `server.listen(PORT)` → 0.0.0.0 (`:279`); **socket.io has no auth at all** (`index.ts:138`).
- `filesystem.routes.ts` mounts at `/api/project`; `validateProject` (`:15-40`) only checks the project
  *name* exists — **it is not auth**.
- **`POST /api/project/:projectName/images/move` (`filesystem.routes.ts:299`)** → `fs.move(fromPath,
  finalPath)` `services/filesystem.service.ts:55`. `fromPath`/`toPath` come **raw from req.body**
  (`:305`); the `projectPath` param is ignored (underscore). **Arbitrary file move anywhere.** — **Critical**.
- **`POST /api/project/config` (`project.routes.ts:79`)** → `fs.writeFileSync(CONFIG_FILE, …)`
  (`project.routes.ts:42`): registers **any absolute `projectPath`** (only validated to exist + contain a
  storyline.json), becoming the root for the move/rename/delete routes. — **Critical**.
- `PUT .../images/rename` (`:349` → `fs.rename` `service:116`), `DELETE .../images/scene/:filename`
  (`:406` → `fs.remove` `service:145`), `POST .../images/batch-move` (`:445`) — request-derived,
  `../`-traversal possible (no guard). — **High**.
- `PATCH /api/data/:projectName/metadata` (`data.routes.ts:340` → `fs.writeFile` `data.service.ts:250`) —
  fixed path, attacker-controlled content. **No rate limiter** in this app at all.
- `GET /api/images/...` (`images.routes.ts:38`) **is** correctly guarded (`startsWith(projectBasePath)`,
  `:96-105`) — reuse that pattern.
- **Minimal fix:** rungs 1–3 + apply the shared traversal guard to `move`/`rename`/`delete`/`batch-move`;
  drop the raw `fromPath`/`toPath` model (derive from project root + validated relative path); gate
  `POST /api/project/config` behind the token; enable socket auth; add a rate limiter.

### 5.4 fligen — SSRF + write-path traversal + unauth agent socket + no helmet — **HIGH**

- CORS **locked** to `:5400` (`index.ts:53`); **helmet ABSENT** (only app with neither helmet nor a stub);
  `httpServer.listen(PORT)` → 0.0.0.0 (`:172`); `express.json({limit:'50mb'})` (`:54`).
- **SSRF:** `POST /api/images/save-to-catalog` (`routes/images.ts:12`) → `saveImageToCatalog`
  (`tools/image/save-to-catalog.ts`) does `fetch(imageUrl)` (`:22`) with **`imageUrl` raw from req.body,
  no scheme/host validation** → server fetches internal/metadata/`file:` URLs. — **High**. (Contrast: the
  n8n route guards with `assertHttpsUrl`, `n8n.ts:15-19` — reuse it.)
- **Write-path traversal:** `generateFilename(type, provider, model, ext)` (`tools/catalog/storage.ts:152-161`)
  interpolates `provider` verbatim and `model` (only spaces→`-`) into the filename — neither strips `/` or
  `..`. `provider`/`model` are request-derived in `save-to-catalog` (`images.ts:14`), then
  `fs.writeFile(path.join(assetsDir,'catalog','images', filename))` (`save-to-catalog.ts:28`). A
  `provider:"../../../../tmp/pwn"` writes outside the catalog dir. — **High**.
- **Unauth agent over socket:** socket `connection` (`index.ts:86`) wires `agent:query` (`:106` →
  `handleAgentQuery`, runs the Claude agent) with **no auth**. — **Med-High** (CORS-locked WS limits this
  to same-origin pages, but it is unauthenticated agent execution).
- `DELETE /api/widgets/:id` (`routes/widgets.ts:114` → `widgets/storage.ts:161`) — `id` raw, `path.join`
  then `fs.unlink`, no traversal guard (bounded to `.html`/`.json`). — **Med-High**.
- `GET /api/projects/:projectCode` (`routes/projects.ts:220` → `tools/projects/storage.ts:116`) —
  `validateProjectCode` applied in `saveProject` but **not `loadProject`** → bounded arbitrary-dir read. — **Med**.
- Batch CSV `JSON.parse(row.metadata)` (`routes/batch.ts:184`) feeds the unsanitised filename path above. **No rate limiter.**
- **Minimal fix:** add helmet; rungs 1–3; sanitise `provider`/`model` (basename / `..` reject) before
  filename build; validate `imageUrl` with `assertHttpsUrl` (no `file:`/internal hosts); guard widget
  `id` and `loadProject` projectCode; gate `agent:query` behind the socket token; add a rate limiter.

### 5.5 thumbrack — unauth arbitrary rename + arbitrary file read — **HIGH**

- CORS **locked** to `:5020` (`index.ts:44`); helmet present, CORP relaxed to cross-origin (`:38`);
  `httpServer.listen(env.PORT)` → 0.0.0.0 (`:127`); socket auth is a **commented stub** (`index.ts:83`).
- **No notion of an allowed root** anywhere (`expandHome()` even expands `~/`, `routes/folder.ts:9`) —
  directories are taken straight from the request:
  - `POST /api/rename` (`routes/rename.ts:12`) → `fsRename(...)` `:69-77`; `{ dir, filename, newNumber }`
    from body, `filePath = join(dir, filename)` `:30`, **no root, no `..` check**. — **High** (rename any file).
  - `POST /api/reorder` (`rename.ts:90`) → `twoPassRename`+`writeManifest` `:121/:148` — **High**.
  - `POST /api/manifest?dir=` (`routes/manifest.ts:48`) → `writeFile(join(dir,'.thumbrack.json'))`
    `helpers/manifestHelpers.ts:48` — writes into **any** `?dir=`. — **High** (arbitrary write location).
  - `GET /api/images/:encodedPath` (`routes/images.ts:9`) → `res.sendFile(absolutePath)` `:26`; decoded
    **absolute path**, only an extension allow-list (`.png/.jpg/.jpeg`). — **High** (arbitrary image read → client).
- Rate limiter present but **skips localhost** (`middleware/rateLimiter.ts:8`) → unlimited for the exact
  drive-by/loopback case.
- **Minimal fix:** introduce an allowed-root config; apply the shared traversal guard to `dir`/`filename`/
  `encodedPath`; rungs 1–3; stop skipping localhost in the limiter for write/exec routes.

### 5.6 flideck — root-repoint via `PUT /api/config` — **HIGH**

- CORS **locked** to `:5200` (`index.ts:139`); helmet present (`:137`); `httpServer.listen(PORT)` →
  0.0.0.0 (`:344`); socket has **no auth** (`index.ts:247`).
- **`PUT /api/config` (`routes/config.ts:43`)** accepts `presentationsRoot` from req.body, only checks the
  dir **exists** (`config.ts:55-66`), **no allow-list**. That root is (a) **served statically** at
  `/presentations` (`index.ts:155-159`, dynamic per-request) and (b) the write/delete root for all CRUD.
  A drive-by `PUT /api/config {presentationsRoot:"/Users/davidcruwys"}` makes the home dir browsable at
  `/presentations/...` and relocates the write surface. — **High**.
- **Positive:** all CRUD goes through `assertSafeId()` (`PresentationService.ts:119-123`, `path.resolve` +
  `startsWith(resolvedRoot + path.sep)`), applied at ~19+9 call sites — **the strongest traversal guard in
  the fleet; promote this into the shared package as the canonical helper.** No rate limiter.
- **Minimal fix:** gate `PUT /api/config` behind the token + allow-list the root; rungs 1–3; add a rate limiter.

### 5.7 angeleye — reflect-any CORS *in the default mode* + unauth git-pull/exit — **HIGH**

- **`const corsOrigin = env.isDevelopment ? true : env.CLIENT_URL;`** (`index.ts:42`), used by both
  socket.io (`:46`) and `app.use(cors({ origin: corsOrigin }))` (`:63`). **`origin: true` reflects any
  origin.**
- **dev is the default:** `config/env.ts:10` `NODE_ENV … .default('development')`, `:29` `isDevelopment =
  NODE_ENV === 'development'`. With no `NODE_ENV` set, **the reflect-any branch is live** → any website can
  both trigger and *read* every endpoint (session data, transcripts, workspaces). — **High**.
- `httpServer.listen(env.PORT)` → 0.0.0.0 (`:197`); socket auth is a **commented stub** (`index.ts:124`);
  helmet + real CSP present (`:52`).
- **Unauth `git pull` + process exit:** `POST /api/git-sync/pull` → `git-sync.service.ts:11`
  `execFileAsync('git', args, { cwd: REPO_ROOT })` — `execFile` (no shell), args **not** request-derived,
  but `pullUpstream` runs `git pull --rebase` and may `process.exit(0)` (`:197-200`). A drive-by site
  (reflect-any) can **trigger git pull and kill/restart the server**. — **High** (no injection, but unauth
  remote control).
- `/mockups` serves the monorepo root with `dotfiles:'allow'` (`index.ts:91-98`) — read-only repo
  disclosure. **Med**. Rate limit is `5000/15min` on `/api/*` only — ineffective against scripting.
- Writes are to **fixed internal dirs keyed by server-generated UUIDs** (workspace/workflow/registry
  services) — **not** request-path-controlled. Lower FS risk than the FS apps.
- **Minimal fix:** change rung 1 to a hardcoded allow-list (never `true`, even in dev) — `[clientUrl,
  ...embedOrigins]`; rungs 2–3; gate `/api/git-sync/*` behind the token; restrict `/mockups`.

### 5.8 deckhand — persisted Ecamm action → HTTP-path injection — **MED**

- CORS **locked** `:5030` (`index.ts:42`); helmet (`:40`); `listen(env.PORT)` → 0.0.0.0 (`:150`); socket
  commented stub (`:79`).
- `exec('dns-sd -L "Ecamm Live Remote" …')` (`services/ecammService.ts:13`) is a **hardcoded string, no
  request interpolation** → **Low** (the prior audit's "ecamm exec" flag is benign as written).
- **`POST /api/button` (`routes/deckhand.ts:120`)** stores an arbitrary `action` string (validated only as
  non-empty, `:155`) into config (`configService.ts:38`, fixed path — no traversal). On `POST /api/press`
  (`:196`) the stored action is interpolated into the **Ecamm HTTP control URL** (`buildEcammEndpoint`,
  `ecammService.ts:96/103/109/115`) — **not a shell**. Worst case: HTTP-path/parameter smuggling against
  the local Ecamm API. — **Med**.
- **Minimal fix:** rungs 1–3; whitelist `action` against known commands; that closes it.

### 5.9 dss-2026 — bounded recursive delete + hardcoded exec — **MED**

- CORS **locked** `:5070` (`index.ts:41`); helmet (`:39`); `listen(env.PORT)` → 0.0.0.0 (`:137`); socket
  commented stub (`:82`); global rate limiter present (`:46`).
- `execSync(`open "${RELAY_ROOT}"`)` (`routes/sync.ts:185`) — **`RELAY_ROOT` is the hardcoded constant**
  `~/relay/david-jan` (`sync.ts:18`), **no request input** → **Low** (prior "execSync('open …')" flag is benign).
- `DELETE /api/sync/file?path=` → `rmSync(fullPath, {recursive:true})` (`sync.ts:141`); `path` from query;
  guard is `resolve(join(RELAY_ROOT, filePath))` + `startsWith(RELAY_ROOT)` (`:131-135`). Unauth recursive
  delete **bounded to RELAY_ROOT**, drive-by reachable. — **Med**. *Guard weakness:* `startsWith` lacks a
  trailing `path.sep` (also `:99/:156`), so a sibling like `~/relay/david-jan-evil` passes — use
  `startsWith(root + path.sep)`.
- **Minimal fix:** rungs 1–3; fix the trailing-sep guard (the shared `assertWithinRoot` does this correctly).

### 5.10 watchtower — lowest risk — **LOW**

- CORS **locked** `:5060` (`index.ts:36`); helmet (`:34`); `listen(env.PORT)` → 0.0.0.0 (`:118`); socket
  commented stub (`:72`); global rate limiter (`:41`). Only health + info routes; **no request-derived
  fs/exec** (startup `execSync('lsof'/'kill')` only). Still needs rungs 1–3 before embedding so the seam
  identity guarantees hold.

---

## 6. The remediation — `@appydave/appystack-server` / `createSecureServer()`

A new **runtime** workspace package (sibling to `@appydave/appystack-config`), published the same way,
that an app installs and imports. It bakes all four rungs into one factory.

### 6.1 API

```ts
// @appydave/appystack-server
import type { Express } from 'express';
import type { Server as IOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';

export interface SecureServerOptions {
  /** Rung 1: the app's own browser client origin, e.g. "http://localhost:5020". Required. */
  clientUrl: string;

  /** Rung 4 + Rung 1: additional origins allowed to embed/call — e.g. the KyberAgent
   *  host/extension origin(s). Drives both the CORS allow-list and the CSP
   *  `frame-ancestors`. Empty by default (standalone, un-embeddable). */
  embedOrigins?: string[];

  /** Rung 3: the loopback API token. If omitted, createSecureServer MINTS one on boot
   *  (see §6.3) and writes it to ~/.appystack/<app>.token (0600). The resolved token is
   *  returned so the app can log/expose it locally. */
  token?: string;

  /** Logical app name → token filename ~/.appystack/<name>.token. Required when token omitted. */
  appName: string;

  /** Rung 2 override. Defaults to '127.0.0.1'. Set '0.0.0.0' only with an explicit reason. */
  host?: string;

  /** Routes/socket-events exempt from the token (e.g. GET /health). Default: ['/health','/info']. */
  publicPaths?: string[];
}

export interface SecureServer {
  app: Express;            // express() with helmet + locked CORS + token middleware pre-wired
  io: IOServer;            // socket.io with locked CORS + handshake-token guard pre-wired
  httpServer: HttpServer;  // bound to host (127.0.0.1) on listen()
  token: string;           // the resolved/minted token (Tier-2 secret)
  listen(port: number): Promise<void>;  // listens on (port, host); runs port-cleanup
}

export function createSecureServer(opts: SecureServerOptions): SecureServer;

/** Canonical traversal guard — promoted from flideck's assertSafeId. Throws if `candidate`
 *  resolves outside `root`. Use in EVERY fs route that takes request-derived paths. */
export function assertWithinRoot(root: string, candidate: string): string;

/** Canonical URL guard — promoted from fligen's assertHttpsUrl. Rejects non-https,
 *  file:, and private/loopback/metadata hosts. Use before any server-side fetch(). */
export function assertSafeUrl(url: string): URL;
```

### 6.2 What each rung does inside the factory

- **Rung 1 — CORS lock.** Builds an allow-list = `[clientUrl, ...embedOrigins]` and passes a function
  origin-checker to **both** `cors()` (express) and the socket.io `cors` option. **Never** `origin:true`,
  **never** bare `cors()`. This is the single replacement for flihub's `cors()`/`origin:true` and
  angeleye's `isDevelopment ? true : …`.
- **Rung 2 — bind 127.0.0.1.** `listen(port)` calls `httpServer.listen(port, opts.host ?? '127.0.0.1')`.
  Removes all LAN reachability fleet-wide in one line.
- **Rung 3 — loopback token.** Express middleware checks `Authorization: Bearer <token>` (or
  `X-Appystack-Token`) on every non-`publicPaths` route and returns 401 otherwise; a socket.io
  `io.use()` middleware checks `socket.handshake.auth.token`. **This is the real `socket.handshake.
  auth.token` implementation the template only ever had as a comment.** It is what makes the
  side-effecting routes safe even when a drive-by request reaches loopback.
- **Rung 4 — per-origin CSP `frame-ancestors`.** Configures helmet's CSP so `frame-ancestors` =
  `['self', ...embedOrigins]`. A random site cannot iframe the app; **KyberAgent (an `embedOrigin`)
  can.** Defaults to `'none'`/`'self'` when `embedOrigins` is empty (standalone, not embeddable — safe).

### 6.3 Token minting, storage, discovery

- **Mint on boot:** if `token` is not supplied, generate `crypto.randomBytes(32).toString('hex')`.
- **Store:** write to **`~/.appystack/<appName>.token`** with mode **`0600`** (owner read/write only),
  creating `~/.appystack` `0700` if absent. Overwrite each boot (or reuse if present — recommend reuse so
  long-lived skills don't break mid-session; regenerate on demand via a documented reset).
- **Discover (this is the compatibility story):** **any legitimate caller reads the file and presents the
  token.** The companion holds it; KyberAgent's daemon reads it; a Claude skill reads it. A drive-by
  website cannot read a `0600` file in the user's home → excluded. This is exactly Tier 2 of §3.

### 6.4 Keeping existing Claude skills working

Today skills curl the apps **with no token** — e.g. the flihub skill does
`curl -s "http://localhost:5101/api/query/projects/<code>/export" | jq`
(`~/.claude/skills/flihub/export-command.md`). Two-phase migration so nothing breaks:

1. **Grandfather GETs first.** On initial token rollout, put read-only query routes
   (`/api/query/*`, `/health`, `/info`) in `publicPaths`, and enforce the token only on **mutating /
   exec** routes (the actually-dangerous ones). Existing read-only skills keep working untouched.
2. **Teach skills the token, then tighten.** Update each skill's curl to read the token and send it:
   ```bash
   TOKEN=$(cat ~/.appystack/flihub.token)
   curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:5101/api/query/projects/<code>/export" | jq
   ```
   Once the skills carry the token, remove the GET grandfathering so reads are gated too. (Skills live in
   `~/.claude/skills/<name>/` — updating them is a separate, low-risk pass, not part of an app PR.)

### 6.5 Per-app adoption — the import swap

Each app's `server/src/index.ts` changes from hand-rolled express/socket/listen to:

```ts
import { createSecureServer, assertWithinRoot } from '@appydave/appystack-server';

const { app, io, listen, token } = createSecureServer({
  appName: 'thumbrack',
  clientUrl: env.CLIENT_URL,
  embedOrigins: env.KYBERAGENT_ORIGIN ? [env.KYBERAGENT_ORIGIN] : [],
});

// ... mount routes on `app`, wire socket handlers on `io` ...
// ... in fs routes, replace raw joins with assertWithinRoot(root, candidate) ...

await listen(env.PORT);  // binds 127.0.0.1, runs port-cleanup
```

That single swap delivers rungs 1, 2, 4 and the framework for rung 3 (the token middleware is already
mounted; each app still must declare which routes are public). The **per-app residual work** is: (a) the
import swap, (b) marking `publicPaths`, (c) replacing each request-derived `fs.*` path with
`assertWithinRoot`, and (d) any app-specific input validation (flivoice's `execFileSync`, fligen's
`assertSafeUrl` + filename sanitisation, deckhand's action whitelist).

### 6.6 Template vs diverged copies

- **Template (`appystack/template/server/src/index.ts`):** rewrite to call `createSecureServer()` and
  enable the real socket-token guard (delete the commented stub). New apps from `create-appystack` are
  then born at the 4-rung bar. **But remember the leverage finding — this fixes only future apps.**
- **Diverged copies (the 11 live apps):** each must `pnpm add @appydave/appystack-server` and do the
  import swap in its own repo/PR. There is no auto-propagation; the package version bump is the
  mechanism that lets a future security fix reach all of them at once (bump + reinstall), which the
  current copy-template model can never do.

---

## 7. Prioritised rollout (highest-risk-first), mapped to the 4 rungs

**Phase 0 — stop the RCE today (per-app, no package needed):**
- **flivoice** `jump.routes.ts:31,72` → `execFileSync` array args. (Critical; one file.)

**Phase 1 — build the lever:**
- Create `@appydave/appystack-server` with `createSecureServer()` + `assertWithinRoot` +
  `assertSafeUrl` (promote flideck's `assertSafeId` and fligen's `assertHttpsUrl`). Unit-test rungs 1–4
  and the token mint/store/discover.

**Phase 2 — Critical apps (rungs 1+2+3 + traversal guard), each its own PR:**
1. **flihub** → fix all unguarded `fs.*` with `assertWithinRoot`, lock CORS, bind 127.0.0.1, token,
   gate `POST /api/config`.
2. **flihub-storage-panel** → port the flihub fix (twins).
3. **storyline-app** → drop raw `fromPath`/`toPath`, guard move/rename/delete, gate
   `POST /api/project/config`, enable socket auth, add limiter.
4. **flivoice** → adopt the package (token + bind + CSP) on top of the Phase-0 exec fix.

**Phase 3 — High apps:**
5. **fligen** → add helmet, `assertSafeUrl`, sanitise `provider`/`model`, guard widget id + loadProject,
   gate `agent:query`, limiter, rungs 1–3.
6. **thumbrack** → allowed-root + `assertWithinRoot`, stop localhost rate-limit skip, rungs 1–3.
7. **flideck** → gate + allow-list `PUT /api/config`, rungs 1–3, limiter.
8. **angeleye** → kill the `isDevelopment ? true` branch (hardcoded allow-list), gate `/api/git-sync/*`,
   restrict `/mockups`, rungs 1–3.

**Phase 4 — Med/Low apps (mostly just the package swap):**
9. **deckhand** → action whitelist + rungs 1–3.
10. **dss-2026** → trailing-sep guard fix + rungs 1–3.
11. **watchtower** → package swap (rungs 1–3) — trivial, no surface to fix.

**Phase 5 — template + skills:**
- Rewrite `appystack/template/server/src/index.ts` onto `createSecureServer()`; delete the commented
  socket-auth stub. Update Claude skills (`~/.claude/skills/*`) to read `~/.appystack/<app>.token`, then
  remove GET grandfathering.

**What can wait:** the `/mockups` repo disclosure (angeleye, read-only), the dss trailing-sep nicety
(bounded), and tightening GET reads behind the token (after skills carry it). Everything in Phase 0–3
should land before any embedding.

---

## 8. Do NOT surface as a KyberAgent extension until rungs 1–3

**Embedding gate:** an app may be surfaced as a KyberAgent companion extension **only after it has rung 1
(CORS lock incl. the KyberAgent embed origin), rung 2 (127.0.0.1 bind), and rung 3 (loopback token on
mutating/exec routes + socket handshake).** Rung 4 (`frame-ancestors`) is what *enables* the embed; rungs
1–3 are what make it *safe*.

**Currently BLOCKED from embedding (all 11 — none has rung 3, all bind 0.0.0.0):**

- flivoice — **also has live RCE; absolutely not until Phase 0 + rungs 1–3.**
- flihub, flihub-storage-panel — **wide-open CORS + arbitrary FS writes; not until Phase 2.**
- storyline-app — **arbitrary `fs.move` + root register; not until Phase 2.**
- fligen — **SSRF + write-traversal + no helmet; not until Phase 3.**
- thumbrack — **arbitrary rename/read; not until Phase 3.**
- flideck — **root-repoint; not until Phase 3.**
- angeleye — **reflect-any-by-default + unauth git control; not until Phase 3.**
- deckhand, dss-2026, watchtower — lower risk, but **still need rungs 1–3** (package swap) before embedding.

---

## Appendix — evidence index

All findings verified against live source on 2026-06-22. Representative anchors:

- Leverage: `appystack/config/package.json` (exports = configs only); `appystack/template/server/src/index.ts`
  (`listen(env.PORT)` no host; commented socket-auth stub at the `io.on('connection')` block).
- flivoice: `flivideo/flivoice/server/src/routes/jump.routes.ts:31,72`; live entrypoint `…/server/src/index.ts:83,244`.
- flihub: `flivideo/flihub/server/src/index.ts:84-85,91,374`; `…/config/configManager.ts:26,28`;
  `…/routes/{assets,projects,thumbs,manage}.ts` (lines per §5.2).
- storyline: `flivideo/storyline-app/server/src/routes/filesystem.routes.ts:299,349,406,445`;
  `…/services/filesystem.service.ts:55`; `…/routes/project.routes.ts:42,79`.
- fligen: `flivideo/fligen/server/src/tools/image/save-to-catalog.ts:22,28`;
  `…/tools/catalog/storage.ts:152-161`; `…/routes/{images,widgets,projects,batch}.ts`; `…/server/src/index.ts:53,86,172`.
- thumbrack: `apps/thumbrack/server/src/routes/{rename,manifest,images}.ts`; `…/server/src/index.ts:44,127`.
- flideck: `flivideo/flideck/server/src/routes/config.ts:43-66`; `…/services/PresentationService.ts:119-123`; `…/server/src/index.ts:139,344`.
- angeleye: `apps/angeleye/server/src/index.ts:42,46,63,197`; `…/config/env.ts:10,29`; `…/services/git-sync.service.ts:11,197-200`.
- deckhand: `apps/deckhand/server/src/routes/deckhand.ts:120,155,196`; `…/services/ecammService.ts:13,96`.
- dss-2026: `apps/digital-stage-summit-2026/server/src/routes/sync.ts:18,131-135,141,185`.
- watchtower: `apps/watchtower/server/src/index.ts:36,118` (health+info only).
- Skill curl pattern (token compat): `~/.claude/skills/flihub/export-command.md:23`.
