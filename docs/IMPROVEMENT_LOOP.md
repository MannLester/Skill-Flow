# Evidence-driven improvement loop

This playbook defines how an explicitly invoked agent may inspect and improve SkillFlow autonomously. One **run** creates at most three PRs. One **iteration** creates at most one issue, branch, fix, and PR.

## Authorization boundary

An explicit request to run this playbook authorizes the agent to create SkillFlow GitHub issues, create and push issue branches, and open or update at most three PRs. It does not authorize merging, production deployment or credentials, changes to shared/production data, destructive schema migrations, or expansion into protected work.

Humans decide whether and when to merge. Humans also own rebasing queued PRs. The agent must not merge indirectly through auto-merge, API calls, workflow edits, or administrator actions.

## Run preconditions

Before evaluating the app:

1. Read `AGENTS.md`, this playbook, applicable ADRs, active issues, and open agent-loop PRs. Read `CONTEXT.md` when it exists; its absence is not a blocker.
2. Verify the Git remote resolves to `MannLester/Skill-Flow`, GitHub access is scoped to that repository, and the agent can identify which artifacts it owns. Never modify a human-authored PR, force-push, or write to another repository.
3. Fetch `origin/main`. Confirm the working tree is clean and start each implementation branch from that exact ref. Preserve and report a dirty tree; never reset, stash, overwrite, or absorb it into loop work. Never use an open PR branch as the next iteration's base.
4. Stop implementation when three open loop-authored PRs exist, whether draft or ready for review. Count the union of PRs labeled `agent-loop`, PRs whose head branch begins `agent-loop/`, and PRs carrying this workflow's run marker. Never exclude an ambiguous PR merely because a label is missing. Read-only scouting may continue.
5. Claim an existing issue atomically before editing by creating remote ref `refs/heads/agent-loop/issue-<number>` at the fetched `origin/main` SHA through GitHub's create-ref API. Creation must fail if the ref already exists; never update, delete, or force that ref to take a claim. If the host/API cannot provide create-if-absent semantics, stop. After successful creation, apply `agent-claimed`, assign the issue, add a claim comment with the base SHA/run identity, and read back the issue, ref, linked PRs, and open queue.

   ```sh
   gh api --method POST repos/MannLester/Skill-Flow/git/refs \
     -f ref="refs/heads/agent-loop/issue-${ISSUE_NUMBER}" \
     -f sha="${BASE_SHA}"
   ```

   GitHub returning `422` because the ref already exists means another run owns the issue; do not retry by changing or deleting the ref.
6. Confirm the next ticket does not overlap files, behavior, schemas/APIs, fixtures/seeds, dependencies, or acceptance criteria owned by an open PR. Unknown overlap blocks implementation.
7. Establish and record a unique run ID before starting services. Name all disposable resources `skillflow-loop-<run-id>`: the Docker Compose project, Docker volumes, Android Virtual Device, temporary browser profile, and test users where applicable. Before reset or deletion, read back the resource name and ownership metadata. A Docker resource must have `com.docker.compose.project=skillflow-loop-<run-id>`; an emulator must have the exact recorded AVD name and serial. If ownership cannot be proven, do not reset it. Use repository-provided seed/reset commands only; when none exists, preserve state or file a blocker instead of inventing destructive cleanup. Never reset a developer's shared environment or production.

If these conditions cannot be met safely, record the exact blocker instead of improvising around it.

## Source authority

Resolve conflicts in this order:

1. Explicit human-approved decisions and accepted ADRs
2. The selected issue's acceptance criteria
3. The SkillFlow thesis and approved research requirements
4. Supplied screenshots for visual intent
5. Existing implementation as evidence, not authority

When higher-level sources conflict, create a `proposal-only` issue explaining the decision needed. Do not implement the disputed behavior.

## Severity and selection

Select the highest-severity ready issue, whether existing or newly discovered:

- **Critical**: application cannot start or build; data/security failure; an essential demonstration is broadly unusable.
- **High**: a core Student Designer or Client journey is broken or materially violates an approved requirement.
- **Medium**: significant usability, accessibility, reliability, feedback, or cross-screen consistency problem.
- **Low**: visual polish, maintainability, or minor friction with no blocked journey.

Break ties by dependency-unblocking value, user impact, then oldest issue. A new Critical or High finding may preempt lower-priority backlog work. Never select work blocked by an open PR or missing human decision.

## Iteration protocol

### 1. Establish a clean baseline

- Install locked dependencies when needed with `npm ci`.
- Start dedicated local services. When Convex is involved, run the repository's documented health check if one exists; otherwise treat backend health verification as blocked.
- Reset and seed only the loop-owned environment.
- Run focused startup checks. If the baseline is already broken, investigate that failure before judging unrelated UX.

### 2. Evaluate the running product

Launch the app and act as a human using both seeded roles:

- Student Designer: authentication, dashboard, project discovery, proposal or service work, messaging, mentor, notifications, portfolio/profile, and settings.
- Client: authentication, dashboard, student/service discovery, booking or project posting, proposal selection, project lifecycle, messaging, notifications, and settings.

Android is mandatory whenever an emulator or device is available. Web is additional coverage and may be a disclosed fallback only when Android is unavailable. Inspect screenshots, loading/empty/error states, keyboard behavior, navigation, state changes, accessibility, and runtime/console output. Do not infer usability from source code alone.

For each affected role and flow, cover the applicable matrix: happy path, loading or empty state, validation or error state, recovery, persistence/restart, screenshots, and runtime logs. Mark a cell unavailable with its reason rather than silently omitting it.

### 3. Qualify one finding

An implementable finding must be reproducible and supported by approved behavior or objective harm. Capture:

- exact starting state and reproduction steps
- expected versus actual behavior
- severity and user impact
- supporting source or established UI pattern
- screenshot, recording, console output, or test evidence where useful
- affected roles/platforms and suspected scope

Search open and closed issues and PRs before creating anything. Add evidence to an existing issue when it already represents the problem.

Subjective design preferences, undefined product behavior, and source conflicts become `proposal-only` issues and end that iteration without implementation.

### 4. Create or select the issue

Before creating a new issue, derive a stable finding fingerprint from these canonical newline-separated fields: approved source identifier, affected role, route or flow, state, expected outcome, and actual violated outcome. Lowercase the values, trim them, collapse internal whitespace, then SHA-256 hash the resulting UTF-8 text. Reserve it atomically at the fetched base SHA:

```sh
gh api --method POST repos/MannLester/Skill-Flow/git/refs \
  -f ref="refs/heads/agent-loop/finding-${FINDING_SHA256}" \
  -f sha="${BASE_SHA}"
```

If that ref exists, search issues and PRs for the exact marker `finding:${FINDING_SHA256}`. Reuse the matching issue, or stop and report an orphaned reservation when none exists. Do not create a differently worded duplicate or remove the reservation. After successfully reserving, repeat the duplicate search, create the issue immediately with the marker in its body only when no duplicate exists, and read it back.

The issue must define one outcome, in/out of scope, dependencies, acceptance criteria, automated checks, and manual Android states. Apply `agent-loop` and the appropriate severity label. Claim the resulting or selected issue using the atomic issue-ref operation from the preconditions; only after that succeeds may the agent add `agent-claimed` and begin local edits. Recheck ownership, the finding reservation, duplicates, and overlap immediately after claiming. Link conflicts or dependencies to open PRs.

### 5. Implement one focused fix

- Check out the successfully claimed `agent-loop/issue-<number>` remote branch. Its initial SHA must equal the fetched `origin/main` used during the claim.
- Follow existing architecture and use the smallest complete change.
- Add meaningful coverage for behavior and regressions; do not add tests that only freeze copy or styling.
- Do not weaken checks, add suppressions, or broaden scope to make the issue easier.

Protected work is proposal-only unless a human separately approves it:

- new runtime dependencies, services, or architectural patterns
- auth or authorization architecture
- destructive or incompatible Convex schema migrations
- production configuration, secrets, data, or deployment
- real payments, identity verification, or external AI
- unspecified product behavior or visual direction
- deletion outside the dedicated loop environment

### 6. Verify the change

Run targeted feedback checks during development, then the repository's committed gate. For the current baseline:

```sh
npm run typecheck
npm run lint
npm test -- --watch=false
npx expo-doctor
npx expo export --platform android
```

If repository instructions later define a consolidated gate, use that command instead of duplicating its component commands. Convex work also requires the documented local health check, code generation/type checks, and focused integration tests; missing commands are blockers, not permission to skip them. Exercise the fixed flow on Android when available, inspect screenshots, and confirm there is no relevant error screen or runtime/console error.

### 7. Open and independently review the PR

Open a draft PR linked to the issue with scope, evidence, screenshots, automated results, manual results, and unavailable checks. Label it `agent-loop`. A separate available reviewer agent that did not implement the change must review repository standards and issue acceptance criteria. The builder addresses valid findings and reruns affected verification, then marks the PR ready. If no independent reviewer is available, leave the PR draft, record the blocker, and do not represent it as reviewed. Neither agent may merge.

### 8. Continue or stop

Return to the latest `origin/main` and begin another independent iteration only when fewer than three loop-authored PRs are open under the label, branch-prefix, and run-marker union, and fewer than three PRs have been created in the current run.

Credential, permission, ownership, production, destructive, or protected-scope blockers are immediate: do not retry them. Create or update a `proposal-only` issue when a human decision could authorize the work; use `blocked` when an external state change is required. For a safely retryable environment failure, make at most three total attempts, including the first, using only non-destructive recovery steps. After the third identical failure, label the issue `blocked`, attach each attempt's evidence, and select another independent issue. Never bypass or weaken verification.

Stop the run when any condition is true:

- three PRs were created during the run
- three loop-authored PRs are open under the label, branch-prefix, and run-marker union
- three new issues were created without producing a PR
- no meaningful unblocked work remains
- the environment cannot be evaluated safely
- only proposal-only or protected changes remain

Draft and ready loop-authored PRs both count toward the open queue using the label, branch-prefix, and run-marker union above. Merged and closed PRs do not count toward the open queue, but every new PR created during this invocation counts toward the three-PR run limit. Updating an existing agent-owned PR does not count as creating another PR.

## Run report

At the end, report:

- journeys, platforms, states, and screenshots inspected
- issues created, reused, or marked blocked
- branches and PRs opened or updated
- independent review findings and resolutions
- automated/manual verification results
- open PR queue and likely rebase conflicts
- decisions, credentials, or environment changes required from humans
