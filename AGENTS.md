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

Run the autonomous improvement loop only when the user explicitly invokes it. Follow `docs/IMPROVEMENT_LOOP.md` as the complete protocol. That invocation authorizes issue creation, issue-branch pushes, and opening or updating at most three focused PRs in this repository; it never authorizes merging.

- Evaluate the running app through both roles instead of reviewing source alone.
- Select work severity-first and keep each iteration to one issue and one PR.
- Permit at most three open agent-loop PRs and only independent, non-overlapping queued work.
- Require independent agent review before a PR is considered ready for humans.
- Use only dedicated resettable local test resources.
- Keep subjective, unspecified, protected, production, or destructive changes proposal-only until a human approves them.

## Verification

For implementation work, run the relevant automated tests plus:

```powershell
npm run typecheck
npm run lint
npm test -- --watch=false
npx expo-doctor
```
