---
name: app-improvement-loop
description: Run a continuous evidence-driven delivery pipeline on an existing application through separate scout, builder, QA, and release agents, producing independently verified PRs for human merge. Use only when the user explicitly asks to autonomously dogfood or improve the running app; do not use for read-only audits or a preselected implementation task.
---

# App Improvement Loop

Continuously improve observed product behavior through independent delivery roles. Source inspection supports evidence but never replaces real UI use.

## Resolve authorization and the repository contract

Read all applicable repository instructions. When the repository defines an improvement-loop playbook, read it completely and treat it as the operational authority for sources, roles, worktrees, issue/ref ownership, commands, protected scope, QA evidence, release checks, rebasing, and stopping conditions. This repository uses `docs/IMPROVEMENT_LOOP.md`; otherwise use [references/default-protocol.md](references/default-protocol.md).

The user must explicitly invoke the loop before any issue, branch, push, or PR mutation. That invocation authorizes only the repository-scoped actions its playbook permits and never authorizes merging. It also never authorizes production, credentials, shared/production data, destructive actions outside proven agent-owned resources, subjective decisions, protection bypasses, or changes to human-authored PRs.

## Keep roles and workspaces independent

Keep the repository root clean and orchestration-only. Use a clean scout worktree from current `origin/main` and one dedicated worktree per claimed issue lane.

- Scouts exercise the real UI through all required roles/platforms and file deduplicated evidence issues; they do not implement.
- A builder owns one issue worktree, implements and pushes that focused change, and does not QA, release, or merge it.
- QA does not implement the lane, edits no code, reviews issue/spec and repository standards, reruns the full gate, and verifies real UI/screenshots on the exact pushed SHA.
- Release does not implement or QA the lane, edits no code, opens or updates its ready PR only when ownership, SHA-bound QA, full verification, configured checks, protection, and mergeability all pass, and never merges it.

Unknown dependency or overlap blocks concurrent building. There is no fixed run, lane, or open-PR cap; use all available safe isolated agent/resource capacity when independence is proven.

Apply the repository's delivery priorities before selection. Split oversized work into verifiable dependency-linked child issues, each with its own lane. A high-quality PR stays focused, has focused coverage plus the full gate, includes real UI evidence when applicable, and has an independent QA decision.

## Run the continuous cycle

1. Fetch and record current `origin/main`; verify remote scope, a clean root, role assignments, existing issues/PRs, and ownership of all worktrees/resources.
2. Dogfood both application roles through the repository's flow/state matrix on its primary platform. Capture screenshots and runtime logs; rendering is not proof of function.
3. Select objective work severity-first. Search duplicates, atomically reserve the deterministic finding, create or enrich one evidence-complete issue, and atomically claim its issue branch before edits. Subjective, disputed, or protected behavior is proposal-only.
4. Create the issue worktree at the recorded base. The builder makes the smallest complete fix, adds meaningful regression coverage, runs focused checks, commits, pushes, and hands off the exact head SHA.
5. QA independently reviews that head against both standards and the issue/spec, runs the committed full gate and required integration/native checks, and repeats affected real journeys with screenshots/logs. Findings return to the builder; any new commit invalidates the prior QA decision.
6. Release reads back current ownership and evidence, opens or updates the issue-linked agent-loop PR, waits for configured checks, and refuses stale evidence, failures, conflicts, unreviewed commits, protected scope, or ambiguous/human ownership. It leaves the ready PR for a human merge decision.
7. Continue other proven-independent lanes without waiting. After a human merge, refresh `origin/main`; agents may update their own clean queued lanes, but conflicts or ambiguous rebases require human direction and every changed head requires fresh QA.
8. Keep scouting and delivering independent ready PRs until explicitly stopped or safely blocked.

Read [references/evidence-templates.md](references/evidence-templates.md) when filing an issue or preparing a PR. Report role identities, SHAs, worktrees/resources, journeys/screenshots, issues, QA results, checks, PRs/merges, rebases, and blockers. Never label partial or unavailable verification as a pass.
