# SkillFlow agent-ready backlog

These are issue-ready work units created from the PM direction, repository audit, supplied screenshots, and manual web walkthrough. Each ticket is intended for one branch and one focused PR. Before starting, confirm its dependencies are merged and copy the ticket into the issue tracker. Clerk- and production-dependent tickets remain blocked until Mann completes the named administrator step.

Published in `MannLester/Skill-Flow` as GitHub issues #1–#29 and #31. SF-100 and SF-101 are #27 and #28; the remaining original tickets follow their table order as #1–#26. SF-305 is issue #29, and SF-306 is issue #31.

Common verification for implementation tickets:

```sh
npm run verify
npm run doctor # dependency, Expo config, or native changes
```

User-visible tickets also require an Android walkthrough and screenshots when a device/emulator is available; web is a disclosed fallback. Convex tickets add local health, code generation/type checks, and focused integration tests. Passing verification does not replace separate PR review.

## Status and dependency map

| ID | Title | Depends on | Status |
| --- | --- | --- | --- |
| SF-100 | Adopt the Convex/Clerk environment contract | — | Issue #27; implementation in progress |
| SF-101 | Add Dockerized local Convex | SF-100 | Issue #28; blocked on SF-100 merge |
| SF-102 | Add typed runtime configuration | SF-100 | Open |
| SF-103 | Add Convex schema and deterministic seeds | SF-101, SF-102 | Open |
| SF-104 | Wire the unauthenticated Convex client | SF-103 | Open |
| SF-105 | Provision Clerk and Convex integration | SF-100 | Blocked on Mann |
| SF-106 | Add Clerk and SecureStore providers | SF-102, SF-105 | Blocked on Mann |
| SF-107 | Authenticate Convex and synchronize profiles | SF-103, SF-106 | Blocked on Mann |
| SF-108 | Replace login and registration with Clerk | SF-107 | Blocked on Mann |
| SF-109 | Replace recovery/logout and remove local credentials | SF-108 | Blocked on Mann |
| SF-110 | Migrate services and marketplace data | SF-104, SF-107 | Open after dependencies |
| SF-111 | Migrate project posts and proposals | SF-104, SF-107 | Open after dependencies |
| SF-112 | Migrate booking lifecycle, ledger, and reviews | SF-110, SF-111 | Open after dependencies |
| SF-113 | Migrate messages and notifications | SF-112 | Open after dependencies |
| SF-114 | Migrate portfolio, verification, and readiness | SF-107 | Open after dependencies |
| SF-115 | Migrate mentor history and preferences | SF-107 | Open after dependencies |
| SF-116 | Add protected Convex Cloud deployment | SF-103, SF-107 | Blocked on Mann |
| SF-201 | Replace placeholder branding assets | — | Open |
| SF-202 | Implement the branded launch experience | SF-201 | Open |
| SF-203 | Align login with the canonical screenshot | SF-201, SF-108 | Open after dependencies |
| SF-204 | Select and align the registration design | SF-201, SF-108 | Needs product decision |
| SF-205 | Add a populated showcase seed | SF-103 | Open after dependency |
| SF-206 | Polish Student Home | SF-201, SF-205 | Open after dependencies |
| SF-207 | Polish Mentor, Notifications, and Settings | SF-201, SF-205 | Open after dependencies |
| SF-301 | Add Convex authorization and lifecycle tests | SF-112, SF-113 | Open after dependencies |
| SF-302 | Add the two-role interactive smoke matrix | SF-113, SF-114, SF-115 | Open after dependencies |
| SF-303 | Fix web route-transition focus warnings | — | Open |
| SF-304 | Add a SPA-aware static web preview | — | Open |
| SF-305 | Add the evidence-driven improvement loop | — | Merged via PR #30 |
| SF-306 | Establish the moderately strict verification gate | SF-100, SF-101 | Issue #31; implementation in progress |

## Platform foundation

### SF-100 — Adopt the Convex/Clerk environment contract

Outcome: make local, development, and production ownership unambiguous.

Scope:

- Record Dockerized self-hosted Convex for local development.
- Record Mann-owned Convex Cloud and Clerk instances for production.
- Preserve simulated payment, verification, earnings, and AI behavior.
- Define credentials and production deployment as administrator-only actions.

Acceptance:

- The ADR and repository instructions agree.
- Production never silently falls back to fake/local authentication.
- Local and production data and credentials are explicitly separate.

### SF-101 — Add Dockerized local Convex

Outcome: a new developer can start persistent local Convex without an account.

Scope:

- Use matching, digest-pinned official backend and dashboard images.
- Persist `/convex/data` in a named volume.
- Add health-gated startup, status, logs, stop, and bootstrap commands.
- Generate the admin key into ignored `.env.local` without printing it.

Acceptance:

- Backend, HTTP actions, and dashboard listen on 3210, 3211, and 6791.
- `npm run convex:bootstrap` waits for health and writes mode-0600 local configuration.
- `npm run convex:health` passes.
- No reset command deletes the volume without explicit approval.

### SF-102 — Add typed runtime configuration

Outcome: missing or mismatched environment values fail with an actionable setup state.

Scope:

- Centralize access to `EXPO_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- Distinguish web, Android emulator, physical-device, and cloud values.
- Add tests for missing/malformed configuration.

Acceptance:

- Application modules do not read `process.env` independently.
- No privileged key is reachable through `EXPO_PUBLIC_*`.
- Missing configuration shows setup guidance rather than a generic error screen.

### SF-103 — Add Convex schema and deterministic seeds

Outcome: define the typed server-side model before UI migration.

Scope:

- Add tables and indexes for profiles, services, project posts, proposals, bookings, messages, notifications, ledger entries, reviews, portfolios, certifications, mentor messages, and preferences.
- Add idempotent development seed/reset functions.
- Keep all simulated records visibly identifiable.

Acceptance:

- Every record has stable ownership fields and relevant indexes.
- Re-running seed produces no duplicates.
- Reset is restricted to development and requires an explicit invocation.
- Convex code generation and TypeScript pass.

### SF-104 — Wire the unauthenticated Convex client

Outcome: prove the Expo client can reach Dockerized Convex before adding auth.

Scope:

- Mount `ConvexProvider` with one `ConvexReactClient`.
- Add a harmless health/version query and intentional loading/offline state.
- Keep SessionContext authoritative for application records in this ticket.

Acceptance:

- Web and Android can render the health query from local Docker.
- A stopped backend produces a recoverable state, not an error screen.
- No domain record is dual-written.

## Clerk and identity

### SF-105 — Provision Clerk and its Convex integration

Owner: Mann. This is an external setup ticket, not an agent credential task.

Scope:

- Create separate Clerk development and production instances.
- Configure the current Native API and Convex integration requirements.
- Register Android package `com.skillflow.prototype` and scheme `skillflow` where required.
- Supply the development publishable key and JWT issuer through the approved secret/config channel.

Acceptance:

- Developers can identify the development instance without seeing a secret key.
- Production values are stored only in the production/CI secret store.
- No value is pasted into source, tickets, or chat.

### SF-106 — Add Clerk and SecureStore providers

Outcome: initialize Clerk safely without changing the visible auth forms yet.

Scope:

- Install the current `@clerk/expo` and `expo-secure-store` versions compatible with the Expo SDK.
- Mount `ClerkProvider` with Clerk's SecureStore token cache.
- Render deliberate loading, configuration-error, signed-out, and signed-in states.

Acceptance:

- Session restoration survives app restart.
- Secret keys are absent from the client bundle.
- Invalid development configuration produces actionable guidance.

### SF-107 — Authenticate Convex and synchronize profiles

Outcome: establish one server-authoritative SkillFlow profile per Clerk identity.

Scope:

- Add `convex/auth.config.ts` using the Clerk issuer and application ID required by current official guidance.
- Replace the root Convex provider with `ConvexProviderWithClerk`.
- Create/update a profile keyed by `identity.subject` and store the Student Designer/Client role there.
- Enforce ownership and role checks in functions.

Acceptance:

- One authenticated query succeeds and an unauthenticated call is rejected.
- Repeated sign-in does not duplicate profiles.
- Client-submitted roles or hidden UI controls cannot bypass server authorization.

### SF-108 — Replace login and registration with Clerk

Outcome: preserve the custom SkillFlow screens while Clerk owns credentials.

Scope:

- Implement Clerk custom sign-in, sign-up, and verification flows.
- Persist the selected role through the server-authoritative profile onboarding.
- Restrict demo shortcuts to an explicit development-only mode or remove them.

Acceptance:

- Invalid credentials and verification requirements display inline.
- Student and Client accounts route correctly after restart.
- No production build contains a seeded-password bypass.

### SF-109 — Replace recovery/logout and remove local credentials

Outcome: remove plaintext local credential handling after Clerk parity exists.

Scope:

- Replace simulated recovery and password changes with supported Clerk flows.
- Ensure sign-out clears Clerk/Convex session state.
- Remove plaintext passwords and persisted current-account IDs from AsyncStorage and seed fixtures.

Acceptance:

- Recovery, password change, sign-out, expiry, and invalid-session recovery work.
- AsyncStorage contains only non-sensitive local preferences/cache.
- Search and tests confirm no demo password remains in production code paths.

## Domain migrations

### SF-110 — Migrate services and marketplace data

Move profiles needed for listings, services, saved services, filters, and create/edit/archive operations to Convex. Keep IDs dynamic and enforce that only the owning Student Designer can mutate a listing. Verify realtime persistence across two clients. Do not include projects or messages.

### SF-111 — Migrate project posts and proposals

Move open project posts, discovery, proposals, and proposal decisions to Convex. Enforce role, ownership, uniqueness, and valid proposal-state transitions server-side. Do not implement the booking lifecycle in this ticket.

### SF-112 — Migrate booking lifecycle, ledger, and reviews

Move direct requests and accepted proposals into the shared server-side lifecycle. Reject illegal or unauthorized transitions. Keep holds, releases, earnings, and reviews simulated and derived from records. Verify both acquisition funnels through completion.

### SF-113 — Migrate messages and notifications

Move project threads, messages, notifications, unread state, and deep links to Convex. Generate events for the correct recipient and update badges reactively. Enforce project-participant access to threads.

### SF-114 — Migrate portfolio, verification, and readiness

Move portfolio items, certifications, simulated verification, public-profile-safe fields, and Career Readiness inputs to Convex. Compute the score from server records and preserve the documented 100-point breakdown.

### SF-115 — Migrate mentor history and preferences

Move deterministic mentor conversations and user preferences to Convex. Retain the visible simulation disclosure and make no external AI call. Define which device-only theme/cache values, if any, remain local.

### SF-116 — Add protected Convex Cloud deployment

Owner dependency: Mann provisions the Convex team/project and production deploy key.

Scope:

- Add a protected, merge-gated production workflow using CI secrets.
- Run schema/codegen/type checks and a deploy dry-run before deployment.
- Prevent local helper commands from resolving to production.

Acceptance:

- Agents and pull requests cannot read or print the production key.
- Deployment targets Mann's project only after explicit approval.
- Local Docker and Cloud use the same reviewed functions/schema, but separate data and environment values.

## Screenshot-aligned UI

### SF-201 — Replace placeholder branding assets

Replace the default Expo icon and screenshot-cropped `AppLogo` with approved source assets for the app icon, adaptive foreground/background/monochrome icon, favicon, and scalable in-app logo. Verify sharp rendering at launcher and form sizes. Do not invent a new logo without product approval.

### SF-202 — Implement the branded launch experience

Implement the supplied red native splash plus an in-app loading state for font/auth/backend hydration. Include the approved logo, tagline, decoration, and progress state. Add timeout/retry behavior so backend or auth failure never becomes a blank/error screen.

### SF-203 — Align login with the canonical screenshot

Polish the background curves/dots, logo, fields, role cards, password visibility, forgot-password link, and primary action. Preserve validation and keyboard scrolling. Keep any development demo access secondary and excluded from production builds.

### SF-204 — Select and align the registration design

Product decision required: the supplied screenshots conflict because one includes the full logo/tagline and one begins with the role selector. Record the canonical choice, then align spacing, decoration, fields, role toggle, password visibility, legal links, and keyboard behavior without weakening Clerk validation.

### SF-205 — Add a populated showcase seed

Create an idempotent development seed that produces representative earnings, recent work, recommendations, notifications, and both roles' lifecycle state. Keep lifecycle tests isolated from showcase data and derive every displayed value from seeded records.

### SF-206 — Polish Student Home

Align hero curves, avatar, earnings card/chart, quick actions, project cards, spacing, typography, and bottom navigation with the supplied reference. Preserve live values and the added Career Readiness feature. Exercise every card/action and both empty and populated states.

### SF-207 — Polish Mentor, Notifications, and Settings

Align the three supplied screens while retaining current functionality and simulation language. Mentor submission must show a deterministic response; notifications must cover populated/filter/unread/deep-link states; Settings must retain truthful “Demo Wallet” wording and working controls.

## Reliability and verification

### SF-301 — Add Convex authorization and lifecycle tests

Run focused tests against local Docker for unauthenticated access, cross-user access, role restrictions, both acquisition funnels, illegal transitions, notifications, ledger derivation, and reviews. Tests must create isolated data and must not depend on showcase seeds.

### SF-302 — Add the two-role interactive smoke matrix

Document and execute Student and Client sign-in, marketplace/service management, booking, project posting/proposals, lifecycle, messaging, notifications, mentor, settings, logout, restart, and account switching. Record screenshots and runtime observations for affected screens; Android is mandatory when available.

### SF-303 — Fix web route-transition focus warnings

Reproduce the `aria-hidden` focused-descendant warning during login/registration/settings navigation. Correct focus transfer or hidden-screen behavior without disabling accessibility checks. The relevant web flow must finish with a clean console and unchanged Android navigation.

### SF-304 — Add a SPA-aware static web preview

Add a documented preview command or rewrite configuration that serves exported Expo Router paths such as `/notifications` directly. Verify a clean browser load on representative nested routes. Do not treat a basic static server's missing rewrites as an application-screen failure.

### SF-306 — Establish the moderately strict verification gate

Add one `npm run verify` command covering strict TypeScript, ESLint, the complete Jest suite, and an Android Expo export. Enforce cyclomatic complexity at 10, record inherited violations without allowing new debt, and add an Expo Doctor command. Document that user-visible work still requires Android interaction and screenshots because a successful export does not prove runtime usability.
