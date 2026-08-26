import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertText, requireProfile, requireRole } from "./lib/auth";
import { notifyBooking } from "./lib/events";

export const sendMessage = mutation({
  args: { bookingId: v.id("projectBookings"), body: v.string(), sendKey: v.string() }, returns: v.id("projectMessages"),
  handler: async (ctx, args) => {
    const sender = await requireProfile(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking || (sender._id !== booking.clientProfileId && sender._id !== booking.studentProfileId)) throw new Error("Only project participants can send messages.");
    const existing = await ctx.db.query("projectMessages").withIndex("by_booking_sender_key", (q) => q.eq("bookingId", booking._id).eq("senderProfileId", sender._id).eq("sendKey", args.sendKey)).unique();
    if (existing) return existing._id;
    const recipientProfileId = sender._id === booking.clientProfileId ? booking.studentProfileId : booking.clientProfileId;
    const now = Date.now();
    const messageId = await ctx.db.insert("projectMessages", { bookingId: booking._id, senderProfileId: sender._id, recipientProfileId, body: assertText(args.body, "Message", 3000), sendKey: assertText(args.sendKey, "Message key", 120), createdAt: now });
    await notifyBooking(ctx, { recipientProfileId, bookingId: booking._id, kind: "message", title: `${sender.name} sent a message`, detail: args.body.trim().slice(0, 160), eventKey: `message:${messageId}` });
    return messageId;
  },
});

export const markThreadRead = mutation({
  args: { bookingId: v.id("projectBookings") }, returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking || (profile._id !== booking.clientProfileId && profile._id !== booking.studentProfileId)) throw new Error("Only project participants can read this thread.");
    const unread = await ctx.db.query("projectMessages").withIndex("by_booking", (q) => q.eq("bookingId", booking._id)).filter((q) => q.and(q.eq(q.field("recipientProfileId"), profile._id), q.eq(q.field("readAt"), undefined))).take(200);
    const now = Date.now();
    await Promise.all(unread.map((message) => ctx.db.patch(message._id, { readAt: now })));
    const notifications = await ctx.db.query("notifications").withIndex("by_booking", (q) => q.eq("bookingId", booking._id)).filter((q) => q.and(q.eq(q.field("recipientProfileId"), profile._id), q.eq(q.field("kind"), "message"), q.eq(q.field("readAt"), undefined))).take(200);
    await Promise.all(notifications.map((notification) => ctx.db.patch(notification._id, { readAt: now })));
    return null;
  },
});

export const markNotificationRead = mutation({
  args: { notificationId: v.id("notifications") }, returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.recipientProfileId !== profile._id) throw new Error("Notification not found.");
    if (!notification.readAt) await ctx.db.patch(notification._id, { readAt: Date.now() });
    return null;
  },
});

function mentorResponse(body: string) {
  const prompt = body.toLowerCase();
  if (prompt.includes("portfolio")) return "Choose three to four pieces that show different skills. For each one, explain the goal, your design decisions, and the outcome. Lead with your strongest work.";
  if (prompt.includes("color") || prompt.includes("palette")) return "Start with one primary color, one supporting color, and a neutral. Check text contrast, then test the palette in grayscale so hierarchy does not depend on color alone.";
  if (prompt.includes("check") || prompt.includes("review") || prompt.includes("design")) return "Review the design in this order: visual hierarchy, alignment and spacing, contrast, readability, then consistency. Ask one classmate to describe what they notice first.";
  if (prompt.includes("idea") || prompt.includes("project")) return "Turn the idea into a short brief: target user, problem, required deliverables, constraints, and one measurable success criterion. Build the smallest useful first version.";
  return "Break the task into goal, audience, constraints, and next action. If you share those four details, I can provide a more focused deterministic demo response.";
}

export const sendMentorMessage = mutation({
  args: { body: v.string(), turnKey: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const student = await requireRole(ctx, "student");
    const existing = await ctx.db.query("mentorMessages").withIndex("by_student_turn_key", (q) => q.eq("studentProfileId", student._id).eq("turnKey", args.turnKey)).first();
    if (existing) return null;
    const body = assertText(args.body, "Mentor question", 2000);
    const now = Date.now();
    const turnId = `${student._id}:${args.turnKey}`;
    await ctx.db.insert("mentorMessages", { studentProfileId: student._id, turnId, role: "user", sequence: 0, body, turnKey: args.turnKey, createdAt: now });
    await ctx.db.insert("mentorMessages", { studentProfileId: student._id, turnId, role: "mentor", sequence: 1, body: mentorResponse(body), turnKey: args.turnKey, ruleVersion: "deterministic-v1", isSimulated: true, createdAt: now + 1 });
    return null;
  },
});

export const clearMentor = mutation({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    const student = await requireRole(ctx, "student");
    const messages = await ctx.db.query("mentorMessages").withIndex("by_student", (q) => q.eq("studentProfileId", student._id)).take(500);
    await Promise.all(messages.map((message) => ctx.db.delete(message._id)));
    return null;
  },
});
