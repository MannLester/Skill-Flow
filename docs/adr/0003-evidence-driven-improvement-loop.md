# Use a bounded evidence-driven improvement loop

Status: Accepted

SkillFlow may be improved by an autonomous agent that evaluates the running application, creates an evidence-backed issue, implements one focused fix, opens a verified PR, and obtains review from an independent agent. The agent may continue without waiting for humans to merge, but only for independent work, with no more than three agent-authored PRs open and no more than three PRs created per run. Humans alone decide merges and handle rebasing; this trades some queued-PR conflict risk for sustained autonomous progress while preserving human control over integration.

The loop owns an isolated resettable development environment, selects work severity-first, and treats approved decisions, issue criteria, the thesis, and screenshots as stronger evidence than current behavior. Subjective inventions and protected changes remain proposal-only. This decision never authorizes production access, destructive shared-data changes, verification bypasses, or autonomous merging.

Concurrent runs coordinate through immutable create-if-absent GitHub refs: a deterministic finding fingerprint is reserved before a new issue is created, and an issue-number ref is claimed before editing. A conflicting or orphaned reservation blocks work rather than permitting duplicate issues or fixes.
