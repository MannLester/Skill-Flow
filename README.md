# Skill Flow

Android-first React Native recreation of the supplied Skill Flow mobile mockups. The app uses Expo Router, TypeScript, Poppins, versioned local demo data, and responsive portrait layouts.

The complete functional audit and ordered implementation checklist are in [docs/SKILLFLOW_SYSTEM_AUDIT_AND_ROADMAP.md](docs/SKILLFLOW_SYSTEM_AUDIT_AND_ROADMAP.md).
Canonical product terms are defined in [CONTEXT.md](CONTEXT.md). Architectural
decisions that explain deliberate thesis-demo tradeoffs live in [docs/adr](docs/adr).
The original product intent is documented in the [SkillFlow thesis](https://docs.google.com/document/d/1BkIxg48JNrwF6ia3ELsmoMulEoKd3bavH0jZbG0cCfA/edit?tab=t.y1d2zvgjuu7c).

## Run

```powershell
npm install
npm start
```

## Local Convex

Local development uses the official self-hosted Convex backend and dashboard in Docker. Production will remain a separate PM-owned Convex Cloud deployment.

```sh
npm run convex:bootstrap
npm run convex:dev
```

`convex:bootstrap` starts the pinned backend and dashboard images, waits for a healthy backend, generates a local admin key, and saves it to the ignored `.env.local` file with mode `0600` without printing it. Later starts can use `npm run convex:up`. The dashboard is available at `http://127.0.0.1:6791`.

`convex:dev` is deliberately local-only. Its wrapper reads and validates `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`, rejects cloud deployment fields and target-overriding flags, disables CLI telemetry and external version checks, then runs the pinned local Convex CLI with that ignored environment file. Run `convex:bootstrap` first.

Useful commands:

```sh
npm run convex:status
npm run convex:health
npm run convex:logs
npm run convex:down
```

All commands accept the same optional port variables: `CONVEX_PORT`, `CONVEX_SITE_PROXY_PORT`, and `CONVEX_DASHBOARD_PORT`. Bootstrap writes matching URLs, and `convex:health` checks the selected backend port.

### Isolated improvement-loop resources

The ordinary commands use the developer-owned Compose project `skillflow-convex`. An improvement-loop run must export a unique run ID and, when the developer ports are occupied, unique ports before every Convex command:

```sh
export SKILLFLOW_LOOP_RUN_ID=20260825-a
export CONVEX_PORT=3320
export CONVEX_SITE_PROXY_PORT=3321
export CONVEX_DASHBOARD_PORT=6891
npm run convex:bootstrap
npm run convex:health
npm run convex:status
```

This creates the Compose project `skillflow-loop-20260825-a`, adds project and owner labels to its containers and volume, and writes its credentials to the ignored `.convex/skillflow-loop-20260825-a.env` instead of the developer's `.env.local`. Keep the same variables exported for `convex:dev`, `up`, `down`, `status`, `logs`, and `health` so every command targets the same owned resources. `SKILLFLOW_CONVEX_PROJECT` may select an explicit project name when no loop run ID is used. Never use `docker compose down -v`; volume deletion requires explicit approval after ownership is verified.

The default public URL works for web on the development machine. Android needs a host-reachable URL:

- Android emulator: `EXPO_PUBLIC_CONVEX_URL=http://10.0.2.2:3210`
- Physical device: use the development machine's LAN address. Explicitly set `CONVEX_BIND_ADDRESS=0.0.0.0`, `CONVEX_CLOUD_ORIGIN=http://<LAN-IP>:3210`, and `CONVEX_SITE_ORIGIN=http://<LAN-IP>:3211` in the shell that starts Docker, then set `EXPO_PUBLIC_CONVEX_URL=http://<LAN-IP>:3210`. This exposes the development backend to the local network, so return to the loopback defaults afterward.

Do not commit `.env.local` or `.convex/`. `CONVEX_SELF_HOSTED_ADMIN_KEY` is privileged and must never use the `EXPO_PUBLIC_` prefix. Removing a `<compose-project>_convex-data` Docker volume permanently deletes that project's local Convex data and requires explicit approval.

### Updating the pinned images

Backend and dashboard images must stay on matching official Convex releases and immutable `sha256` digests. To update them:

1. Select one official self-hosted Convex release and its matching backend and dashboard tags.
2. Pull both tagged images, inspect their `RepoDigests`, and replace both digest references in `infra/convex/compose.yml` in the same change. Never commit a mutable tag.
3. Run `docker compose -f infra/convex/compose.yml config --quiet` and `config --images` to confirm the resolved references.
4. Bootstrap a new loop-owned project with unused ports, then run `npm run convex:health`, `npm run convex:status`, and `npm run convex:dev -- --once`. Confirm both resources carry the expected Compose project and SkillFlow ownership labels.
5. Run the repository verification gate. Preserve the test volume unless its exact ownership is proven and deletion is separately approved.

Clerk is not configured yet. Mann must provision the Clerk development and production applications before the Clerk integration tickets can proceed; see [the agent-ready backlog](docs/tickets/BACKLOG.md).

## Seeded demo accounts

- Student Designer: `alex@skillflow.demo` / `demo123`
- Client: `mark@skillflow.demo` / `demo123`

The login screen also provides one-tap Alex and Mark buttons. Logging out and switching accounts preserves their shared local project state. Use only demonstration data.

The project targets Expo SDK 54 for compatibility with the Play Store version
of Expo Go. For a remote client demo or manual verification, start a public
tunnel and share the newly printed Expo Go URL or QR code while the command
remains running. This command clears Metro's cache before publishing so the
session bundles the current source changes:

```powershell
npm run start:client
```

Use `npm run android` only when building and installing the native Android
development app locally.

### Static web preview

Use the development server for normal web work:

```sh
npm run web
```

To verify the production-style static export, build it first and then serve that
existing output with SkillFlow's Expo Router-aware preview:

```sh
npm run web:export
npm run web:preview
```

The preview defaults to `http://127.0.0.1:4173`. Direct links such as
`/notifications`, `/messages`, and `/projects/<project-id>` resolve to their
generated HTML without changing the browser URL. Invalid app routes and missing
assets remain genuine HTTP 404 responses; this is local verification tooling,
not production hosting or deployment.

Set `SKILLFLOW_WEB_PREVIEW_HOST`, `SKILLFLOW_WEB_PREVIEW_PORT`, or
`SKILLFLOW_WEB_PREVIEW_DIR` to override the loopback host, port, or export
directory. Non-loopback hosts expose the preview to the local network and print
a warning. Press Ctrl+C to stop only the preview process. `npm run web:verify`
creates a fresh export and runs a bounded HTTP smoke check.

Quality checks:

```powershell
npm run verify
npm run doctor
```

`npm run verify` is the moderately strict automated gate. It runs strict
TypeScript, ESLint with cyclomatic complexity errors above 10, the complete
Jest suite, and an Android Expo export. Inherited complexity debt is recorded
in `eslint-suppressions.json`, a matching committed ceiling, and the
function-level `eslint-complexity-baseline.json`. Stable identity uses file,
name, node type, complexity, and source hash; line and column are refreshable
diagnostic metadata. Lint compares these artifacts
against the exact fetched `origin/main`, so a complex function cannot be
replaced, moved across files, renamed, or added while hiding behind an unchanged per-file
count. Paired additions or increases fail, and stale feature branches must
rebase. Run `git fetch origin main` before local verification. CI must fetch the base and set
`ESLINT_SUPPRESSIONS_BASE_SHA` to the event's full base commit SHA; set
`ESLINT_SUPPRESSIONS_BASE_REF` too if the fetched ref is not `origin/main`.
Missing, mismatched, malformed, or incomplete base state fails closed. When a
base is still artifact-free during initial adoption, it must descend from the
pinned bootstrap commit and the synchronized pair must match the pinned
bootstrap digest. After fixing a violation, run `npm run lint:prune` and commit
all reduced complexity baseline files. Both squash merges and merge commits are
supported.

The complexity rule is pinned to error level with maximum 10. Pruning validates
policy and exact-base trust before mutation, stages native ESLint pruning in a
temporary file, and restores all three baseline artifacts byte-for-byte if a
later step fails. New inline complexity disable
directives fail the gate. Only an exact inherited, identity-bound inline
exception could remain; the current baseline contains none.

The lint gate independently inventories active `.js`, `.jsx`, `.cjs`, `.mjs`,
`.ts`, `.tsx`, `.cts`, and `.mts` files under `src/`, `__tests__/`, `scripts/`,
an optional `convex/`, and the repository root. Broad or exact ignore rules
cannot hide those files. Root-level symlinks and symlinks inside active-code
directories are rejected, including extensionless and directory symlinks, so
imported code cannot redirect into an ignored path. Generated output, supplied
visual references, dependencies, and isolated agent worktrees remain excluded.

The Android Expo export checks that the JavaScript bundle and assets can be
produced. It does not install the app or prove native runtime behavior. Every
user-visible change still needs a manual Android emulator/device walkthrough
and screenshots of the affected states when Android is available. Web is
additional coverage or a disclosed fallback when Android is unavailable.

### Exact-commit physical Android evidence

Use the repository runner when a PR needs proof from one specifically
authorized physical Android device. It requires Node 22.x, JDK 17, a configured
`ANDROID_HOME` or `ANDROID_SDK_ROOT`, and that SDK's `adb` and
`apkanalyzer`. Start from a clean checkout whose generated `android/`
directory is absent:

```sh
export SKILLFLOW_ANDROID_SERIAL='<exact-adb-serial>'
export SKILLFLOW_ANDROID_EXPECTED_SHA="$(git rev-parse HEAD)"
export SKILLFLOW_ANDROID_METRO_PORT='8099'
npm run verify:android-device
```

The serial is an authorization boundary, so use the exact value from
`adb devices -l`; a model name is never accepted. Do not paste a real serial
into GitHub. The runner fails closed for a dirty/wrong checkout, an occupied
host port, an existing reverse mapping, a pre-existing native tree, an
ambiguous APK, or a package/version/runtime mismatch. It never uninstalls or
clears app data.

Child Expo, Gradle, and Metro processes receive only a fixed toolchain/OS
environment allowlist; account/production variables are not forwarded, and
Expo dotenv/client-variable loading is disabled for this verification run.

The command generates a fresh native project, marks the debug APK with the full
Git SHA, analyzes and hashes that exact APK, installs it with `adb -s`, starts
one owned Metro process, requires both its directly captured readiness
announcement and Metro's exact project-root-bound `/status` response, atomically claims the
reverse with `--no-rebind`, launches the resolved SkillFlow activity, checks
foreground/runtime logs, and saves a screenshot. The final redacted manifest,
APK, bounded logs, and PNG remain in the unique
`skillflow-android-<sha>-*` directory printed under the system temporary
directory. The generated `android/`, owned reverse, and owned Metro process
group are removed on completion or failure. A stale listener or reverse from a
hard-killed prior run is reported for manual ownership review; `SIGKILL`
cannot execute cleanup handlers.

An Android `pm path` readback does not prove an installed-file hash because the
platform may transform stored artifacts. Provenance instead comes from the
clean exact-SHA checkout, analyzed full-SHA version marker, SHA-256 of the
preserved built APK, successful install from that exact path, and matching
post-install package/version/update-time readback.

After the automated runner reaches PASS, manually exercise the issue's required
Alex and Mark journeys on that still-installed exact-SHA build and capture any
additional route/state screenshots. Android export remains a build check and
does not replace this device interaction.

## Implemented screens

- Login and registration
- Student and client dashboards
- Marketplace
- Service details and service booking
- Shared project list and role-specific project lifecycle
- Project messaging
- Student and client profiles
- Simulated student verification and public verified badges
- Student portfolios and certifications
- Student service creation, drafts, publishing, editing, and archiving
- Client project posts, student discovery and verification-gated proposals
- Client proposal comparison and accepted-proposal booking conversion
- Computed Career Readiness Score with a transparent 100-point breakdown
- Advanced marketplace filters and saved-service views
- Persisted deterministic AI Mentor conversations labeled as simulated
- Demo wallet, password change, preferences, Help, Terms, and Privacy utilities
- AI Project Mentor
- Notifications
- Settings

Marketplace items now open ID-based service details and privacy-safe public student profiles. Saved services, demo accounts, profiles, verification, portfolios, certifications, managed services, project posts, proposals, project requests, messages, notifications, simulated ledger entries, and reviews use persistent local state. A client can either request a student service or accept a proposal on an open project; both routes enter the same simulated funding, work, delivery, revision, approval, release, review, and portfolio lifecycle. Student Career Readiness is calculated live from those persisted records rather than stored as an editable score.

The remaining demonstration utilities are local-only. Marketplace filters cover budget, rating, delivery, category, search, and saved status. AI Mentor responses use deterministic topic rules without an external AI service. Demo Wallet displays only the simulated hold/release ledger and never accepts payment credentials.

Login role selection routes to the corresponding dashboard. Browse/Find Designers opens the marketplace, a service opens its details and booking form, bells open Notifications, and dashboard menus open Settings.

## Scrolling map

- Login: overflow-only scroll for short screens or an open keyboard
- Register and Book Service: keyboard-aware vertical scrolling
- Student Home, Client Home, Service Details, and Settings: vertical scrolling with fixed navigation/header areas where shown
- Marketplace: vertical service list plus horizontal category chips
- AI Mentor: scrolling content with a fixed composer
- Notifications: vertical list with fixed filters and bottom navigation
- Messages: project thread list plus conversation composer
- Projects: role-filtered list and lifecycle actions based on account and status

## Remaining roadmap

The supplied references do not define Forgot Password, full project management, Portfolio, Messages, Saved, Profile/Edit Profile, Post Project, advanced designer filters, simulated payment confirmation, account subpages, support/legal pages, or a full AI conversation. These items are specified and prioritized in the system audit rather than being invented independently in each screen.
