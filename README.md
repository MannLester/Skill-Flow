# Skill Flow

Android-first React Native recreation of the supplied Skill Flow mobile mockups. The app uses Expo Router, TypeScript, Poppins, versioned local demo data, and responsive portrait layouts.

The complete functional audit and ordered implementation checklist are in [docs/SKILLFLOW_SYSTEM_AUDIT_AND_ROADMAP.md](docs/SKILLFLOW_SYSTEM_AUDIT_AND_ROADMAP.md).

## Run

```powershell
npm install
npm start
```

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
