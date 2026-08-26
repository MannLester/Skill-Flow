import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertText, requireProfile, requireRole } from "./lib/auth";

export const submitVerification = mutation({
  args: { school: v.string(), studentNumber: v.string(), program: v.string(), gradeLevel: v.string(), graduationYear: v.optional(v.number()), sampleDocumentName: v.optional(v.string()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const student = await requireRole(ctx, "student");
    const normalized = args.studentNumber.replace(/\s/g, "");
    if (normalized.length < 6) throw new Error("Enter a student number with at least 6 characters.");
    const current = await ctx.db.query("studentVerifications").withIndex("by_student", (q) => q.eq("studentProfileId", student._id)).unique();
    const now = Date.now();
    const fields = { status: "pending" as const, school: assertText(args.school, "School", 160), studentNumberMasked: `${normalized.slice(0, 4)}-****-${normalized.slice(-4)}`, program: assertText(args.program, "Program", 120), gradeLevel: assertText(args.gradeLevel, "Grade level", 80), graduationYear: args.graduationYear, sampleDocumentName: assertText(args.sampleDocumentName ?? "", "Sample student ID", 160), version: (current?.version ?? 0) + 1, isSimulated: true as const, submittedAt: now, reviewedAt: undefined, rejectionReason: undefined, updatedAt: now };
    if (current) await ctx.db.patch(current._id, fields); else await ctx.db.insert("studentVerifications", { studentProfileId: student._id, ...fields });
    await ctx.db.patch(student._id, { school: fields.school, program: fields.program, gradeLevel: fields.gradeLevel, graduationYear: fields.graduationYear, updatedAt: now });
    return null;
  },
});

export const simulateVerificationReview = mutation({
  args: { approved: v.boolean(), rejectionReason: v.optional(v.string()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const student = await requireRole(ctx, "student");
    const current = await ctx.db.query("studentVerifications").withIndex("by_student", (q) => q.eq("studentProfileId", student._id)).unique();
    if (!current || current.status !== "pending") throw new Error("Submit verification before running the simulated review.");
    if (!args.approved && !args.rejectionReason?.trim()) throw new Error("Select a simulated rejection reason.");
    await ctx.db.patch(current._id, { status: args.approved ? "verified" : "rejected", rejectionReason: args.approved ? undefined : args.rejectionReason?.trim().slice(0, 500), reviewedAt: Date.now(), updatedAt: Date.now(), version: current.version + 1 });
    return null;
  },
});

export const addPortfolio = mutation({
  args: { title: v.string(), description: v.string(), category: v.string(), sourceBookingId: v.optional(v.id("projectBookings")), idempotencyKey: v.string() }, returns: v.id("portfolioItems"),
  handler: async (ctx, args) => {
    const student = await requireRole(ctx, "student");
    const existing = await ctx.db.query("portfolioItems").withIndex("by_student_key", (q) => q.eq("studentProfileId", student._id).eq("idempotencyKey", args.idempotencyKey)).unique();
    if (existing) return existing._id;
    if (args.sourceBookingId) {
      const booking = await ctx.db.get(args.sourceBookingId);
      if (!booking || booking.studentProfileId !== student._id || (booking.status !== "completed" && booking.status !== "reviewed")) throw new Error("Only your completed projects can be added to the portfolio.");
      const source = await ctx.db.query("portfolioItems").withIndex("by_source_booking", (q) => q.eq("sourceBookingId", booking._id)).unique();
      if (source) return source._id;
    }
    const now = Date.now();
    return await ctx.db.insert("portfolioItems", { studentProfileId: student._id, sourceKind: args.sourceBookingId ? "completed_booking" : "manual", sourceBookingId: args.sourceBookingId, title: assertText(args.title, "Portfolio title", 140), description: assertText(args.description, "Description", 2000), category: assertText(args.category, "Category", 80), idempotencyKey: assertText(args.idempotencyKey, "Idempotency key", 120), createdAt: now, updatedAt: now });
  },
});

export const addCertification = mutation({
  args: { name: v.string(), issuer: v.string(), year: v.number(), idempotencyKey: v.string() }, returns: v.id("certifications"),
  handler: async (ctx, args) => {
    const student = await requireRole(ctx, "student");
    if (!Number.isInteger(args.year) || args.year < 2000 || args.year > 2100) throw new Error("Enter a valid certification year.");
    const existing = await ctx.db.query("certifications").withIndex("by_student_key", (q) => q.eq("studentProfileId", student._id).eq("idempotencyKey", args.idempotencyKey)).unique();
    if (existing) return existing._id;
    const now = Date.now();
    return await ctx.db.insert("certifications", { studentProfileId: student._id, name: assertText(args.name, "Certification", 160), issuer: assertText(args.issuer, "Issuer", 160), year: args.year, idempotencyKey: assertText(args.idempotencyKey, "Idempotency key", 120), createdAt: now, updatedAt: now });
  },
});

export const updatePreferences = mutation({
  args: { notificationBadgesEnabled: v.optional(v.boolean()), settingsDarkMode: v.optional(v.boolean()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    const current = await ctx.db.query("preferences").withIndex("by_profile", (q) => q.eq("profileId", profile._id)).unique();
    const now = Date.now();
    if (current) await ctx.db.patch(current._id, { notificationBadgesEnabled: args.notificationBadgesEnabled ?? current.notificationBadgesEnabled, settingsDarkMode: args.settingsDarkMode ?? current.settingsDarkMode, revision: current.revision + 1, updatedAt: now });
    else await ctx.db.insert("preferences", { profileId: profile._id, notificationBadgesEnabled: args.notificationBadgesEnabled ?? true, settingsDarkMode: args.settingsDarkMode ?? false, language: "en", schemaVersion: 1, revision: 1, createdAt: now, updatedAt: now });
    return null;
  },
});
