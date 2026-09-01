import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertText, requireIdentity, requireProfile } from "./lib/auth";
import { role } from "./schema";
import { replaceAttachments } from "./media";

const mediaInput = v.object({ uploadedFileId: v.id("uploadedFiles"), altText: v.string() });

export const current = query({
  args: {}, returns: v.any(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db.query("profiles").withIndex("by_auth_token", (q) => q.eq("authTokenIdentifier", identity.tokenIdentifier)).unique();
  },
});

export const completeOnboarding = mutation({
  args: { role, name: v.string() }, returns: v.id("profiles"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db.query("profiles").withIndex("by_auth_token", (q) => q.eq("authTokenIdentifier", identity.tokenIdentifier)).unique();
    if (existing) {
      if (existing.role !== args.role) throw new Error("Your SkillFlow role is already assigned.");
      return existing._id;
    }
    const now = Date.now();
    const profileId = await ctx.db.insert("profiles", {
      authTokenIdentifier: identity.tokenIdentifier, role: args.role, name: assertText(args.name, "Display name", 80),
      bio: "", location: "", skills: [], createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("preferences", { profileId, notificationBadgesEnabled: true, language: "en", settingsDarkMode: false, schemaVersion: 1, revision: 1, createdAt: now, updatedAt: now });
    if (args.role === "student") {
      await ctx.db.insert("studentVerifications", { studentProfileId: profileId, status: "not_submitted", school: "", studentNumberMasked: "", program: "", gradeLevel: "", version: 1, isSimulated: true, updatedAt: now });
    }
    return profileId;
  },
});

export const update = mutation({
  args: {
    name: v.string(), bio: v.string(), location: v.string(), organization: v.optional(v.string()), school: v.optional(v.string()),
    program: v.optional(v.string()), gradeLevel: v.optional(v.string()), graduationYear: v.optional(v.number()), skills: v.array(v.string()),
    avatar: v.optional(v.array(mediaInput)),
  }, returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx);
    await ctx.db.patch(profile._id, {
      name: assertText(args.name, "Profile name", 80), bio: args.bio.trim().slice(0, 1000), location: args.location.trim().slice(0, 120),
      organization: args.organization?.trim().slice(0, 120), school: args.school?.trim().slice(0, 160), program: args.program?.trim().slice(0, 120),
      gradeLevel: args.gradeLevel?.trim().slice(0, 80), graduationYear: args.graduationYear,
      skills: args.skills.map((skill) => skill.trim()).filter(Boolean).slice(0, 20), updatedAt: Date.now(),
    });
    if (args.avatar) await replaceAttachments(ctx, profile._id, "profile", profile._id, "avatar", "public", args.avatar, 0, 1);
    return null;
  },
});
