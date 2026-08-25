# SkillFlow System Audit and Improvement Roadmap

> Historical baseline: this roadmap records the completed local-demo phase. The approved Convex/Clerk migration and current open work are tracked in [docs/tickets/BACKLOG.md](tickets/BACKLOG.md). ADR 0002 supersedes the statements below that no backend is required.

## Purpose

This document records the current functional gaps in SkillFlow and provides an ordered backlog for turning the existing visual prototype into a stateful, end-to-end academic demonstration. Work must remain inside the SkillFlow repository.

The source PDF is located at `references/skillflow.pdf`. The repository does not currently contain a `resources/` directory.

## Agreed demonstration scope

- Android-first Expo/React Native application.
- Seeded Student Designer (Alex) and Client (Mark) accounts with a shared local data store.
- Account switching through logout/login while preserving shared project state.
- Simulated student verification, AI feedback, payment hold, and payment release.
- No real payment processor, card entry, bank integration, live transfer, or escrow.
- No backend is required for the demonstration; versioned local persistence is sufficient.
- Both acquisition paths are required and will be delivered in stages:
  1. Client books an existing student service.
  2. Client posts a project and a student submits a proposal.
- Both paths converge on the same project lifecycle.
- Product language is standardized on **SkillFlow**. References to “SkillHub” in the PDF are treated as document inconsistencies.

## Current-state baseline

The repository currently has ten application screens: login, registration, student home, client home, marketplace, service details, booking, AI Mentor, notifications, and settings.

The application is a visual prototype backed by hardcoded fixtures. Only the selected role is kept in memory. There is no authentication, persistent application state, shared project record, backend, data API, file upload, or lifecycle engine. The README explicitly states that the unimplemented controls were intentionally left inactive because their reference designs were not supplied.

At the time of this audit:

- TypeScript passes.
- ESLint passes.
- All 5 Jest tests pass.
- All 18 Expo Doctor checks pass.
- Marketplace category and title search filters work.
- Notification tabs work.
- Login role selection routes to a role dashboard.
- Service booking ends with an alert and does not create a record.
- AI Mentor send clears the input without producing a response.
- Earnings, projects, ratings, favorites, badges, and notifications are static and unrelated.
- Every marketplace item opens the same hardcoded Logo Design screen.

## Requirement mismatches found in the PDF

- The document alternates between “SkillFlow” and “SkillHub.” Use SkillFlow everywhere in the application.
- The introduction promises a Career Readiness Score, but the later formal scope and supplied screens do not define it. It is included in this roadmap as an agreed demo feature.
- The PDF describes verified student identities, but the current registration flow collects no school or verification information.
- The PDF describes project booking management, secure messaging, reviews, portfolios, and AI-assisted feedback; none currently has an end-to-end implementation.

## Existing control audit

| Screen | Control | Current behavior | Required destination or behavior |
| --- | --- | --- | --- |
| Login | Forgot Password | Disabled | Open `/forgot-password` and show a simulated recovery confirmation. |
| Login | Log In | Accepts any values | Validate a seeded/local account and retain the shared demo state. |
| Register | Sign Up | Ignores validation and terms | Validate fields, matching passwords, role, and accepted terms. |
| Register | Terms / Privacy text | Toggles the checkbox | Open `/terms` or `/privacy-policy`. |
| Student Home | Browse Projects | Opens service marketplace | Open `/projects/discover` with client project posts. |
| Student Home | My Portfolio | Disabled | Open `/portfolio`. |
| Student Home | Messages | Disabled | Open `/messages`. |
| Student Home | Recent project / View All | Not clickable | Open `/projects/[projectId]` or `/projects`. |
| Student Home | Recommended project / View All | Not clickable | Open a project detail or `/projects/discover`. |
| Client Home | Active/Recent projects | Not clickable | Open `/projects` or `/projects/[projectId]`. |
| Client Home | Post a Project | Disabled | Open `/projects/new`. |
| Client Home | My Portfolio | Disabled and role-inappropriate | Rename to “My Projects” and open `/projects`. |
| Client Home | Messages | Disabled | Open `/messages`. |
| Marketplace | Header menu | Decorative icon | Open `/settings`. |
| Marketplace | Filter | Disabled | Open a local filter sheet for category, budget, rating, delivery time, and saved status. |
| Marketplace | Service row | Always opens Logo Design | Open `/services/[serviceId]` with the selected ID. |
| Marketplace | Heart | Part of the service-row tap target | Toggle the selected service in saved items without navigating. |
| Marketplace | Center plus | Disabled | Student: `/services/new`; Client: `/projects/new`. |
| Service Details | Provider identity | Not clickable | Open `/profiles/[userId]`. |
| Service Details | Heart | Decorative icon | Toggle saved status. |
| Service Details | Overflow | Decorative icon | Open a share/report action sheet. |
| Service Details | Request This Service | Opens hardcoded booking | Open `/services/[serviceId]/request`. |
| Booking | Character counter | Always `0/500` | Reflect the description length. |
| Booking | Delivery / Budget | Decorative rows | Open local selection controls. |
| Booking | Send Request | Alert only | Create a project booking and open `/projects/[projectId]`. |
| AI Mentor | Suggestions | Only fill input | Submit or stage a supported mentor prompt. |
| AI Mentor | Send | Clears input | Append a user message and deterministic mentor response. |
| Notifications | Notification rows | Not clickable | Mark read and deep-link to the related project, conversation, or demo-wallet entry. |
| Settings | Edit Profile | Disabled | Open `/profile/edit`. |
| Settings | Change Password | Disabled | Open `/settings/change-password`. |
| Settings | Payment Methods | Disabled and misleading | Rename to “Demo Wallet” and open `/demo-wallet`. |
| Settings | Notifications / Language | Disabled | Open local preference controls. |
| Settings | Dark Mode | Disabled | Toggle and persist the theme locally. |
| Settings | Help / Terms / Privacy | Disabled | Open `/help`, `/terms`, or `/privacy-policy`. |
| Bottom navigation | Projects / Portfolio / Messages / Saved | Disabled | Open their role-appropriate destinations. |
| Bottom navigation | Profile | Opens Settings | Open `/profile`; keep Settings behind the menu. |

## Required closed-loop behavior

### Direct service booking

1. Mark logs in as Client and opens Alex's service.
2. Mark submits a project description, delivery selection, and budget.
3. SkillFlow creates a requested project booking and notifies Alex.
4. Mark logs out; Alex logs in and sees the same request.
5. Alex accepts or declines it.
6. After acceptance, Mark reserves simulated funds.
7. Alex starts the work, communicates in the project thread, and submits a delivery.
8. Mark requests a revision or approves the delivery.
9. Approval releases simulated demo earnings to Alex.
10. Mark leaves a rating and review.
11. Dashboards, notifications, portfolio eligibility, earnings, and Career Readiness Score update from the completed record.

### Open project and proposal

1. Mark posts an open project.
2. Alex discovers the project and submits a proposal.
3. Mark compares proposals and accepts or rejects them.
4. An accepted proposal creates the same project booking used by direct service booking.
5. The remaining messaging, funding, delivery, revision, approval, review, and completion steps are shared.

### Project statuses

`requested → accepted → demo_funded → in_progress → submitted → approved → completed → reviewed`

Alternative transitions:

- `requested → declined`
- `requested/accepted → cancelled` before demo funding
- `submitted → revision_requested → in_progress`

Disputes, chargebacks, refunds, real escrow, and real financial movement are outside scope.

## Planned local domain model

- `DemoAccount`, `Profile`, `VerificationStatus`
- `PortfolioItem`, `Certification`, `ServiceListing`
- `ProjectPost`, `Proposal`, `ProjectBooking`, `ProjectStatus`
- `Delivery`, `RevisionRequest`
- `MessageThread`, `Message`, `Notification`
- `Review`, `DemoLedgerEntry`, `CareerReadinessBreakdown`

Every record must use stable IDs and role ownership. A project booking must record whether it originated from a direct service request or an accepted proposal.

## Career Readiness Score

Use a transparent local score capped at 100 points:

- Profile completeness: 15
- Simulated student verification: 15
- Portfolio items: 20
- Completed projects: 25
- Client ratings: 15
- Certifications: 10

The score and breakdown must update from persisted demo data rather than static text.

## Ordered implementation backlog

- [x] **SF-000 — Repository boundary and audit**: Add SkillFlow-only agent instructions and this roadmap.
- [x] **SF-001 — Stateful demo foundation**: Versioned local store, seeded accounts/data, persistence, hydration, and reset.
- [x] **SF-002 — Demo authentication**: Validation, registration, recovery simulation, logout, and account switcher.
- [x] **SF-003 — Dynamic services and booking**: ID-based routes, functional form controls, and persistent requests.
- [x] **SF-004 — Direct-booking closed loop**: Accept/decline, demo funding, work, delivery, revision, approval, release, and review.
- [x] **SF-005 — Messaging and notifications**: Project threads, unread counts, generated events, and deep links.
- [x] **SF-006 — Profiles, verification, portfolios, and service management**.
- [x] **SF-008 — Open projects and proposals**.
- [x] **SF-007 — Career Readiness Score and breakdown**.
- [x] **SF-009 — Marketplace filters, saved items, provider profiles, and role-correct marketplace modes**.
- [x] **SF-010 — Deterministic AI Mentor with persisted conversation and clearly labeled simulated feedback**.
- [x] **SF-011 — Demo wallet, preferences, legal/support screens, dark mode, accessibility, and final polish**.

All planned implementation phases are complete: SF-000 through SF-011 provide the repository boundary, audit, persistent state, demo authentication, dynamic services, both acquisition funnels, the shared project lifecycle, messaging, notifications, simulated holds/releases, reviews, profiles, privacy-safe verification, portfolios, certifications, service management, Career Readiness, marketplace discovery, deterministic mentor guidance, and local demonstration utilities. Remaining work should be treated as walkthrough findings or newly agreed enhancements rather than unchecked scope from this roadmap.

## Acceptance and verification

Each backlog item must include unit or component tests for its behavior. The completed demonstration must satisfy all of the following:

- Every visible control either performs its described action or is visibly explained as unavailable; no silent dead buttons remain.
- Dynamic routes show the selected service, project, user, or conversation rather than a hardcoded record.
- Data survives navigation, logout/account switching, and application restart.
- Both acquisition paths can be completed using the seeded accounts on one installation.
- Notifications, unread badges, earnings, reviews, portfolio eligibility, and readiness score derive from lifecycle events.
- No real payment credentials or financial integrations are present.
- Deterministic AI and verification behavior is clearly labeled as simulated.
- TypeScript, ESLint, Jest, Expo Doctor, and an Android/Expo Go walkthrough pass.
