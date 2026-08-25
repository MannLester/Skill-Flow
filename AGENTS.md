# SkillFlow Repository Instructions

These instructions apply to every agent working in this repository.

## Workspace boundary

- Work only inside `C:\Users\Mann lee\Desktop\mann-projects\skill-flow`.
- Do not inspect, search, read, or use files from parent folders, sibling projects, or unrelated repositories.
- Do not access or apply SEDAR documentation, terminology, source code, or instructions to SkillFlow.
- If required information appears to exist outside this repository, stop and ask the user before accessing it.

## Project context

- This repository is **SkillFlow**, an Android-first Expo and React Native academic demonstration.
- Treat `src/` as the active application implementation.
- Treat `references/skillflow.pdf` and the images in `references/` as product references. There is currently no `resources/` directory.
- Use `README.md` for current run and verification commands.
- Use `docs/SKILLFLOW_SYSTEM_AUDIT_AND_ROADMAP.md` as the ordered improvement backlog.

## Demo constraints

- Keep the application self-contained and reliable for demonstrations.
- Do not add a real payment processor, collect real payment credentials, or imply that simulated balances are real money.
- Prefer seeded local data and persistence unless the user explicitly authorizes an external service.
- Clearly label deterministic AI feedback, student verification, payment holds, and payment releases as simulations.
- Preserve the two user roles: Student Designer and Client.

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

