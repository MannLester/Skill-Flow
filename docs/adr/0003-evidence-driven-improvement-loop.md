# Use a continuous role-separated improvement pipeline with human merges

Status: Accepted

SkillFlow may be improved continuously by separate scout, builder, QA, and release agents. The scout evaluates the real application and files deduplicated evidence-backed issues. Each builder fixes one claimed issue in its own worktree. A different QA agent validates the exact pushed commit against the issue, repository standards, the full verification gate, and the real UI with screenshots. A release agent may then open or update a high-quality ready PR when that evidence is current and all checks pass. Human developers alone decide and perform merges.

The root checkout is orchestration-only; implementation uses isolated issue worktrees. Agents continue with independent issues without waiting for open PRs to merge. After a human merge, agents refresh `origin/main` and may safely update their own clean, independent queued lanes; conflicts and ambiguous rebase decisions remain human-owned. There is no fixed run or open-PR cap; concurrency is limited by safe ownership, resources, and non-overlap.

The current program uses Mann's Convex Cloud development deployment while production remains protected. Convex is authoritative for authenticated application records; `convex-test` provides deterministic in-memory authorization and lifecycle verification without requiring Docker or shared deployment data. Only Critical or High UI journey defects are implemented while foundational work is under review. Oversized work is split into dependency-linked, independently verifiable issues.

The pipeline owns an isolated resettable development environment, selects work severity-first, and treats approved decisions, issue criteria, the thesis, and screenshots as stronger evidence than current behavior. Builders may not QA or release their own work, QA agents may not implement fixes, and release agents must refuse failures, conflicts, stale or missing evidence, ambiguous ownership, protected changes, and human-authored PRs. This decision never authorizes merging, production access, credentials, destructive shared-data changes, verification bypasses, or unsupported subjective product decisions.

Concurrent runs coordinate through immutable create-if-absent GitHub refs: a deterministic finding fingerprint is reserved before a new issue is created, and an issue-number ref is claimed before editing. A conflicting or orphaned reservation blocks work rather than permitting duplicate issues or fixes.
