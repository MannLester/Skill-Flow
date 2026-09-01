import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertPositive, assertText, requireProfile, requireRole } from "./lib/auth";
import { serviceStatus } from "./schema";
import { replaceAttachments, requireAttachmentCount } from "./media";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

type ServiceFields = Pick<Doc<"services">, "ownerProfileId" | "title" | "subtitle" | "category" | "description" | "price" | "deliveryDays" | "revisions" | "status" | "normalizedSearch" | "updatedAt"> & { publishedAt?: number };
type ServiceMedia = { uploadedFileId: Id<"uploadedFiles">; altText: string }[];

const serviceInput = {
  title: v.string(), subtitle: v.string(), category: v.string(), description: v.string(), price: v.number(), deliveryDays: v.number(), revisions: v.string(),
  coverImage: v.optional(v.array(v.object({ uploadedFileId: v.id("uploadedFiles"), altText: v.string() }))),
  galleryImages: v.optional(v.array(v.object({ uploadedFileId: v.id("uploadedFiles"), altText: v.string() }))),
};

export const save = mutation({
  args: { ...serviceInput, publish: v.boolean(), serviceId: v.optional(v.id("services")) }, returns: v.id("services"),
  handler: async (ctx, args) => {
    const owner = await requireRole(ctx, "student");
    if (args.publish) await requireVerifiedStudent(ctx, owner._id);
    const title = assertText(args.title, "Service title", 120);
    const subtitle = assertText(args.subtitle, "Service subtitle", 180);
    const category = assertText(args.category, "Category", 80);
    const description = assertText(args.description, "Description", 2000);
    const revisions = assertText(args.revisions, "Revisions", 80);
    const now = Date.now();
    const fields = {
      ownerProfileId: owner._id, title, subtitle, category, description, price: assertPositive(args.price, "Price"),
      deliveryDays: assertPositive(args.deliveryDays, "Delivery days"), revisions, status: args.publish ? "published" as const : "draft" as const,
      normalizedSearch: `${title} ${subtitle} ${category} ${owner.name}`.toLowerCase(), updatedAt: now,
      publishedAt: args.publish ? now : undefined,
    };
    const serviceId = await persistService(ctx, owner._id, args.serviceId, fields, now);
    await attachServiceMedia(ctx, owner._id, serviceId, args.coverImage, args.galleryImages);
    if (args.publish) await requireAttachmentCount(ctx, "service", serviceId, "service_cover", 1, 1);
    return serviceId;
  },
});

async function requireVerifiedStudent(ctx: MutationCtx, studentId: Id<"profiles">) {
  const verification = await ctx.db.query("studentVerifications").withIndex("by_student", (q) => q.eq("studentProfileId", studentId)).unique();
  if (verification?.status !== "verified") throw new Error("Simulated student verification is required before publishing.");
}

async function persistService(ctx: MutationCtx, ownerId: Id<"profiles">, serviceId: Id<"services"> | undefined, fields: ServiceFields, now: number) {
  if (!serviceId) return await ctx.db.insert("services", { ...fields, createdAt: now });
  const existing = await ctx.db.get(serviceId);
  if (!existing || existing.ownerProfileId !== ownerId) throw new Error("You can only edit your own services.");
  await ctx.db.patch(existing._id, fields);
  return existing._id;
}

async function attachServiceMedia(ctx: MutationCtx, ownerId: Id<"profiles">, serviceId: Id<"services">, cover: ServiceMedia | undefined, gallery: ServiceMedia | undefined) {
  if (cover) await replaceAttachments(ctx, ownerId, "service", serviceId, "service_cover", "public", cover, 0, 1);
  if (gallery) await replaceAttachments(ctx, ownerId, "service", serviceId, "service_gallery", "public", gallery, 0, 4);
}

export const setStatus = mutation({
  args: { serviceId: v.id("services"), status: serviceStatus }, returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await requireRole(ctx, "student");
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.ownerProfileId !== owner._id) throw new Error("You can only update your own services.");
    if (args.status === "published") {
      await requireVerifiedStudent(ctx, owner._id);
      await requireAttachmentCount(ctx, "service", service._id, "service_cover", 1, 1);
    }
    await ctx.db.patch(service._id, { status: args.status, updatedAt: Date.now(), publishedAt: args.status === "published" ? Date.now() : service.publishedAt });
    return null;
  },
});

export const toggleSaved = mutation({
  args: { serviceId: v.id("services") }, returns: v.boolean(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.status !== "published") throw new Error("This service is not available.");
    const existing = await ctx.db.query("savedServices").withIndex("by_profile_service", (q) => q.eq("profileId", profile._id).eq("serviceId", service._id)).unique();
    if (existing) { await ctx.db.delete(existing._id); return false; }
    await ctx.db.insert("savedServices", { profileId: profile._id, serviceId: service._id, createdAt: Date.now() });
    return true;
  },
});
