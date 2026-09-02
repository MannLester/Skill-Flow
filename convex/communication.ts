import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertText, requireProfile } from "./lib/auth";
import { notifyBooking } from "./lib/events";
import { replaceAttachments } from "./media";

const mediaInput = v.object({ uploadedFileId: v.id("uploadedFiles"), altText: v.string() });

export const sendMessage = mutation({
  args: { bookingId: v.id("projectBookings"), body: v.string(), sendKey: v.string(), image: v.optional(mediaInput) }, returns: v.id("projectMessages"),
  handler: async (ctx, args) => {
    const sender = await requireProfile(ctx);
    const booking = await requireMessageBooking(ctx, args.bookingId, sender._id);
    const existing = await ctx.db.query("projectMessages").withIndex("by_booking_sender_key", (q) => q.eq("bookingId", booking._id).eq("senderProfileId", sender._id).eq("sendKey", args.sendKey)).unique();
    if (existing) return existing._id;
    const recipientProfileId = sender._id === booking.clientProfileId ? booking.studentProfileId : booking.clientProfileId;
    const now = Date.now();
    const body = validMessageBody(args.body, Boolean(args.image));
    const messageId = await ctx.db.insert("projectMessages", { bookingId: booking._id, senderProfileId: sender._id, recipientProfileId, body, sendKey: assertText(args.sendKey, "Message key", 120), createdAt: now });
    if (args.image) await replaceAttachments(ctx, sender._id, "message", messageId, "message_image", "participants", [args.image], 1, 1);
    await notifyBooking(ctx, { recipientProfileId, bookingId: booking._id, kind: "message", title: `${sender.name} sent a message`, detail: body.slice(0, 160) || "Image attachment", eventKey: `message:${messageId}` });
    return messageId;
  },
});

async function requireMessageBooking(ctx: import("./_generated/server").MutationCtx, bookingId: import("./_generated/dataModel").Id<"projectBookings">, senderId: import("./_generated/dataModel").Id<"profiles">) {
  const booking = await ctx.db.get(bookingId);
  if (!booking || (senderId !== booking.clientProfileId && senderId !== booking.studentProfileId)) throw new Error("Only project participants can send messages.");
  return booking;
}

function validMessageBody(value: string, hasImage: boolean) {
  const body = value.trim();
  if (!body && !hasImage) throw new Error("Write a message or attach an image.");
  if (body.length > 3000) throw new Error("Message is too long.");
  return body;
}

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
