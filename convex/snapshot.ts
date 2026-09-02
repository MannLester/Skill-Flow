import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireIdentity } from "./lib/auth";

function ownerProfile(profile: Doc<"profiles">) {
  const { authTokenIdentifier: _authTokenIdentifier, ...safeProfile } = profile;
  return safeProfile;
}

function publicProfile(profile: Doc<"profiles">) {
  const { _id, _creationTime, role, name, bio, skills } = profile;
  return { _id, _creationTime, role, name, bio, skills };
}

function publicVerification(verification: Doc<"studentVerifications">) {
  const { _id, _creationTime, studentProfileId } = verification;
  return { _id, _creationTime, studentProfileId, status: "verified" as const, isSimulated: true as const };
}

export const get = query({
  args: {}, returns: v.any(),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const currentProfile = await ctx.db.query("profiles")
      .withIndex("by_auth_token", (q) => q.eq("authTokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentProfile) return null;
    const [allProfiles, allServices, allSavedServices, allProjectPosts, allProposals, allBookings, allMessages, allNotifications, allLedger, reviews, allVerifications, portfolioItems, certifications, allMentorConversations, allMentorMessages, mentorBriefs, allPreferences, allAttachments] = await Promise.all([
      ctx.db.query("profiles").take(200), ctx.db.query("services").take(500), ctx.db.query("savedServices").take(500),
      ctx.db.query("projectPosts").take(500), ctx.db.query("proposals").take(500), ctx.db.query("projectBookings").take(500),
      ctx.db.query("projectMessages").take(500), ctx.db.query("notifications").take(500), ctx.db.query("ledgerEntries").take(500),
      ctx.db.query("reviews").take(500), ctx.db.query("studentVerifications").take(200), ctx.db.query("portfolioItems").take(500),
      ctx.db.query("certifications").take(500), ctx.db.query("mentorConversations").take(100), ctx.db.query("mentorMessages").take(500),
      ctx.db.query("mentorBriefs").withIndex("by_student_updated", (q) => q.eq("studentProfileId", currentProfile._id)).take(100),
      ctx.db.query("preferences").take(200), ctx.db.query("mediaAttachments").take(1000),
    ]);
    const profiles = allProfiles.map((profile) => profile._id === currentProfile._id ? ownerProfile(profile) : publicProfile(profile));
    const services = allServices.filter((service) => service.status === "published" || service.ownerProfileId === currentProfile._id);
    const savedServices = allSavedServices.filter((saved) => saved.profileId === currentProfile._id);
    const projectPosts = allProjectPosts.filter((post) => post.status === "open" || post.clientProfileId === currentProfile._id);
    const ownedPostIds = new Set(allProjectPosts.filter((post) => post.clientProfileId === currentProfile._id).map((post) => post._id));
    const proposals = allProposals.filter((proposal) => proposal.studentProfileId === currentProfile._id || ownedPostIds.has(proposal.projectPostId));
    const bookings = allBookings.filter((booking) => booking.clientProfileId === currentProfile._id || booking.studentProfileId === currentProfile._id);
    const bookingIds = new Set(bookings.map((booking) => booking._id));
    const messages = allMessages.filter((message) => bookingIds.has(message.bookingId));
    const notifications = allNotifications.filter((notification) => notification.recipientProfileId === currentProfile._id);
    const ledger = allLedger.filter((entry) => entry.ownerProfileId === currentProfile._id);
    const verifications: (Doc<"studentVerifications"> | ReturnType<typeof publicVerification>)[] = [];
    for (const verification of allVerifications) {
      if (verification.studentProfileId === currentProfile._id) verifications.push(verification);
      else if (verification.status === "verified") verifications.push(publicVerification(verification));
    }
    const mentorMessages = allMentorMessages.filter((message) => message.studentProfileId === currentProfile._id);
    const mentorConversations = allMentorConversations.filter((conversation) => conversation.studentProfileId === currentProfile._id);
    const preferences = allPreferences.filter((preference) => preference.profileId === currentProfile._id);
    const targetIds = new Set<string>([
      ...profiles.map((item) => item._id), ...services.map((item) => item._id), ...projectPosts.map((item) => item._id),
      ...proposals.map((item) => item._id), ...bookings.map((item) => item._id), ...messages.map((item) => item._id),
      ...portfolioItems.map((item) => item._id), ...certifications.map((item) => item._id),
      ...allVerifications.filter((item) => item.studentProfileId === currentProfile._id).map((item) => item._id),
    ]);
    const mediaAttachments = await Promise.all(allAttachments.filter((item) => targetIds.has(item.targetId)).map(async (attachment) => {
      const isPublishedService = attachment.targetType !== "service" || services.some((service) => service._id === attachment.targetId && service.status === "published");
      const file = attachment.visibility === "public" && isPublishedService ? await ctx.db.get(attachment.uploadedFileId) : null;
      const publicUrl = file ? await ctx.storage.getUrl(file.storageId) : null;
      return { _id: attachment._id, targetType: attachment.targetType, targetId: attachment.targetId, purpose: attachment.purpose, position: attachment.position, altText: attachment.altText, visibility: attachment.visibility, publicUrl };
    }));
    return { currentProfile: ownerProfile(currentProfile), profiles, services, savedServices, projectPosts, proposals, bookings, messages, notifications, ledger, reviews, verifications, portfolioItems, certifications, mentorConversations, mentorMessages, mentorBriefs, preferences, mediaAttachments };
  },
});

export const health = query({
  args: {}, returns: v.object({ service: v.literal("skillflow"), schemaVersion: v.number() }),
  handler: async () => ({ service: "skillflow" as const, schemaVersion: 1 }),
});
