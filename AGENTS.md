# SkillFlow Repository Instructions

These instructions apply to every agent working in this repository.

## Repository boundary

- Treat the repository root as the workspace boundary. Do not use machine-specific absolute paths.
- Do not inspect, search, read, or modify parent folders, sibling projects, or unrelated repositories.
- Treat `src/` as the active Expo and React Native application.
- Use `README.md` for setup and run commands, `CONTEXT.md` for canonical product language, and `docs/adr/` for durable architectural decisions.
- Use the [SkillFlow thesis](https://docs.google.com/document/d/1BkIxg48JNrwF6ia3ELsmoMulEoKd3bavH0jZbG0cCfA/edit?tab=t.y1d2zvgjuu7c) as the source of product intent. Use `references/skillflow.pdf` and the images in `references/` as supplied visual/product references.
- Use `docs/SKILLFLOW_SYSTEM_AUDIT_AND_ROADMAP.md` as historical implementation context, not as proof that the current app still works. Resolve contradictions in favor of explicitly approved repository decisions and current verified behavior, and surface material thesis mismatches to the user.
- Preserve unrelated user changes. Do not commit, push, open or merge pull requests, or rewrite Git history unless explicitly asked.

## Product constraints

- SkillFlow is an Android-first Expo and React Native academic demonstration.
- Keep it dependable for demonstrations and preserve deterministic local seed/reset behavior while the approved Convex migration is incomplete.
- Preserve the Student Designer and Client roles.
- Convex is the approved application backend. Use the Dockerized self-hosted deployment for local development and Mann's PM-owned Convex Cloud project for production.
- Clerk is the approved authentication provider, but integration is blocked until Mann supplies the Clerk project configuration. Never invent keys or silently retain fake authentication in a production path.
- Keep local and production data, URLs, admin keys, and deploy keys strictly separated. Never deploy to production or use a production credential without explicit authorization.
- Never add real payment processing or collect payment credentials. Clearly label simulated balances, payment holds and releases, verification, and deterministic AI feedback as simulations.

## Evidence-driven improvement loop

Run the continuous improvement pipeline only when the user explicitly invokes it. Follow `docs/IMPROVEMENT_LOOP.md` as the complete protocol. That invocation authorizes evidence-backed issue creation and agent-owned issue branches and PRs inside this repository; it never authorizes merging. It also does not authorize production, credentials, destructive/shared-data changes, protected scope, subjective product decisions, or modifying human-authored PRs.

- Keep the repository root clean and orchestration-only. Every scout baseline and issue lane uses a dedicated worktree from the latest `origin/main`.
- Use distinct roles: scouts dogfood both roles and file deduplicated evidence; one builder owns each issue lane; a different QA agent reviews the exact head and reruns the full gate plus real UI/screenshots; a release agent opens or updates a high-quality ready PR for humans.
- Builders cannot QA or release their own work. QA never implements. Release never edits code or merges and must refuse stale/missing evidence, failures, conflicts, protected scope, ambiguous ownership, or human-authored PRs.
- Treat the thesis and supplied screenshots as product references. Source inspection supports evidence but never replaces human-style interaction with the real app, screenshots, and runtime-error checks.
- Prioritize the foundational local Dockerized Convex work. Mann owns Convex Cloud and Clerk provisioning. Until Clerk is ready, keep AsyncStorage authoritative for the live UI; backend work may add the approved domain schema, indexes, deterministic lifecycle seeds, and an isolated development-only reset. Scout the UI, but while that backend foundation is in progress implement only Critical or High journey defects.
- Allow agents to split an oversized issue into small, verifiable, dependency-linked child issues before building. Use all available safe isolated agent/resource capacity for independent issue lanes, with one issue and worktree each, only when dependencies, files, behavior, schemas/APIs, fixtures, and acceptance criteria do not overlap.
- Agents continue with independent issues without waiting for merges. After a human merges, refresh `origin/main`; agents may update their own clean, independent queued lanes after base changes, but conflicts or ambiguous rebase decisions return to humans. Any changed head requires fresh QA.
- Pause a lane only for overlap, dependencies, stale conflicts, failed verification, unsafe resources, or protected PM-owned work.

## Verification

For implementation work, run the relevant automated tests plus:

```powershell
npm run verify
npm run doctor
```

`npm run verify` is the automated gate: strict TypeScript, ESLint (including
cyclomatic complexity capped at 10), the complete Jest suite, and an Android
Expo export. Existing complexity debt is recorded in
`eslint-suppressions.json` with a matching committed ceiling. Lint compares
both files against the exact fetched `origin/main`, so paired additions or
increases fail and stale feature branches must rebase. Before verification,
fetch the base branch. CI must set `ESLINT_SUPPRESSIONS_BASE_SHA` to the event's
full base commit SHA; it may set `ESLINT_SUPPRESSIONS_BASE_REF` when the fetched
ref is not `origin/main`. Missing, mismatched, malformed, or incomplete base
state fails closed, including shallow checkouts that did not fetch the base.
After removing a violation, run `npm run lint:prune` and commit both reduced
suppression files. The check is independent of squash-versus-merge strategy.

The Android Expo export only proves that the JavaScript bundle and assets can
be produced. It does not install the app, exercise native behavior, or prove
that a user can complete a flow. Every user-visible change still requires a
manual Android emulator/device walkthrough and screenshots of affected
states when Android is available; use web as additional coverage or a
disclosed fallback when it is not.
