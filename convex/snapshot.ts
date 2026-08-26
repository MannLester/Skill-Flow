import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireProfile } from "./lib/auth";

export const get = query({
  args: {}, returns: v.any(),
  handler: async (ctx) => {
    const currentProfile = await requireProfile(ctx);
    const [allProfiles, allServices, allSavedServices, allProjectPosts, allProposals, allBookings, allMessages, allNotifications, allLedger, reviews, allVerifications, portfolioItems, certifications, allMentorMessages, allPreferences] = await Promise.all([
      ctx.db.query("profiles").take(200), ctx.db.query("services").take(500), ctx.db.query("savedServices").take(500),
      ctx.db.query("projectPosts").take(500), ctx.db.query("proposals").take(500), ctx.db.query("projectBookings").take(500),
      ctx.db.query("projectMessages").take(500), ctx.db.query("notifications").take(500), ctx.db.query("ledgerEntries").take(500),
      ctx.db.query("reviews").take(500), ctx.db.query("studentVerifications").take(200), ctx.db.query("portfolioItems").take(500),
      ctx.db.query("certifications").take(500), ctx.db.query("mentorMessages").take(500), ctx.db.query("preferences").take(200),
    ]);
    const profiles = allProfiles.map(({ authTokenIdentifier: _authTokenIdentifier, ...profile }) => profile);
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
    const verifications = allVerifications.map((verification) => verification.studentProfileId === currentProfile._id
      ? verification
      : { _id: verification._id, _creationTime: verification._creationTime, studentProfileId: verification.studentProfileId, status: verification.status, school: "", studentNumberMasked: "", program: "", gradeLevel: "", version: verification.version, isSimulated: true as const, updatedAt: verification.updatedAt });
    const mentorMessages = allMentorMessages.filter((message) => message.studentProfileId === currentProfile._id);
    const preferences = allPreferences.filter((preference) => preference.profileId === currentProfile._id);
    const { authTokenIdentifier: _authTokenIdentifier, ...safeCurrentProfile } = currentProfile;
    return { currentProfile: safeCurrentProfile, profiles, services, savedServices, projectPosts, proposals, bookings, messages, notifications, ledger, reviews, verifications, portfolioItems, certifications, mentorMessages, preferences };
  },
});

export const health = query({
  args: {}, returns: v.object({ service: v.literal("skillflow"), schemaVersion: v.number() }),
  handler: async () => ({ service: "skillflow" as const, schemaVersion: 1 }),
});
