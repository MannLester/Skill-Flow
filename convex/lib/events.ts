import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function notifyBooking(ctx: MutationCtx, input: {
  recipientProfileId: Id<"profiles">; bookingId: Id<"projectBookings">; kind: "project" | "message" | "payment" | "complete";
  title: string; detail: string; eventKey: string; seedNamespace?: string; seedVersion?: string;
}) {
  const existing = await ctx.db.query("notifications").withIndex("by_recipient_event", (q) => q.eq("recipientProfileId", input.recipientProfileId).eq("eventKey", input.eventKey)).unique();
  if (existing) return existing._id;
  return await ctx.db.insert("notifications", { ...input, targetType: input.kind === "payment" ? "wallet" : "booking", createdAt: Date.now() });
}

export async function notifyPost(ctx: MutationCtx, input: {
  recipientProfileId: Id<"profiles">; projectPostId: Id<"projectPosts">; title: string; detail: string; eventKey: string;
}) {
  const existing = await ctx.db.query("notifications").withIndex("by_recipient_event", (q) => q.eq("recipientProfileId", input.recipientProfileId).eq("eventKey", input.eventKey)).unique();
  if (existing) return existing._id;
  return await ctx.db.insert("notifications", { ...input, kind: "project", targetType: "post", createdAt: Date.now() });
}
