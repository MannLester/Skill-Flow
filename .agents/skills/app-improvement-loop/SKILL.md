---
name: app-improvement-loop
description: Run a bounded evidence-driven improvement cycle on an existing application by exercising the real UI, qualifying one problem, creating or selecting an issue, implementing and verifying a focused fix, obtaining independent review, and opening a PR without merging. Use when a user explicitly asks an agent to autonomously improve, dogfood, or iterate on a running app; do not use for read-only audits or a preselected implementation task.
---

# App Improvement Loop

Improve the product through observed behavior rather than code inspection alone. Never merge.

## Resolve the local contract

Read all applicable repository instructions. If the repository defines an improvement-loop playbook, read it completely and follow its stricter project-specific sources, journeys, commands, protected areas, labels, queue cap, and stopping rules. Otherwise read [references/default-protocol.md](references/default-protocol.md).

The request must explicitly ask to run the loop before making external issue, branch, push, or PR changes. A request to explain, design, audit, or preview the loop is read-only. Loop authorization never includes merging, auto-merge, production deployment, production/shared data mutation, credentials, or destructive actions outside an isolated agent-owned environment.

## Run bounded iterations

At the start of each run:

- verify repository/remote identity, scoped write permission, and ownership of issues/branches/PRs; never modify human-authored PRs or force-push
- inspect current issues, open loop-authored PRs, source authority, working tree, and available runtime targets
- fetch the exact approved remote base; preserve and report a dirty tree instead of resetting, stashing, overwriting, or absorbing it
- use a clean checkout and branch each implementation from that fetched base
- establish an isolated resettable test environment with a unique run ID and read-back ownership proof for every disposable resource; missing reset/seed support is a blocker, not permission to clear shared state
- stop implementation when the repository's open-PR cap is reached, counting the conservative union of loop labels, loop branch prefixes, and run markers so a missing label cannot bypass the cap

Each iteration must produce at most one issue, one branch, one focused change, and one PR. Before creating an issue for a newly discovered defect, derive the repository-defined deterministic fingerprint (or the default protocol's canonical fingerprint), atomically reserve a finding ref, and embed its exact marker in the issue. A conflicting or orphaned reservation blocks issue creation. Claim the issue separately with a host-supported atomic create-if-absent operation, then re-read the finding reservation, issue, issue claim, linked PRs, and open queue before editing. On GitHub, use deterministic refs at the fetched base SHA through the Git Data create-ref API. Never update, delete, or force a claim ref to take ownership. If atomic claiming is unavailable, stop before editing. Work may continue without waiting for humans to merge only when the next ticket is independent across files, behavior, schemas/APIs, fixtures/seeds, dependencies, and acceptance criteria. Unknown overlap blocks. Never stack the next branch on an unmerged PR unless the project explicitly authorizes stacked changes.

## Observe before selecting work

Run the application and complete the repository's role × flow × state matrix. At minimum cover applicable happy, loading/empty, validation/error, recovery, and persistence/restart states, with screenshots and runtime logs. Use the product's primary platform when available and disclose any fallback. Inspect interactions, navigation, accessibility, and feedback. Do not call a screen functional merely because it renders or tests pass.

Select work severity-first. Search issues and PRs for duplicates. Implement only reproducible objective defects or approved requirements. If behavior is unspecified, evidence conflicts, or the change is subjective or protected, create a proposal-only issue and do not implement it.

Read [references/evidence-templates.md](references/evidence-templates.md) when creating an issue or PR.

## Implement, verify, and review

Create an issue-linked branch from the latest base and make the smallest complete fix within the approved stack. Use focused feedback checks during development and the full repository gate before the PR. Re-run the real affected journey and inspect screenshots and runtime errors.

Open a draft PR with its issue, scope, evidence, checks, manual states, and unavailable verification. Then delegate review to a distinct available agent that did not implement the change. The reviewer checks repository standards and issue acceptance criteria. Address valid findings, rerun affected verification, and only then mark it ready. If no independent reviewer is available, keep the PR draft and report the blocker. Neither builder nor reviewer merges.

Do not retry credential, permission, ownership, production, destructive, or protected-scope blockers. Record whether they need a human decision (`proposal-only`) or external state change (`blocked`). A safely retryable environment failure gets at most three total non-destructive attempts, including the first; record each attempt before moving on. Never escape by weakening tests, suppressing errors, changing acceptance criteria, or hiding failed verification.

## Stop and hand off

Stop when the per-run PR limit or open-PR cap is reached, three new issues produced no PR, no meaningful unblocked work remains, safe product evaluation is unavailable, or only proposal/protected work remains. Draft and ready PRs count toward the open cap; closed/merged PRs do not. Every PR created in this invocation counts toward the run limit, while updates to an existing agent-owned PR do not. Provide a run report covering journeys, terminal evidence, issues, branches/PRs, review findings, verification, blocked work, queue conflicts, and human decisions needed.
