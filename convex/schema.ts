import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
export const seedFields = {
  seedNamespace: v.optional(v.string()),
  seedVersion: v.optional(v.string()),
  seedKey: v.optional(v.string()),
};

export default defineSchema({
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

  mentorMessages: defineTable({ studentProfileId: v.id("profiles"), turnId: v.string(), role: v.union(v.literal("user"), v.literal("mentor")), sequence: v.union(v.literal(0), v.literal(1)), body: v.string(), turnKey: v.string(), ruleVersion: v.optional(v.string()), isSimulated: v.optional(v.literal(true)), createdAt: v.number(), ...seedFields })
    .index("by_student", ["studentProfileId", "createdAt"]).index("by_student_turn_key", ["studentProfileId", "turnKey"])
    .index("by_turn", ["turnId", "sequence"]).index("by_seed", ["seedNamespace", "seedKey"]),

  preferences: defineTable({ profileId: v.id("profiles"), notificationBadgesEnabled: v.boolean(), language: v.literal("en"), settingsDarkMode: v.boolean(), schemaVersion: v.number(), revision: v.number(), createdAt: v.number(), updatedAt: v.number(), ...seedFields })
    .index("by_profile", ["profileId"]).index("by_seed", ["seedNamespace", "seedKey"]),
});
