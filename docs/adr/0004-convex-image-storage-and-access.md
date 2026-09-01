# ADR 0004: Convex image storage and access

- Status: Accepted
- Date: 2026-09-02

## Context

SkillFlow needs image evidence and work samples across public profiles, marketplace listings, and private project workflows. Persisting generated storage URLs would turn them into reusable bearer URLs and would make ownership, replacement, and deletion difficult to enforce consistently.

## Decision

The app stores Convex `Id<"_storage">` values in `uploadedFiles` and links them to typed domain records through `mediaAttachments`. A short-lived `mediaUploadIntents` record binds each upload attempt to its authenticated owner and purpose. Clients normalize images before upload by re-encoding to JPEG, removing metadata, limiting the longest edge to 2000 pixels, and rejecting output over 5 MB. The server independently checks stored MIME type, byte size, dimensions, ownership, and per-purpose limits.

Public avatars, portfolio evidence, certifications, and published service media may resolve through `ctx.storage.getUrl()`. Verification samples, project references, booking requests, proposals, deliveries, and messages are served only by the authenticated `/media` HTTP action after record-specific authorization. Draft service media remains owner-only even though the same attachment becomes publicly resolvable when its service is published.

Attachments are reference counted. Reusing completed delivery media in a portfolio creates another attachment rather than another blob. Replacing a set removes its prior links and deletes a blob only when its final link is removed. Finalized uploads that remain unattached for 24 hours are deleted by a scheduled cleanup and an hourly safety sweep.

Existing text-only records and bundled `assetKey` artwork remain valid. New manual portfolio items, certifications, verification submissions, and newly published or republished services enforce their image requirements.

## Consequences

- Storage URLs are never database fields.
- Private images require an active authenticated request and participant or owner access.
- Domain mutations attach uploaded-file IDs transactionally, preventing cross-account linking.
- Seed/reset tooling must include both media records and storage blobs when seeded media is introduced.
- AI Mentor image understanding remains excluded while its responses are deterministic and cannot inspect images truthfully.
