# Default continuous improvement protocol

Use this fallback only when a repository has no explicit improvement-loop playbook. Repository and user instructions may be stricter.

## Roles and workspaces

- Keep the root checkout clean and orchestration-only.
- A scout dogfoods every first-class role through the real UI and files deduplicated, evidence-backed issues. It does not implement.
- One builder owns each issue and isolated worktree. It cannot QA or release its own work.
- Independent QA edits no code. It reviews the exact pushed SHA against the issue/spec and repository standards, runs the full gate, and repeats affected UI journeys with screenshots and logs.
- A separate release agent edits no code and never merges. It opens or updates a ready PR only after current QA, checks, ownership, and mergeability pass.

There is no fixed run, lane, or open-PR cap. Build concurrently only when ownership and non-overlap across files, behavior, interfaces, data, dependencies, and acceptance criteria are proven.

Split oversized work into outcome-based, dependency-linked child issues before implementation. Each issue keeps one branch, worktree, builder, QA decision, and focused PR. A ready PR requires relevant tests, the full repository gate, applicable real UI evidence, and independent QA.

## Ownership and selection

Fetch the remote default branch and start clean scout and issue worktrees from its recorded SHA. Preserve dirty or human-owned work. Select objective issues severity-first and keep one outcome per issue/branch/PR.

Before creating a finding, canonicalize newline-separated `source`, `role`, `flow`, `state`, `expected`, and `actual` fields by lowercasing, trimming, and collapsing whitespace. SHA-256 the UTF-8 text and atomically reserve `agent-loop/finding-<hash>` at the base SHA. Reuse the issue containing `finding:<hash>` when the ref exists; an orphaned reservation blocks a duplicate.

Claim an issue atomically by creating `agent-loop/issue-<number>` at the same base SHA. Never update or delete an existing claim to seize ownership. Record the builder, QA, and release identities plus base/head SHAs.

## Evidence and safety

Prefer the primary platform and exercise happy, loading/empty, validation/error, recovery, and persistence states. Record steps, expected/actual results, screenshots, logs, severity, and governing source. Current code is evidence, not product authority.

Production, credentials, shared data, destructive work, protected architecture/security/payment scope, and unsupported subjective decisions are not authorized. Never weaken verification or modify, force-push, close, or merge human-authored work.

Release must refuse stale or missing QA, unreviewed commits, failures, conflicts, protected scope, incomplete UI evidence, or ambiguous ownership. It leaves the verified PR for a human merge decision and continues with other independent work.

After a human merge, refresh the base. Builders may safely update their own clean queued branches when ownership and the remote head are proven; conflicts or ambiguous rebase decisions require human direction, and changed heads require fresh QA. Continue scouting until explicitly stopped or safe progress is blocked.
