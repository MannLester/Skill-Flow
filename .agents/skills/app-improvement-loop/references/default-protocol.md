# Default improvement-loop protocol

Use these defaults only when the repository has no explicit improvement-loop playbook. Repository and user instructions may make the loop more restrictive. Do not silently relax these defaults.

## Bounds and integration

- Create no more than three PRs in one run.
- Permit no more than three open loop-authored PRs. Count the union of loop labels, loop branch prefixes, and run markers; include ambiguous PRs rather than undercounting.
- Humans alone merge and rebase queued PRs.
- Verify repository identity and scoped permission; never modify human-authored PRs or force-push.
- Fetch and start each issue branch from the exact latest remote default branch, not another open PR.
- Preserve and report dirty work; never reset, stash, overwrite, or absorb it.
- Before creating an issue for a new finding, canonicalize newline-separated `source`, `role`, `flow`, `state`, `expected`, and `actual` fields by lowercasing, trimming, and collapsing internal whitespace. SHA-256 hash the UTF-8 text and atomically create `refs/heads/agent-loop/finding-<hash>` at the fetched base. Put the exact `finding:<hash>` marker in the issue body. An existing ref requires reuse of the matching issue; if no artifact contains the marker, stop on an orphaned reservation. Never delete or alter a reservation to bypass the conflict.
- Claim and recheck the issue before editing. The claim must also be atomic. On GitHub, create deterministic remote ref `refs/heads/agent-loop/issue-<number>` at the fetched base SHA using the Git Data create-ref API. A pre-existing ref fails the claim. Never overwrite or delete it to seize ownership; stop if create-if-absent semantics are unavailable.

  ```sh
  gh api --method POST repos/OWNER/REPOSITORY/git/refs \
    -f ref="refs/heads/agent-loop/issue-${ISSUE_NUMBER}" \
    -f sha="${BASE_SHA}"
  ```

  Treat GitHub's `422` response for an existing ref as a failed claim, not a retryable error.
- Do not begin work that overlaps an open PR's files, behavior, schema/API, fixtures/seeds, data migration, dependencies, or acceptance criteria. Unknown overlap blocks.
- Use a separate reviewer agent for every PR.

## Source authority

Resolve product conflicts in this order:

1. Explicit approved human decisions and accepted ADRs
2. Selected issue acceptance criteria
3. Product specifications or research requirements
4. Approved visual references
5. Current implementation as evidence, not authority

Create a decision-needed proposal when higher sources conflict.

## Severity

- **Critical**: application cannot start/build; data or security failure; essential usage broadly unavailable.
- **High**: a core user journey is broken or materially violates an approved requirement.
- **Medium**: significant usability, accessibility, reliability, feedback, or consistency problem.
- **Low**: minor friction, polish, or maintainability without a blocked journey.

Select the highest-severity unblocked issue. Break ties by dependency-unblocking value, user impact, then age.

## Protected work

Create a proposal-only issue and stop before implementation for:

- new runtime dependencies, external services, or architectural patterns
- authentication or authorization architecture
- incompatible/destructive schema or data migrations
- production configuration, secrets, data, or deployment
- payments, identity assurance, or external AI semantics
- product behavior or visual direction not supported by approved sources
- deletion outside the isolated loop environment

## Isolated state

Create and record a unique run ID. Prefix disposable service instances, Compose projects, volumes, emulator/simulator profiles, browser profiles, and test users with `<app>-loop-<run-id>`. Before reset or deletion, read back exact resource names and ownership metadata. For Docker Compose, require `com.docker.compose.project=<app>-loop-<run-id>`; for an emulator, require the recorded profile name and serial. Use only repository-provided reset/seed commands. If ownership or a safe reset procedure cannot be proven, preserve the state and record a blocker. Shared developer, staging, and production resources are out of scope.

## Runtime evaluation

Cover every first-class role and at least one happy path, empty state, validation failure, recovery path, and persistence/restart check relevant to the area being evaluated. Prefer the application's primary supported platform. Use secondary platforms as additional coverage or a disclosed fallback.

## Stop conditions

Stop after three created PRs, at three open loop PRs, after three new issues without a resulting PR, when no unblocked objective work remains, when runtime evaluation is unsafe/unavailable, or when only protected/proposal work remains. Draft and ready PRs count as open. Merged/closed PRs do not count as open, but PRs created earlier in the same run still count toward its creation limit. Do not invent low-value work just to reach the limit.

Permission, ownership, production, destructive, credential, and protected-scope blockers are not retryable. Safely retryable environment failures get at most three total non-destructive attempts, including the initial attempt, with evidence for each.
