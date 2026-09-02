import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { mentorQuestion, mentorQuestionTopic } from "./lib/mentor";

export const role = v.union(v.literal("student"), v.literal("client"));
export const serviceStatus = v.union(v.literal("draft"), v.literal("published"), v.literal("archived"));
export const postStatus = v.union(v.literal("draft"), v.literal("open"), v.literal("closed"), v.literal("archived"));
export const proposalStatus = v.union(v.literal("submitted"), v.literal("accepted"), v.literal("rejected"), v.literal("withdrawn"));
export const bookingStatus = v.union(
  v.literal("requested"), v.literal("accepted"), v.literal("declined"), v.literal("cancelled"),
  v.literal("demo_funded"), v.literal("in_progress"), v.literal("submitted"),
  v.literal("revision_requested"), v.literal("completed"), v.literal("reviewed"),
);
export const verificationStatus = v.union(v.literal("not_submitted"), v.literal("pending"), v.literal("verified"), v.literal("rejected"));
export const mediaPurpose = v.union(
  v.literal("avatar"), v.literal("portfolio_evidence"), v.literal("certification_evidence"),
  v.literal("verification_sample"), v.literal("service_cover"), v.literal("service_gallery"),
  v.literal("project_reference"), v.literal("booking_reference"), v.literal("proposal_sample"),
  v.literal("delivery_image"), v.literal("message_image"),
);
export const mediaVisibility = v.union(v.literal("public"), v.literal("owner"), v.literal("participants"));
export const mediaTargetType = v.union(
  v.literal("profile"), v.literal("portfolio"), v.literal("certification"), v.literal("verification"),
  v.literal("service"), v.literal("project_post"), v.literal("proposal"), v.literal("booking"), v.literal("message"),
);
export const mediaTargetId = v.union(
  v.id("profiles"), v.id("portfolioItems"), v.id("certifications"), v.id("studentVerifications"),
  v.id("services"), v.id("projectPosts"), v.id("proposals"), v.id("projectBookings"), v.id("projectMessages"),
);
export const seedFields = {
  seedNamespace: v.optional(v.string()),
  seedVersion: v.optional(v.string()),
  seedKey: v.optional(v.string()),
};

export default defineSchema({
  mediaUploadIntents: defineTable({
    ownerProfileId: v.id("profiles"), purpose: mediaPurpose,
    state: v.union(v.literal("pending"), v.literal("finalized"), v.literal("discarded"), v.literal("expired")),
    expiresAt: v.number(), finalizedFileId: v.optional(v.id("uploadedFiles")), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_ownerProfileId_and_state_and_expiresAt", ["ownerProfileId", "state", "expiresAt"])
    .index("by_state_and_expiresAt", ["state", "expiresAt"]),

  uploadedFiles: defineTable({
    storageId: v.id("_storage"), ownerProfileId: v.id("profiles"), contentType: v.string(), byteSize: v.number(),
    width: v.number(), height: v.number(), originalName: v.string(), linkCount: v.number(), createdAt: v.number(), updatedAt: v.number(),
    unattachedExpiresAt: v.optional(v.number()), ...seedFields,
  }).index("by_storageId", ["storageId"]).index("by_ownerProfileId_and_createdAt", ["ownerProfileId", "createdAt"])
    .index("by_unattachedExpiresAt", ["unattachedExpiresAt"]).index("by_seed", ["seedNamespace", "seedKey"]),

  mediaAttachments: defineTable({
    uploadedFileId: v.id("uploadedFiles"), ownerProfileId: v.id("profiles"), targetType: mediaTargetType,
    targetId: mediaTargetId, purpose: mediaPurpose, position: v.number(), altText: v.string(), visibility: mediaVisibility,
    createdAt: v.number(), updatedAt: v.number(), ...seedFields,
  }).index("by_targetType_and_targetId_and_purpose_and_position", ["targetType", "targetId", "purpose", "position"])
    .index("by_uploadedFileId", ["uploadedFileId"]).index("by_ownerProfileId_and_createdAt", ["ownerProfileId", "createdAt"])
    .index("by_seed", ["seedNamespace", "seedKey"]),

  profiles: defineTable({
    authTokenIdentifier: v.optional(v.string()), role, name: v.string(), bio: v.string(), location: v.string(),
    organization: v.optional(v.string()), school: v.optional(v.string()), program: v.optional(v.string()),
    gradeLevel: v.optional(v.string()), graduationYear: v.optional(v.number()), skills: v.array(v.string()),
    createdAt: v.number(), updatedAt: v.number(), ...seedFields,
  }).index("by_auth_token", ["authTokenIdentifier"]).index("by_role", ["role"]).index("by_seed", ["seedNamespace", "seedKey"]),

  services: defineTable({
    ownerProfileId: v.id("profiles"), title: v.string(), subtitle: v.string(), category: v.string(),
    description: v.string(), price: v.number(), deliveryDays: v.number(), revisions: v.string(), status: serviceStatus,
    normalizedSearch: v.string(), assetKey: v.optional(v.string()), createdAt: v.number(), updatedAt: v.number(),
    publishedAt: v.optional(v.number()), ...seedFields,
  }).index("by_owner_status", ["ownerProfileId", "status", "updatedAt"]).index("by_status_category", ["status", "category", "publishedAt"])
    .searchIndex("search_services", { searchField: "normalizedSearch", filterFields: ["status", "category"] }).index("by_seed", ["seedNamespace", "seedKey"]),

  savedServices: defineTable({ profileId: v.id("profiles"), serviceId: v.id("services"), createdAt: v.number(), ...seedFields })
    .index("by_profile", ["profileId", "createdAt"]).index("by_service", ["serviceId"]).index("by_profile_service", ["profileId", "serviceId"]).index("by_seed", ["seedNamespace", "seedKey"]),

  projectPosts: defineTable({
    clientProfileId: v.id("profiles"), title: v.string(), description: v.string(), category: v.string(), budget: v.number(),
    deadline: v.string(), deadlineEpoch: v.number(), skills: v.array(v.string()), status: postStatus, normalizedSearch: v.string(),
    acceptedProposalId: v.optional(v.id("proposals")), createdAt: v.number(), updatedAt: v.number(), openedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()), archivedAt: v.optional(v.number()), ...seedFields,
  }).index("by_client_status", ["clientProfileId", "status", "updatedAt"]).index("by_status_category", ["status", "category", "openedAt"])
    .searchIndex("search_posts", { searchField: "normalizedSearch", filterFields: ["status", "category"] }).index("by_seed", ["seedNamespace", "seedKey"]),

  proposals: defineTable({
    projectPostId: v.id("projectPosts"), studentProfileId: v.id("profiles"), coverLetter: v.string(), amount: v.number(), deliveryDays: v.number(),
    status: proposalStatus, terminalReason: v.optional(v.union(v.literal("student_withdrew"), v.literal("client_rejected"), v.literal("another_accepted"), v.literal("post_archived"))),
    createdAt: v.number(), updatedAt: v.number(), decidedAt: v.optional(v.number()), ...seedFields,
  }).index("by_post_status", ["projectPostId", "status", "createdAt"]).index("by_student_status", ["studentProfileId", "status", "createdAt"])
    .index("by_post_student", ["projectPostId", "studentProfileId"]).index("by_seed", ["seedNamespace", "seedKey"]),

  projectBookings: defineTable({
    clientProfileId: v.id("profiles"), studentProfileId: v.id("profiles"), source: v.union(v.literal("service_request"), v.literal("proposal")),
    serviceId: v.optional(v.id("services")), projectPostId: v.optional(v.id("projectPosts")), proposalId: v.optional(v.id("proposals")), requestKey: v.optional(v.string()),
    title: v.string(), description: v.string(), category: v.optional(v.string()), deliveryDays: v.number(), revisions: v.optional(v.string()), budget: v.number(),
    status: bookingStatus, version: v.number(), deliveryNote: v.optional(v.string()), revisionNote: v.optional(v.string()),
    createdAt: v.number(), updatedAt: v.number(), acceptedAt: v.optional(v.number()), fundedAt: v.optional(v.number()), startedAt: v.optional(v.number()),
    submittedAt: v.optional(v.number()), revisionRequestedAt: v.optional(v.number()), completedAt: v.optional(v.number()), reviewedAt: v.optional(v.number()), cancelledAt: v.optional(v.number()),
    lastCommand: v.optional(v.string()), lastActorProfileId: v.optional(v.id("profiles")), ...seedFields,
  }).index("by_client_status", ["clientProfileId", "status", "updatedAt"]).index("by_student_status", ["studentProfileId", "status", "updatedAt"])
    .index("by_service", ["serviceId"]).index("by_post", ["projectPostId"]).index("by_proposal", ["proposalId"])
    .index("by_client_request", ["clientProfileId", "requestKey"]).index("by_seed", ["seedNamespace", "seedKey"]),

  ledgerEntries: defineTable({ ownerProfileId: v.id("profiles"), bookingId: v.id("projectBookings"), type: v.union(v.literal("hold"), v.literal("refund"), v.literal("release")), amount: v.number(), isSimulated: v.literal(true), createdAt: v.number(), ...seedFields })
    .index("by_booking_type", ["bookingId", "type"]).index("by_owner", ["ownerProfileId", "createdAt"]).index("by_seed", ["seedNamespace", "seedKey"]),

  reviews: defineTable({ bookingId: v.id("projectBookings"), clientProfileId: v.id("profiles"), studentProfileId: v.id("profiles"), rating: v.number(), comment: v.string(), createdAt: v.number(), ...seedFields })
    .index("by_booking", ["bookingId"]).index("by_student", ["studentProfileId", "createdAt"]).index("by_client", ["clientProfileId", "createdAt"]).index("by_seed", ["seedNamespace", "seedKey"]),

  projectMessages: defineTable({ bookingId: v.id("projectBookings"), senderProfileId: v.id("profiles"), recipientProfileId: v.id("profiles"), body: v.string(), sendKey: v.string(), createdAt: v.number(), readAt: v.optional(v.number()), ...seedFields })
    .index("by_booking", ["bookingId", "createdAt"]).index("by_sender", ["senderProfileId", "createdAt"]).index("by_recipient_read", ["recipientProfileId", "readAt", "createdAt"])
    .index("by_booking_sender_key", ["bookingId", "senderProfileId", "sendKey"]).index("by_seed", ["seedNamespace", "seedKey"]),

  notifications: defineTable({
    recipientProfileId: v.id("profiles"), kind: v.union(v.literal("project"), v.literal("message"), v.literal("payment"), v.literal("complete")),
    title: v.string(), detail: v.string(), eventKey: v.string(), targetType: v.union(v.literal("booking"), v.literal("post"), v.literal("wallet")),
    bookingId: v.optional(v.id("projectBookings")), projectPostId: v.optional(v.id("projectPosts")), createdAt: v.number(), readAt: v.optional(v.number()), ...seedFields,
  }).index("by_recipient_read", ["recipientProfileId", "readAt", "createdAt"]).index("by_recipient_event", ["recipientProfileId", "eventKey"])
    .index("by_booking", ["bookingId"]).index("by_post", ["projectPostId"]).index("by_seed", ["seedNamespace", "seedKey"]),

  portfolioItems: defineTable({
    studentProfileId: v.id("profiles"), sourceKind: v.union(v.literal("manual"), v.literal("completed_booking")), sourceBookingId: v.optional(v.id("projectBookings")),
    title: v.string(), description: v.string(), category: v.string(), assetKey: v.optional(v.string()), altText: v.optional(v.string()), idempotencyKey: v.string(),
    createdAt: v.number(), updatedAt: v.number(), archivedAt: v.optional(v.number()), ...seedFields,
  }).index("by_student_archived", ["studentProfileId", "archivedAt", "updatedAt"]).index("by_source_booking", ["sourceBookingId"])
    .index("by_student_key", ["studentProfileId", "idempotencyKey"]).index("by_seed", ["seedNamespace", "seedKey"]),

  certifications: defineTable({ studentProfileId: v.id("profiles"), name: v.string(), issuer: v.string(), year: v.number(), idempotencyKey: v.string(), createdAt: v.number(), updatedAt: v.number(), ...seedFields })
    .index("by_student_year", ["studentProfileId", "year", "createdAt"]).index("by_student_key", ["studentProfileId", "idempotencyKey"]).index("by_seed", ["seedNamespace", "seedKey"]),

  studentVerifications: defineTable({
    studentProfileId: v.id("profiles"), status: verificationStatus, school: v.string(), studentNumberMasked: v.string(), program: v.string(), gradeLevel: v.string(),
    graduationYear: v.optional(v.number()), sampleDocumentName: v.optional(v.string()), rejectionReason: v.optional(v.string()), version: v.number(), isSimulated: v.literal(true),
    submittedAt: v.optional(v.number()), reviewedAt: v.optional(v.number()), updatedAt: v.number(), ...seedFields,
  }).index("by_student", ["studentProfileId"]).index("by_status", ["status"]).index("by_seed", ["seedNamespace", "seedKey"]),

  mentorThreads: defineTable({ studentProfileId: v.id("profiles"), agentThreadId: v.string(), createdAt: v.number(), updatedAt: v.number() })
    .index("by_student", ["studentProfileId"]).index("by_agent_thread", ["agentThreadId"]),

  mentorConversations: defineTable({ studentProfileId: v.id("profiles"), title: v.string(), agentThreadId: v.optional(v.string()), createdAt: v.number(), updatedAt: v.number() })
    .index("by_student_updated", ["studentProfileId", "updatedAt"]),

  mentorBriefs: defineTable({
    conversationId: v.id("mentorConversations"), studentProfileId: v.id("profiles"), summary: v.string(),
    goal: v.optional(v.string()), audience: v.optional(v.string()), problem: v.optional(v.string()),
    constraints: v.optional(v.string()), deliverable: v.optional(v.string()), successCriterion: v.optional(v.string()),
    openQuestion: v.optional(v.string()), openQuestionTopic: v.optional(v.union(
      v.literal("goal"), v.literal("audience"), v.literal("problem"), v.literal("constraints"),
      v.literal("deliverable"), v.literal("successCriterion"),
    )),
    questionsAsked: v.optional(v.number()), askedTopics: v.optional(v.array(mentorQuestionTopic)),
    stage: v.union(v.literal("discovery"), v.literal("guidance")), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_conversation", ["conversationId"]).index("by_student_updated", ["studentProfileId", "updatedAt"]),

  mentorMessages: defineTable({ studentProfileId: v.id("profiles"), conversationId: v.optional(v.id("mentorConversations")), turnId: v.string(), role: v.union(v.literal("user"), v.literal("mentor")), sequence: v.union(v.literal(0), v.literal(1)), body: v.string(), turnKey: v.string(), question: v.optional(mentorQuestion), ruleVersion: v.optional(v.string()), source: v.optional(v.union(v.literal("simulated"), v.literal("opencode_zen"))), model: v.optional(v.string()), isSimulated: v.optional(v.literal(true)), createdAt: v.number(), ...seedFields })
    .index("by_student", ["studentProfileId", "createdAt"]).index("by_student_turn_key", ["studentProfileId", "turnKey"])
    .index("by_conversation_and_createdAt", ["conversationId", "createdAt"])
    .index("by_turn", ["turnId", "sequence"]).index("by_seed", ["seedNamespace", "seedKey"]),

  preferences: defineTable({ profileId: v.id("profiles"), notificationBadgesEnabled: v.boolean(), language: v.literal("en"), settingsDarkMode: v.boolean(), schemaVersion: v.number(), revision: v.number(), createdAt: v.number(), updatedAt: v.number(), ...seedFields })
    .index("by_profile", ["profileId"]).index("by_seed", ["seedNamespace", "seedKey"]),
});
