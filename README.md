# Skill Flow

Android-first React Native academic demonstration built with Expo Router, Clerk authentication, and a Convex Cloud backend. Expo Go and distributed builds connect directly to the configured cloud services over the internet.

The complete functional audit and ordered implementation checklist are in [docs/SKILLFLOW_SYSTEM_AUDIT_AND_ROADMAP.md](docs/SKILLFLOW_SYSTEM_AUDIT_AND_ROADMAP.md).
Canonical product terms are defined in [CONTEXT.md](CONTEXT.md). Architectural
decisions that explain deliberate thesis-demo tradeoffs live in [docs/adr](docs/adr).
The original product intent is documented in the [SkillFlow thesis](https://docs.google.com/document/d/1BkIxg48JNrwF6ia3ELsmoMulEoKd3bavH0jZbG0cCfA/edit?tab=t.y1d2zvgjuu7c).

## Run

```powershell
npm install
npm start
```

## Convex development

The primary developer workflow uses Mann's `skill-flow` Convex Cloud project. Expo Go connects to the developer deployment over the internet, so a physical phone does not need Docker, a LAN backend URL, or the same Wi-Fi as the development machine.

```sh
npx convex dev
```

Select the `skill-flow` project and its cloud development deployment. The CLI writes `CONVEX_DEPLOYMENT` to ignored `.env.local`; set `EXPO_PUBLIC_RUNTIME_TARGET=cloud-development` and use the displayed `https://…convex.cloud` URL as `EXPO_PUBLIC_CONVEX_URL`. Production remains a separate deployment and uses the `cloud` target only after an explicitly authorized release.

## Clerk and demonstration data

Authentication uses the Clerk development instance configured by `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Create two ordinary Clerk development users in the app—one Student Designer and one Client—then complete each account's immutable role onboarding.

The cloud-development seed is explicit and resettable. It never creates passwords or fake Clerk identities:

```powershell
npm run seed:preview
npm run seed:candidates
npm run seed:apply -- <student-profile-id> <client-profile-id>
```

`seed:apply` publishes representative services and a project post, marks only the selected demonstration student as simulated-verified, and adds portfolio/certification examples. It is idempotent. `npm run seed:reset` removes only records in the `skillflow-foundation:v1` seed namespace and is hard-disabled unless the target Convex deployment is classified as `cloud-development`.

Production needs a separate Clerk production instance, Convex production deployment, and explicit release authorization. There is no production fallback to local accounts or AsyncStorage data.

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

## Connected-service configuration

Copy `.env.example` to the ignored `.env.local` and use one matching public
runtime target and Convex client URL:

| `EXPO_PUBLIC_RUNTIME_TARGET` | Matching Convex URL |
| --- | --- |
| `cloud-development` | The developer `https://…convex.cloud` deployment URL with a Clerk `pk_test_…` key |
| `cloud` | The production `https://…convex.cloud` deployment URL with a Clerk `pk_live_…` key |

Use `cloud-development` for Expo Go on a physical phone, an emulator, or web during development. The Convex Cloud URL works from any internet-connected network; the phone does not need to share Wi-Fi with the developer machine. Use `cloud` only in an approved client release.

`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` accepts only Clerk publishable keys. Never put a
Convex admin key, Clerk secret key, or deploy key in an `EXPO_PUBLIC_*`
variable: Expo bundles those variables into the application.

The runtime guard allows only those three application keys plus Expo Router's
exact framework-owned `EXPO_PUBLIC_PROJECT_ROOT` key. Other `EXPO_PUBLIC_*`
names fail closed without copying their names or values into the client bundle.

Application integrations read these values through `src/config/runtime.ts`.
The root mounts Clerk and a single `ConvexProviderWithClerk`; missing or
mismatched values fail closed with setup guidance. Authenticated domain data is
stored in Convex, and the app removes obsolete local demo-store keys after a
cloud profile is established.

Quality checks:

```powershell
npm run verify
npm run doctor
```

`npm run verify` is the moderately strict automated gate. It runs strict
TypeScript, ESLint with cyclomatic complexity errors above 10, the complete
Jest suite, Convex authorization tests, and an Android Expo export. Inherited complexity debt is recorded
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
