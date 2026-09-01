import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireProfile } from "./lib/auth";
import { mediaPurpose } from "./schema";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2000;
const INTENT_LIFETIME_MS = 10 * 60 * 1000;
const ORPHAN_LIFETIME_MS = 24 * 60 * 60 * 1000;
const imageContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type MediaTargetId = Doc<"mediaAttachments">["targetId"];
export type MediaTargetType = Doc<"mediaAttachments">["targetType"];
export type MediaPurpose = Doc<"mediaAttachments">["purpose"];
export type MediaVisibility = Doc<"mediaAttachments">["visibility"];
export type AttachmentInput = { uploadedFileId: Id<"uploadedFiles">; altText: string };

export const createUploadIntent = mutation({
  args: { purpose: mediaPurpose },
  returns: v.object({ intentId: v.id("mediaUploadIntents"), uploadUrl: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const owner = await requireProfile(ctx);
    const now = Date.now();
    const expiresAt = now + INTENT_LIFETIME_MS;
    const intentId = await ctx.db.insert("mediaUploadIntents", {
      ownerProfileId: owner._id, purpose: args.purpose, state: "pending", expiresAt, createdAt: now, updatedAt: now,
    });
    return { intentId, uploadUrl: await ctx.storage.generateUploadUrl(), expiresAt };
  },
});

export const finalizeUpload = mutation({
  args: {
    intentId: v.id("mediaUploadIntents"), storageId: v.id("_storage"), width: v.number(), height: v.number(),
    originalName: v.string(), contentType: v.string(), byteSize: v.number(),
  },
  returns: v.id("uploadedFiles"),
  handler: async (ctx, args) => {
    const owner = await requireProfile(ctx);
    const intent = await requireUploadIntent(ctx, args.intentId, owner._id);
    if (intent.state === "finalized" && intent.finalizedFileId) return intent.finalizedFileId;
    if (intent.state !== "pending" || intent.expiresAt < Date.now()) throw new Error("This upload URL has expired. Choose the image again.");
    const { storage, contentType } = await validatedStorageUpload(ctx, args);
    const duplicate = await ctx.db.query("uploadedFiles").withIndex("by_storageId", (q) => q.eq("storageId", args.storageId)).unique();
    if (duplicate) {
      if (duplicate.ownerProfileId !== owner._id) throw new Error("This uploaded file belongs to another account.");
      return duplicate._id;
    }
    const now = Date.now();
    const fileId = await ctx.db.insert("uploadedFiles", {
      storageId: args.storageId, ownerProfileId: owner._id, contentType, byteSize: storage.size,
      width: args.width, height: args.height, originalName: cleanName(args.originalName), linkCount: 0,
      createdAt: now, updatedAt: now, unattachedExpiresAt: now + ORPHAN_LIFETIME_MS,
    });
    await ctx.db.patch(intent._id, { state: "finalized", finalizedFileId: fileId, updatedAt: now });
    await ctx.scheduler.runAfter(ORPHAN_LIFETIME_MS, internal.media.cleanupOrphan, { uploadedFileId: fileId });
    return fileId;
  },
});

async function requireUploadIntent(ctx: MutationCtx, intentId: Id<"mediaUploadIntents">, ownerId: Id<"profiles">) {
  const intent = await ctx.db.get(intentId);
  if (!intent || intent.ownerProfileId !== ownerId) throw new Error("Upload intent not found.");
  return intent;
}

async function validatedStorageUpload(ctx: MutationCtx, args: { storageId: Id<"_storage">; contentType: string; byteSize: number; width: number; height: number }) {
  const storage = await ctx.db.system.get("_storage", args.storageId);
  if (!storage) throw new Error("The uploaded image could not be found.");
  const contentType = storage.contentType ?? args.contentType;
  if (!imageContentTypes.has(contentType)) throw new Error("Use a JPEG, PNG, or WebP image.");
  if (storage.size > MAX_IMAGE_BYTES || args.byteSize > MAX_IMAGE_BYTES) throw new Error("Images must be 5 MB or smaller after processing.");
  if (!validDimension(args.width) || !validDimension(args.height) || Math.max(args.width, args.height) > MAX_IMAGE_EDGE) throw new Error("Images must be no larger than 2000 pixels on the longest edge.");
  return { storage, contentType };
}

export const discardUpload = mutation({
  args: { uploadedFileId: v.id("uploadedFiles") }, returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await requireProfile(ctx);
    const file = await ctx.db.get(args.uploadedFileId);
    if (!file || file.ownerProfileId !== owner._id) throw new Error("Uploaded file not found.");
    if (file.linkCount > 0) throw new Error("Remove this image from its record before discarding it.");
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(file._id);
    return null;
  },
});

export const cleanupOrphan = internalMutation({
  args: { uploadedFileId: v.id("uploadedFiles") }, returns: v.null(),
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.uploadedFileId);
    if (!file || file.linkCount > 0 || !file.unattachedExpiresAt || file.unattachedExpiresAt > Date.now()) return null;
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(file._id);
    return null;
  },
});

export const sweepExpired = internalMutation({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const intents = await ctx.db.query("mediaUploadIntents").withIndex("by_state_and_expiresAt", (q) => q.eq("state", "pending").lt("expiresAt", now)).take(100);
    await Promise.all(intents.map((intent) => ctx.db.patch(intent._id, { state: "expired", updatedAt: now })));
    const files = await ctx.db.query("uploadedFiles").withIndex("by_unattachedExpiresAt", (q) => q.lt("unattachedExpiresAt", now)).take(50);
    for (const file of files) {
      if (file.linkCount === 0) { await ctx.storage.delete(file.storageId); await ctx.db.delete(file._id); }
    }
    return null;
  },
});

export const publicUrls = query({
  args: { attachmentIds: v.array(v.id("mediaAttachments")) },
  returns: v.array(v.object({ attachmentId: v.id("mediaAttachments"), url: v.union(v.string(), v.null()) })),
  handler: async (ctx, args) => {
    if (args.attachmentIds.length > 100) throw new Error("Too many images requested.");
    return await Promise.all(args.attachmentIds.map(async (attachmentId) => {
      const attachment = await ctx.db.get(attachmentId);
      if (!attachment || attachment.visibility !== "public" || !(await targetIsPublic(ctx, attachment))) return { attachmentId, url: null };
      const file = await ctx.db.get(attachment.uploadedFileId);
      return { attachmentId, url: file ? await ctx.storage.getUrl(file.storageId) : null };
    }));
  },
});

export const authorizeDownload = internalQuery({
  args: { attachmentId: v.id("mediaAttachments") }, returns: v.union(v.id("_storage"), v.null()),
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) return null;
    const identity = await ctx.auth.getUserIdentity();
    const profile = identity ? await ctx.db.query("profiles").withIndex("by_auth_token", (q) => q.eq("authTokenIdentifier", identity.tokenIdentifier)).unique() : null;
    const allowed = attachment.visibility === "public" ? await targetIsPublic(ctx, attachment) : Boolean(profile && await canAccessProtected(ctx, profile, attachment));
    if (!allowed) return null;
    const file = await ctx.db.get(attachment.uploadedFileId);
    return file?.storageId ?? null;
  },
});

export async function replaceAttachments(
  ctx: MutationCtx, ownerProfileId: Id<"profiles">, targetType: MediaTargetType, targetId: MediaTargetId,
  purpose: MediaPurpose, visibility: MediaVisibility, inputs: AttachmentInput[], min: number, max: number,
) {
  if (inputs.length < min || inputs.length > max) throw new Error(imageLimitMessage(min, max));
  if (new Set(inputs.map((input) => input.uploadedFileId)).size !== inputs.length) throw new Error("Choose each image only once.");
  const files = await Promise.all(inputs.map((input) => ctx.db.get(input.uploadedFileId)));
  for (const file of files) {
    if (!file || file.ownerProfileId !== ownerProfileId) throw new Error("Every image must belong to the current account.");
  }
  const existing = await ctx.db.query("mediaAttachments")
    .withIndex("by_targetType_and_targetId_and_purpose_and_position", (q) => q.eq("targetType", targetType).eq("targetId", targetId).eq("purpose", purpose))
    .take(max + 20);
  for (const attachment of existing) await unlinkAttachment(ctx, attachment);
  const now = Date.now();
  for (let position = 0; position < inputs.length; position += 1) {
    const input = inputs[position];
    const file = files[position]!;
    await ctx.db.insert("mediaAttachments", {
      uploadedFileId: file._id, ownerProfileId, targetType, targetId, purpose, position,
      altText: cleanAlt(input.altText, purpose), visibility, createdAt: now, updatedAt: now,
    });
    await ctx.db.patch(file._id, { linkCount: file.linkCount + 1, unattachedExpiresAt: undefined, updatedAt: now });
  }
}

export async function copyAttachments(
  ctx: MutationCtx, ownerProfileId: Id<"profiles">, sourceType: MediaTargetType, sourceId: MediaTargetId,
  sourcePurpose: MediaPurpose, targetType: MediaTargetType, targetId: MediaTargetId, targetPurpose: MediaPurpose,
  visibility: MediaVisibility, max: number,
) {
  const source = await ctx.db.query("mediaAttachments")
    .withIndex("by_targetType_and_targetId_and_purpose_and_position", (q) => q.eq("targetType", sourceType).eq("targetId", sourceId).eq("purpose", sourcePurpose))
    .take(max);
  const inputs = source.map((item) => ({ uploadedFileId: item.uploadedFileId, altText: item.altText }));
  if (inputs.length) await replaceAttachments(ctx, ownerProfileId, targetType, targetId, targetPurpose, visibility, inputs, 0, max);
}

export async function requireAttachmentCount(
  ctx: MutationCtx, targetType: MediaTargetType, targetId: MediaTargetId, purpose: MediaPurpose, min: number, max: number,
) {
  const attachments = await ctx.db.query("mediaAttachments")
    .withIndex("by_targetType_and_targetId_and_purpose_and_position", (q) => q.eq("targetType", targetType).eq("targetId", targetId).eq("purpose", purpose))
    .take(max + 1);
  if (attachments.length < min || attachments.length > max) throw new Error(imageLimitMessage(min, max));
}

async function unlinkAttachment(ctx: MutationCtx, attachment: Doc<"mediaAttachments">) {
  const file = await ctx.db.get(attachment.uploadedFileId);
  await ctx.db.delete(attachment._id);
  if (!file) return;
  if (file.linkCount <= 1) {
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(file._id);
  } else {
    await ctx.db.patch(file._id, { linkCount: file.linkCount - 1, updatedAt: Date.now() });
  }
}

async function targetIsPublic(ctx: QueryCtx, attachment: Doc<"mediaAttachments">) {
  if (attachment.targetType === "profile" || attachment.targetType === "portfolio" || attachment.targetType === "certification") return true;
  if (attachment.targetType === "service") return (await ctx.db.get(attachment.targetId as Id<"services">))?.status === "published";
  return false;
}

async function canAccessProtected(ctx: QueryCtx, profile: Doc<"profiles">, attachment: Doc<"mediaAttachments">) {
  if (attachment.ownerProfileId === profile._id) return true;
  if (attachment.targetType === "project_post") return await canReadProjectPost(ctx, profile._id, attachment.targetId as Id<"projectPosts">);
  if (attachment.targetType === "proposal") return await canReadProposal(ctx, profile._id, attachment.targetId as Id<"proposals">);
  if (attachment.targetType === "booking") return await canReadBooking(ctx, profile._id, attachment.targetId as Id<"projectBookings">);
  if (attachment.targetType === "message") return await canReadMessage(ctx, profile._id, attachment.targetId as Id<"projectMessages">);
  return false;
}

async function canReadProjectPost(ctx: QueryCtx, profileId: Id<"profiles">, postId: Id<"projectPosts">) {
  const post = await ctx.db.get(postId);
  return Boolean(post && (post.clientProfileId === profileId || post.status === "open"));
}
async function canReadProposal(ctx: QueryCtx, profileId: Id<"profiles">, proposalId: Id<"proposals">) {
  const proposal = await ctx.db.get(proposalId);
  const post = proposal ? await ctx.db.get(proposal.projectPostId) : null;
  return Boolean(proposal && post && (proposal.studentProfileId === profileId || post.clientProfileId === profileId));
}
async function canReadBooking(ctx: QueryCtx, profileId: Id<"profiles">, bookingId: Id<"projectBookings">) {
  const booking = await ctx.db.get(bookingId);
  return Boolean(booking && (booking.clientProfileId === profileId || booking.studentProfileId === profileId));
}
async function canReadMessage(ctx: QueryCtx, profileId: Id<"profiles">, messageId: Id<"projectMessages">) {
  const message = await ctx.db.get(messageId);
  return message ? await canReadBooking(ctx, profileId, message.bookingId) : false;
}

function validDimension(value: number) { return Number.isInteger(value) && value > 0; }
function cleanName(value: string) { return value.trim().replace(/[\\/]/g, "-").slice(0, 180) || "image"; }
function cleanAlt(value: string, purpose: MediaPurpose) { return value.trim().slice(0, 300) || defaultAlt(purpose); }
function defaultAlt(purpose: MediaPurpose) {
  const labels: Record<MediaPurpose, string> = {
    avatar: "Profile image", portfolio_evidence: "Portfolio work sample", certification_evidence: "Certification evidence",
    verification_sample: "Sample student identification for simulated verification", service_cover: "Service cover image",
    service_gallery: "Service gallery image", project_reference: "Project reference image", booking_reference: "Service request reference image",
    proposal_sample: "Proposal work sample", delivery_image: "Project delivery image", message_image: "Message image attachment",
  };
  return labels[purpose];
}
function imageLimitMessage(min: number, max: number) {
  if (min === max) return `Choose exactly ${min} image${min === 1 ? "" : "s"}.`;
  if (min > 0) return `Choose between ${min} and ${max} images.`;
  return `Choose no more than ${max} images.`;
}
