import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation } from "./_generated/server";
import { assertPositive, assertText, requireProfile, requireRole } from "./lib/auth";
import { notifyBooking, notifyPost } from "./lib/events";
import { postStatus } from "./schema";

type ProjectPostStatus = Doc<"projectPosts">["status"];

function assertPostStatusTransition(current: ProjectPostStatus, next: ProjectPostStatus) {
  if (current === "archived" && next !== "archived") {
    throw new Error("Archived projects cannot change status.");
  }
}

export const savePost = mutation({
  args: { projectPostId: v.optional(v.id("projectPosts")), title: v.string(), description: v.string(), category: v.string(), budget: v.number(), deadline: v.string(), skills: v.array(v.string()), publish: v.boolean() },
  returns: v.id("projectPosts"),
  handler: async (ctx, args) => {
    const client = await requireRole(ctx, "client");
    const title = assertText(args.title, "Project title", 140);
    const description = assertText(args.description, "Description", 3000);
    const category = assertText(args.category, "Category", 80);
    const deadlineEpoch = Date.parse(args.deadline);
    if (!Number.isFinite(deadlineEpoch)) throw new Error("Enter a valid project deadline.");
    const skills = args.skills.map((skill) => skill.trim()).filter(Boolean).slice(0, 20);
    if (!skills.length) throw new Error("Add at least one required skill.");
    const now = Date.now();
    const fields = { clientProfileId: client._id, title, description, category, budget: assertPositive(args.budget, "Budget"), deadline: args.deadline.trim(), deadlineEpoch, skills, status: args.publish ? "open" as const : "draft" as const, normalizedSearch: `${title} ${description} ${category} ${skills.join(" ")}`.toLowerCase(), updatedAt: now, openedAt: args.publish ? now : undefined };
    if (args.projectPostId) {
      const post = await ctx.db.get(args.projectPostId);
      if (!post || post.clientProfileId !== client._id) throw new Error("You can only edit your own project posts.");
      if (post.status === "closed" || post.status === "archived") throw new Error("Closed or archived projects cannot be edited.");
      await ctx.db.patch(post._id, fields);
      return post._id;
    }
    return await ctx.db.insert("projectPosts", { ...fields, createdAt: now });
  },
});

export const setPostStatus = mutation({
  args: { projectPostId: v.id("projectPosts"), status: postStatus }, returns: v.null(),
  handler: async (ctx, args) => {
    const client = await requireRole(ctx, "client");
    const post = await ctx.db.get(args.projectPostId);
    if (!post || post.clientProfileId !== client._id) throw new Error("You can only update your own project posts.");
    assertPostStatusTransition(post.status, args.status);
    if (post.acceptedProposalId && args.status !== "archived") throw new Error("A project with an accepted proposal must remain closed.");
    const now = Date.now();
    await ctx.db.patch(post._id, { status: args.status, updatedAt: now, openedAt: args.status === "open" ? now : post.openedAt, archivedAt: args.status === "archived" ? now : post.archivedAt });
    return null;
  },
});

export const submitProposal = mutation({
  args: { projectPostId: v.id("projectPosts"), coverLetter: v.string(), amount: v.number(), deliveryDays: v.number() }, returns: v.id("proposals"),
  handler: async (ctx, args) => {
    const student = await requireRole(ctx, "student");
    const verification = await ctx.db.query("studentVerifications").withIndex("by_student", (q) => q.eq("studentProfileId", student._id)).unique();
    if (verification?.status !== "verified") throw new Error("Complete simulated student verification before submitting a proposal.");
    const post = await ctx.db.get(args.projectPostId);
    if (!post || post.status !== "open") throw new Error("This project is not accepting proposals.");
    const duplicate = await ctx.db.query("proposals").withIndex("by_post_student", (q) => q.eq("projectPostId", post._id).eq("studentProfileId", student._id)).filter((q) => q.eq(q.field("status"), "submitted")).first();
    if (duplicate) throw new Error("You already have an active proposal for this project.");
    const now = Date.now();
    const proposalId = await ctx.db.insert("proposals", { projectPostId: post._id, studentProfileId: student._id, coverLetter: assertText(args.coverLetter, "Cover letter", 2000), amount: assertPositive(args.amount, "Amount"), deliveryDays: assertPositive(args.deliveryDays, "Delivery days"), status: "submitted", createdAt: now, updatedAt: now });
    await notifyPost(ctx, { recipientProfileId: post.clientProfileId, projectPostId: post._id, title: "New project proposal", detail: `${student.name} proposed for ${post.title}`, eventKey: `proposal:${proposalId}:submitted` });
    return proposalId;
  },
});

export const withdrawProposal = mutation({
  args: { proposalId: v.id("proposals") }, returns: v.null(),
  handler: async (ctx, args) => {
    const student = await requireRole(ctx, "student");
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal || proposal.studentProfileId !== student._id || proposal.status !== "submitted") throw new Error("Only your submitted proposal can be withdrawn.");
    await ctx.db.patch(proposal._id, { status: "withdrawn", terminalReason: "student_withdrew", updatedAt: Date.now(), decidedAt: Date.now() });
    return null;
  },
});

export const decideProposal = mutation({
  args: { proposalId: v.id("proposals"), accept: v.boolean() }, returns: v.union(v.id("projectBookings"), v.null()),
  handler: async (ctx, args) => {
    const client = await requireRole(ctx, "client");
    const proposal = await ctx.db.get(args.proposalId);
    const post = proposal ? await ctx.db.get(proposal.projectPostId) : null;
    if (!proposal || !post || post.clientProfileId !== client._id || post.status !== "open" || proposal.status !== "submitted") throw new Error("This proposal is no longer available for a decision.");
    const now = Date.now();
    if (!args.accept) {
      await ctx.db.patch(proposal._id, { status: "rejected", terminalReason: "client_rejected", updatedAt: now, decidedAt: now });
      await notifyPost(ctx, { recipientProfileId: proposal.studentProfileId, projectPostId: post._id, title: "Proposal not selected", detail: post.title, eventKey: `proposal:${proposal._id}:rejected` });
      return null;
    }
    const bookingId = await ctx.db.insert("projectBookings", { clientProfileId: client._id, studentProfileId: proposal.studentProfileId, source: "proposal", projectPostId: post._id, proposalId: proposal._id, title: post.title, description: post.description, category: post.category, deliveryDays: proposal.deliveryDays, budget: proposal.amount, status: "accepted", version: 1, createdAt: now, updatedAt: now, acceptedAt: now, lastCommand: "accept_proposal", lastActorProfileId: client._id });
    const pending = await ctx.db.query("proposals").withIndex("by_post_status", (q) => q.eq("projectPostId", post._id).eq("status", "submitted")).take(200);
    await Promise.all(pending.map(async (item) => {
      const accepted = item._id === proposal._id;
      await ctx.db.patch(item._id, { status: accepted ? "accepted" : "rejected", terminalReason: accepted ? undefined : "another_accepted", updatedAt: now, decidedAt: now });
      await notifyPost(ctx, { recipientProfileId: item.studentProfileId, projectPostId: post._id, title: accepted ? "Proposal accepted" : "Proposal not selected", detail: post.title, eventKey: `proposal:${item._id}:${accepted ? "accepted" : "rejected"}` });
    }));
    await ctx.db.patch(post._id, { status: "closed", acceptedProposalId: proposal._id, closedAt: now, updatedAt: now });
    return bookingId;
  },
});

export const createBooking = mutation({
  args: { serviceId: v.id("services"), description: v.string(), deliveryDays: v.number(), budget: v.number(), requestKey: v.string() }, returns: v.id("projectBookings"),
  handler: async (ctx, args) => {
    const client = await requireRole(ctx, "client");
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.status !== "published") throw new Error("This service is not available.");
    const existing = await ctx.db.query("projectBookings").withIndex("by_client_request", (q) => q.eq("clientProfileId", client._id).eq("requestKey", args.requestKey)).unique();
    if (existing) return existing._id;
    const now = Date.now();
    const bookingId = await ctx.db.insert("projectBookings", { clientProfileId: client._id, studentProfileId: service.ownerProfileId, source: "service_request", serviceId: service._id, requestKey: assertText(args.requestKey, "Request key", 120), title: service.title, description: assertText(args.description, "Project description", 3000), category: service.category, deliveryDays: assertPositive(args.deliveryDays, "Delivery days"), revisions: service.revisions, budget: assertPositive(args.budget, "Budget"), status: "requested", version: 1, createdAt: now, updatedAt: now, lastCommand: "request", lastActorProfileId: client._id });
    await notifyBooking(ctx, { recipientProfileId: service.ownerProfileId, bookingId, kind: "project", title: "New service request", detail: service.title, eventKey: `booking:${bookingId}:requested` });
    return bookingId;
  },
});

type Action = "accept" | "decline" | "cancel" | "fund" | "start" | "submit" | "request_revision" | "approve" | "review";
type ActionArgs = { action: Action; note?: string; rating?: number; comment?: string };

export const actOnBooking = mutation({
  args: { bookingId: v.id("projectBookings"), action: v.union(v.literal("accept"), v.literal("decline"), v.literal("cancel"), v.literal("fund"), v.literal("start"), v.literal("submit"), v.literal("request_revision"), v.literal("approve"), v.literal("review")), note: v.optional(v.string()), rating: v.optional(v.number()), comment: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireProfile(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Project not found.");
    await applyBookingAction(ctx, actor, booking, args);
    return null;
  },
});

async function applyBookingAction(ctx: MutationCtx, actor: Doc<"profiles">, booking: Doc<"projectBookings">, args: ActionArgs) {
  const isClient = actor._id === booking.clientProfileId;
  const isStudent = actor._id === booking.studentProfileId;
  const now = Date.now();
  const handlers: Record<Action, () => Promise<void>> = {
    accept: () => transition(ctx, actor._id, booking, isStudent && booking.status === "requested", "accepted", "Request accepted", booking.clientProfileId, now),
    decline: () => transition(ctx, actor._id, booking, isStudent && booking.status === "requested", "declined", "Request declined", booking.clientProfileId, now),
    cancel: () => cancelBooking(ctx, actor._id, booking, isClient && ["requested", "accepted"].includes(booking.status), now),
    fund: () => fundBooking(ctx, actor._id, booking, isClient && booking.status === "accepted", now),
    start: () => transition(ctx, actor._id, booking, isStudent && booking.status === "demo_funded", "in_progress", "Work started", booking.clientProfileId, now),
    submit: () => submitDelivery(ctx, actor._id, booking, isStudent && ["in_progress", "revision_requested"].includes(booking.status), args.note, now),
    request_revision: () => requestRevision(ctx, actor._id, booking, isClient && booking.status === "submitted", args.note, now),
    approve: () => approveBooking(ctx, actor._id, booking, isClient && booking.status === "submitted", now),
    review: () => reviewBooking(ctx, actor._id, booking, isClient && booking.status === "completed", args.rating, args.comment, now),
  };
  await handlers[args.action]();
}

async function transition(ctx: MutationCtx, actorId: Id<"profiles">, booking: Doc<"projectBookings">, allowed: boolean, status: "accepted" | "declined" | "in_progress", title: string, recipient: Id<"profiles">, now: number) {
  if (!allowed) throw new Error("This action is not available for the current account or project status.");
  await ctx.db.patch(booking._id, { status, version: booking.version + 1, updatedAt: now, acceptedAt: status === "accepted" ? now : booking.acceptedAt, startedAt: status === "in_progress" ? now : booking.startedAt, lastCommand: status, lastActorProfileId: actorId });
  await notifyBooking(ctx, { recipientProfileId: recipient, bookingId: booking._id, kind: "project", title, detail: booking.title, eventKey: `booking:${booking._id}:${status}:${booking.version + 1}` });
}

async function cancelBooking(ctx: MutationCtx, actorId: Id<"profiles">, booking: Doc<"projectBookings">, allowed: boolean, now: number) {
  if (!allowed) throw new Error("This action is not available for the current account or project status.");
  await ctx.db.patch(booking._id, { status: "cancelled", version: booking.version + 1, updatedAt: now, cancelledAt: now, lastCommand: "cancel", lastActorProfileId: actorId });
  await notifyBooking(ctx, { recipientProfileId: booking.studentProfileId, bookingId: booking._id, kind: "project", title: "Request cancelled", detail: booking.title, eventKey: `booking:${booking._id}:cancelled` });
}

async function fundBooking(ctx: MutationCtx, actorId: Id<"profiles">, booking: Doc<"projectBookings">, allowed: boolean, now: number) {
  if (!allowed) throw new Error("This action is not available for the current account or project status.");
  const prior = await ctx.db.query("ledgerEntries").withIndex("by_booking_type", (q) => q.eq("bookingId", booking._id).eq("type", "hold")).unique();
  if (!prior) await ctx.db.insert("ledgerEntries", { ownerProfileId: booking.clientProfileId, bookingId: booking._id, type: "hold", amount: booking.budget, isSimulated: true, createdAt: now });
  await ctx.db.patch(booking._id, { status: "demo_funded", version: booking.version + 1, updatedAt: now, fundedAt: now, lastCommand: "fund", lastActorProfileId: actorId });
  await notifyBooking(ctx, { recipientProfileId: booking.studentProfileId, bookingId: booking._id, kind: "payment", title: "Demo funds reserved", detail: booking.title, eventKey: `booking:${booking._id}:funded` });
}

async function submitDelivery(ctx: MutationCtx, actorId: Id<"profiles">, booking: Doc<"projectBookings">, allowed: boolean, note: string | undefined, now: number) {
  if (!allowed) throw new Error("This action is not available for the current account or project status.");
  const deliveryNote = assertText(note ?? "", "Delivery note", 3000);
  await ctx.db.patch(booking._id, { status: "submitted", deliveryNote, revisionNote: undefined, version: booking.version + 1, updatedAt: now, submittedAt: now, lastCommand: "submit", lastActorProfileId: actorId });
  await notifyBooking(ctx, { recipientProfileId: booking.clientProfileId, bookingId: booking._id, kind: "project", title: "Delivery submitted", detail: booking.title, eventKey: `booking:${booking._id}:submitted:${booking.version + 1}` });
}

async function requestRevision(ctx: MutationCtx, actorId: Id<"profiles">, booking: Doc<"projectBookings">, allowed: boolean, note: string | undefined, now: number) {
  if (!allowed) throw new Error("This action is not available for the current account or project status.");
  const revisionNote = assertText(note ?? "", "Revision instructions", 3000);
  await ctx.db.patch(booking._id, { status: "revision_requested", revisionNote, version: booking.version + 1, updatedAt: now, revisionRequestedAt: now, lastCommand: "request_revision", lastActorProfileId: actorId });
  await notifyBooking(ctx, { recipientProfileId: booking.studentProfileId, bookingId: booking._id, kind: "project", title: "Revision requested", detail: booking.title, eventKey: `booking:${booking._id}:revision:${booking.version + 1}` });
}

async function approveBooking(ctx: MutationCtx, actorId: Id<"profiles">, booking: Doc<"projectBookings">, allowed: boolean, now: number) {
  if (!allowed) throw new Error("This action is not available for the current account or project status.");
  const prior = await ctx.db.query("ledgerEntries").withIndex("by_booking_type", (q) => q.eq("bookingId", booking._id).eq("type", "release")).unique();
  if (!prior) await ctx.db.insert("ledgerEntries", { ownerProfileId: booking.studentProfileId, bookingId: booking._id, type: "release", amount: booking.budget, isSimulated: true, createdAt: now });
  await ctx.db.patch(booking._id, { status: "completed", version: booking.version + 1, updatedAt: now, completedAt: now, lastCommand: "approve", lastActorProfileId: actorId });
  await notifyBooking(ctx, { recipientProfileId: booking.studentProfileId, bookingId: booking._id, kind: "payment", title: "Project approved", detail: `${booking.title} — simulated earnings released`, eventKey: `booking:${booking._id}:completed` });
}

async function reviewBooking(ctx: MutationCtx, actorId: Id<"profiles">, booking: Doc<"projectBookings">, allowed: boolean, rating: number | undefined, comment: string | undefined, now: number) {
  if (!allowed || !rating || rating < 1 || rating > 5) throw new Error("Choose a rating from 1 to 5.");
  const text = assertText(comment ?? "", "Review", 1500);
  const existing = await ctx.db.query("reviews").withIndex("by_booking", (q) => q.eq("bookingId", booking._id)).unique();
  if (existing) throw new Error("This project has already been reviewed.");
  await ctx.db.insert("reviews", { bookingId: booking._id, clientProfileId: booking.clientProfileId, studentProfileId: booking.studentProfileId, rating, comment: text, createdAt: now });
  await ctx.db.patch(booking._id, { status: "reviewed", version: booking.version + 1, updatedAt: now, reviewedAt: now, lastCommand: "review", lastActorProfileId: actorId });
  await notifyBooking(ctx, { recipientProfileId: booking.studentProfileId, bookingId: booking._id, kind: "complete", title: "New client review", detail: `${rating}/5 for ${booking.title}`, eventKey: `booking:${booking._id}:reviewed` });
}
