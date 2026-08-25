# Continuous evidence-driven improvement pipeline

This playbook governs an explicitly invoked autonomous SkillFlow improvement pipeline. It continuously dogfoods the real product and delivers objective fixes through independent roles as verified, ready PRs for human merge decisions.

## Authorization and safety boundary

An explicit request to run this pipeline authorizes repository-scoped issue creation, agent-owned branches and worktrees, pushes, and PR creation/updates. It never authorizes merging, including auto-merge or indirect merge automation. It also never authorizes:

- production deployment, production/shared data, credentials, or administrator accounts
- destructive or incompatible migrations, real payments, external AI, or identity-verification changes
- subjective or unspecified product decisions without separate human approval
- modifying, force-pushing, closing, or merging a human-authored PR
- bypassing branch protection, required checks, reviews, or merge conflicts
- destructive cleanup outside resources whose exact agent ownership was read back

Ambiguous ownership is not agent ownership. Protected or subjective work becomes `proposal-only`; missing credentials or external state becomes `blocked`. Continue other independent lanes when safe.

## Current delivery priorities

Prioritize the foundational local Dockerized Convex work. Mann owns Convex Cloud production and Clerk provisioning; never invent or request those credentials. Until Clerk is available, keep AsyncStorage authoritative for the running UI and do not start its live data migration. Backend lanes may implement the approved full domain schema and indexes, deterministic lifecycle seeds, and isolated development-only reset support.

UI scouting continues across both roles, but while the backend foundation is readying, implement only reproducible Critical or High journey defects. Lower-severity UI findings remain evidence-backed backlog issues.

## Role separation

The orchestrator assigns work and records ownership but does not implement, QA, or release. Keep the repository root clean and orchestration-only; do not run product edits or builds there.

- **Scout:** uses a dedicated clean baseline worktree, exercises both roles through the real UI, collects screenshots/logs, deduplicates evidence, and creates or enriches issues. It never implements.
- **Builder:** owns exactly one issue lane and its dedicated worktree. It implements, tests, commits, and pushes only that issue. It cannot QA, release, or merge its own work.
- **QA:** does not implement the lane. It makes no code edits. It reviews the exact pushed head against the issue/spec and repository standards, runs the full gate, and repeats the affected real UI journey with screenshots and runtime logs.
- **Release:** does not implement or QA the lane. It makes no code edits and never merges. It opens or updates a ready PR only after verifying ownership, SHA-bound QA evidence, checks, protection, and mergeability.

One agent may serve the same role on multiple lanes, but no agent may combine builder with QA or release for the same lane, and QA may never become that lane's implementer. Record role assignments in the issue or run log.

## Sources and selection

Resolve behavior conflicts in this order:

1. explicit human-approved decisions and accepted ADRs
2. the selected issue's acceptance criteria
3. the SkillFlow thesis and approved research requirements
4. supplied screenshots for visual intent
5. current implementation as evidence, not authority

Select objective ready work severity-first: Critical, High, Medium, then Low, subject to the current delivery priorities above. Break ties by dependency-unblocking value, user impact, then age. Never build work with an unresolved source conflict, human decision, dependency, or overlap.

If one issue is too large for a focused, independently verifiable PR, split it before implementation into outcome-based child issues with explicit dependencies and acceptance criteria. Each child still gets one branch, worktree, builder, QA decision, and PR.

## 1. Establish the orchestration baseline

From the clean repository root:

1. Read `AGENTS.md`, this playbook, applicable ADRs, `CONTEXT.md`, active issues, and open PRs.
2. Verify the remote is `MannLester/Skill-Flow`, fetch `origin/main`, and record its exact SHA.
3. Verify GitHub access is repository-scoped and distinguish pipeline-owned issues, refs, worktrees, resources, and PRs from human-owned artifacts.
4. Inventory queued lanes for overlap across files, behavior, schemas/APIs, fixtures/seeds, dependencies, and acceptance criteria. Unknown overlap blocks concurrent implementation. Independent issue lanes are unlimited; available agents and safe resources determine actual concurrency.
5. Establish a unique pipeline/run identity. Name disposable services and test resources `skillflow-loop-<run-id>` and read back their ownership metadata before reset or cleanup.

Never stash, reset, overwrite, or absorb a dirty checkout. A dirty root blocks orchestration until its owner resolves it.

## 2. Scout the running product

Create a disposable scout worktree from the recorded `origin/main`; never dogfood from an unmerged issue branch. Install locked dependencies, start only isolated local services, and reset/seed only resources proven to belong to this run.

Exercise both roles as a human:

- Student Designer: authentication, dashboard, discovery, proposals/services, projects, messaging, mentor, notifications, portfolio/profile, and settings.
- Client: authentication, dashboard, discovery, booking/project posting, proposal selection, project lifecycle, messaging, notifications, and settings.

Android is required whenever a device or emulator is available. Web is additional coverage and a disclosed fallback only when Android is unavailable. Cover applicable happy, loading/empty, validation/error, recovery, persistence/restart, accessibility, keyboard, and navigation states. Capture screenshots and inspect runtime/console logs. Rendering alone is not evidence that a flow works.

For every candidate, record exact starting state, reproduction steps, expected/actual behavior, severity, source, affected role/platform, suspected scope, and useful screenshot/log evidence.

## 3. Deduplicate, reserve, and claim one issue per lane

Search open and closed issues and PRs first. Add evidence to an existing issue when it represents the same outcome.

For a new finding, canonicalize these lowercase, trimmed, whitespace-collapsed fields separated by newlines: approved source identifier, role, route/flow, state, expected outcome, and actual violated outcome. SHA-256 the UTF-8 text and atomically reserve it at the recorded base SHA:

```sh
gh api --method POST repos/MannLester/Skill-Flow/git/refs \
  -f ref="refs/heads/agent-loop/finding-${FINDING_SHA256}" \
  -f sha="${BASE_SHA}"
```

If the ref exists, reuse the issue containing `finding:<sha>` or report an orphaned reservation; never create a reworded duplicate or delete the reservation. After a successful reservation, repeat the duplicate search, create one evidence-complete issue with the marker, then read it back.

The issue defines one outcome, scope exclusions, dependencies, acceptance criteria, automated checks, and manual Android states. Apply `agent-loop` and a severity label. Claim it atomically by creating `refs/heads/agent-loop/issue-<number>` at the same base SHA. A pre-existing ref belongs to another lane. After claiming, assign it, add the ownership/base/role record, and read back the issue, refs, linked PRs, and overlap state before editing.

## 4. Build in an isolated issue lane

Create `.agent-worktrees/issue-<number>` from the successfully claimed branch. Its initial SHA must equal the recorded `origin/main`. Only the assigned builder edits this worktree.

The builder:

1. rechecks issue scope, dependencies, and overlap;
2. implements the smallest complete fix using existing architecture;
3. adds meaningful regression coverage for behavior or state transitions;
4. runs focused feedback checks and the relevant repository gate;
5. exercises the affected flow when practical, then commits and pushes the issue branch;
6. hands off the exact remote head SHA, changed scope, checks, and known limitations.

The builder does not open or merge the PR and may not provide the independent QA decision. Do not weaken checks, add suppressions, hide failures, or broaden acceptance criteria.

## 5. QA the exact pushed head

QA first proves it is independent from the builder and pins the issue base and remote head SHA. Review only that diff along two axes: repository standards and the originating issue/spec.

QA must:

- verify every acceptance criterion and detect missing, incorrect, unintended, or protected behavior;
- run the committed full gate; for the current baseline:

  ```sh
  npm run typecheck
  npm run lint
  npm test -- --watch=false
  npx expo-doctor
  npx expo export --platform android
  ```

- run required Convex health, codegen/type, integration, native, or dependency checks when applicable;
- repeat affected Android journeys when available, inspect screenshots for important states, and check runtime/console errors; use web additionally where supported;
- post a pass or fail report bound to the exact head SHA, including commands, results, device/platform, screenshots, unavailable checks, and residual risk.

Any finding returns the lane to its builder. After every code change, QA reruns affected checks and issues a new SHA-bound decision. A stale, partial, self-authored, or evidence-free QA report is not approval.

## 6. Prepare an agent-owned PR for human merge

Only the release role may open or update the lane's PR. It first reads back the issue claim, role records, branch, remote head, existing PRs, and current `origin/main`. It never merges.

Open or update one issue-linked PR with scope, evidence, QA report, automated results, Android/manual results, screenshots, and unavailable checks. Label it `agent-loop` and include the run/ownership marker. Wait for all configured host checks and branch protection.

Before marking the PR ready for humans, release must prove all of the following:

- the PR was created by this pipeline for its claimed issue; ownership is unambiguous and it is not human-authored;
- PR head exactly matches the latest passing independent QA SHA and contains no unreviewed commits;
- issue/spec review, repository-standards review, the full gate, and required real UI/screenshots all passed;
- every configured required check/review is successful, with none pending, skipped when required, or failing;
- the PR targets current `main`, is mergeable without conflicts, contains no protected/unapproved scope, and needs no production credential or destructive action;
- the release agent did not implement or QA the change.

If any condition is missing, stale, ambiguous, failing, or conflicted, release refuses readiness and routes the lane back to builder or QA. When every condition passes, release marks the PR ready and leaves the merge decision and action to a human developer. Agents never enable auto-merge, use administrator bypass, or merge directly or indirectly.

## 7. Continue lanes and react to human merges

Do not wait for an open PR to merge before scouting or building other proven-independent issues. When a human merge changes `origin/main`, the orchestrator records the new SHA and evaluates each agent-owned queued lane:

1. read back its issue, worktree, local/remote branch heads, PR, and dirty state;
2. if work has not started, remove only the clean owned worktree and recreate it from the new base;
3. if a clean update is safe and ownership is proven, the assigned builder may rebase its agent-owned branch onto `origin/main`;
4. for a pushed agent-owned branch, update it with `--force-with-lease` only when the expected remote head is unchanged and no human commit or ownership ambiguity exists;
5. if a rebase conflicts, overlap appears, or the correct resolution is ambiguous, preserve the work and request a human rebase decision;
6. invalidate all earlier QA evidence and require QA of the new exact head before the PR returns to ready.

Never rebase or force-push a human-authored branch or PR. Never delete a finding/claim ref or an unproven worktree/resource.

## 8. Continue or block

Keep a scout worktree based on the latest `origin/main`. Scouts may continue discovering while independent lanes build and ready PRs await humans. Concurrency is limited by available isolated agents/resources and proven non-overlap, not a fixed cap.

Pause only the affected lane for overlap, unresolved dependencies, stale conflicts, failed verification, unsafe resources, or protected PM-owned work. Credential, permission, ownership, production, destructive, and protected-scope blockers are immediate and are not retried. A safely retryable environment failure gets at most three non-destructive attempts, each recorded. Do not fabricate work when no objective issue is found; keep scouting or report the exact safe blocker. The continuous pipeline ends only when explicitly stopped or when no lane can make safe progress.

## Pipeline report

Keep a concise rolling record of role assignments, base/head SHAs, worktrees/resources, journeys and screenshots, issues, branches/PRs, observed human merges, QA findings, gate results, rebases/conflicts, and human/external blockers. Never describe partial evidence as a pass.
