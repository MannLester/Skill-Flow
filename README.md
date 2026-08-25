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

`convex:dev` is deliberately local-only. Its wrapper reads and validates `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`, rejects cloud deployment fields and target-overriding flags, then runs the pinned local Convex CLI with that ignored environment file. Run `convex:bootstrap` first.

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

Quality checks:

```powershell
npm run typecheck
npm run lint
npm test
npx expo-doctor
npx expo export --platform android
```

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
