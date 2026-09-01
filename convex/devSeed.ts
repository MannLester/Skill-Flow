import { v } from "convex/values";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { mediaPurpose, mediaTargetType } from "./schema";

const namespace = "skillflow-foundation";
const version = "v1";
const operatorToken = "skillflow.dev.operator|seed";

const seedFields = (seedKey: string) => ({ seedNamespace: namespace, seedVersion: version, seedKey });
const time = (date: string) => Date.parse(date);

async function requireDevelopmentOperator(ctx: QueryCtx | MutationCtx) {
  if (process.env.SKILLFLOW_DEPLOYMENT_CLASS !== "cloud-development") throw new Error("Seed operations are disabled outside cloud development.");
  const identity = await ctx.auth.getUserIdentity();
  if (identity?.tokenIdentifier !== operatorToken) throw new Error("Convex CLI development-operator identity required.");
}

function seeded<T extends TableNames>(ctx: QueryCtx | MutationCtx, table: T) {
  return ctx.db.query(table).withIndex("by_seed", (q) => q.eq("seedNamespace", namespace as never)).take(500);
}

async function countSeeded(ctx: QueryCtx) {
  const groups = await Promise.all([
    seeded(ctx, "profiles"), seeded(ctx, "services"), seeded(ctx, "projectPosts"), seeded(ctx, "savedServices"),
    seeded(ctx, "portfolioItems"), seeded(ctx, "certifications"), seeded(ctx, "projectBookings"), seeded(ctx, "proposals"),
    seeded(ctx, "projectMessages"), seeded(ctx, "notifications"), seeded(ctx, "ledgerEntries"), seeded(ctx, "reviews"),
    seeded(ctx, "mentorMessages"), seeded(ctx, "studentVerifications"), seeded(ctx, "preferences"),
    seeded(ctx, "mediaAttachments"), seeded(ctx, "uploadedFiles"),
  ]);
  return groups.reduce((total, rows) => total + rows.length, 0);
}

export const preview = query({
  args: {},
  returns: v.object({ namespace: v.string(), version: v.string(), records: v.number() }),
  handler: async (ctx) => {
    await requireDevelopmentOperator(ctx);
    return { namespace, version, records: await countSeeded(ctx) };
  },
});

export const candidates = query({
  args: {},
  returns: v.array(v.object({ profileId: v.id("profiles"), name: v.string(), role: v.union(v.literal("student"), v.literal("client")) })),
  handler: async (ctx) => {
    await requireDevelopmentOperator(ctx);
    const profiles = await ctx.db.query("profiles").take(50);
    return profiles.filter((profile) => !profile.seedNamespace).map((profile) => ({ profileId: profile._id, name: profile.name, role: profile.role }));
  },
});

export const apply = mutation({
  args: { studentProfileId: v.id("profiles"), clientProfileId: v.id("profiles") },
  returns: v.object({ namespace: v.string(), version: v.string(), records: v.number() }),
  handler: async (ctx, args) => {
    await requireDevelopmentOperator(ctx);
    const student = await ctx.db.get(args.studentProfileId);
    const client = await ctx.db.get(args.clientProfileId);
    if (!student || student.role !== "student" || student.seedNamespace) throw new Error("Choose a live Student Designer profile.");
    if (!client || client.role !== "client" || client.seedNamespace) throw new Error("Choose a live Client profile.");

    const now = Date.now();
    const [maya, nico, youthCouncil] = await Promise.all([
      upsertSeedProfile(ctx, "profile-maya", {
        role: "student", name: "Maya S.", bio: "Senior High School Student Designer focused on social-media visuals and clean poster systems.",
        location: "Batangas City", school: "Batangas State University TNEU", program: "Arts and Design",
        gradeLevel: "Grade 12", graduationYear: 2027, skills: ["Poster Design", "Social Media Design", "Branding"],
      }, now),
      upsertSeedProfile(ctx, "profile-nico", {
        role: "student", name: "Nico V.", bio: "Student Designer building practical mobile UI studies and presentation decks for campus groups.",
        location: "Lipa City", school: "STI College Lipa", program: "ICT", gradeLevel: "Grade 12",
        graduationYear: 2027, skills: ["UI/UX", "Presentation Design", "Prototyping"],
      }, now),
      upsertSeedProfile(ctx, "profile-youth-council", {
        role: "client", name: "Harbor Youth Council", bio: "Fictional community organization commissioning student-friendly creative work.",
        location: "Batangas City", organization: "Harbor Youth Council", skills: [],
      }, now),
    ]);

    await Promise.all([student, maya, nico].map((profile, index) => upsertVerification(ctx, profile._id, `verification-${index}`, now)));

    const [logo, , poster] = await Promise.all([
      upsertService(ctx, student._id, "service-logo", {
        title: "Logo Design", subtitle: "Focused identity for a growing local brand", category: "Graphics & Design",
        description: "A clearly scoped logo-design package with two concepts, revision support, and presentation files.",
        price: 1500, deliveryDays: 3, revisions: "2 revisions", assetKey: "logo",
      }, now),
      upsertService(ctx, student._id, "service-ui", {
        title: "Mobile UI Design", subtitle: "Practical mobile screens for small services", category: "Web & App",
        description: "Five mobile app screens with component direction, spacing notes, and a clickable prototype plan.",
        price: 2000, deliveryDays: 5, revisions: "2 revisions", assetKey: "uiux",
      }, now),
      upsertService(ctx, maya._id, "service-event-poster", {
        title: "Campus Event Poster Set", subtitle: "Print and social layouts for school events", category: "Graphics & Design",
        description: "A coordinated poster, story, and square-post set for a fictional school or community event.",
        price: 1200, deliveryDays: 4, revisions: "2 revisions", assetKey: "poster",
      }, now),
      upsertService(ctx, maya._id, "service-social-kit", {
        title: "Social Media Kit", subtitle: "Reusable launch graphics for small campaigns", category: "Graphics & Design",
        description: "Six editable announcement graphics with a consistent color and typography direction.",
        price: 1800, deliveryDays: 5, revisions: "3 revisions", assetKey: "illustration",
      }, now),
      upsertService(ctx, nico._id, "service-presentation", {
        title: "Presentation Design", subtitle: "Clear academic or pitch decks", category: "Web & App",
        description: "A polished 10-slide deck structure for class reports, pitches, or organization proposals.",
        price: 1400, deliveryDays: 3, revisions: "2 revisions", assetKey: "uiux",
      }, now),
    ]);

    const [postUi, postPoster, postBrand] = await Promise.all([
      upsertPost(ctx, client._id, "post-mobile-ui", {
        title: "Mobile Ordering UI Design", description: "Create a polished mobile ordering experience for a fictional neighborhood cafe, including five key screens and a reusable visual system.",
        category: "Web & App", budget: 2200, deadline: "2026-10-15", skills: ["UI/UX", "Mobile Design", "Prototyping"], status: "open",
      }, now),
      upsertPost(ctx, client._id, "post-event-poster", {
        title: "Youth Workshop Poster Set", description: "Design print and social posters for a fictional weekend workshop series for Senior High School students.",
        category: "Graphics & Design", budget: 1600, deadline: "2026-09-28", skills: ["Poster Design", "Layout", "Social Media Design"], status: "open",
      }, now),
      upsertPost(ctx, youthCouncil._id, "post-brand-refresh", {
        title: "Student Org Brand Refresh", description: "Refresh a fictional youth council identity with a simple logo direction, color palette, and social avatar.",
        category: "Graphics & Design", budget: 1900, deadline: "2026-10-05", skills: ["Branding", "Logo Design"], status: "open",
      }, now),
      upsertPost(ctx, youthCouncil._id, "post-menu-layout", {
        title: "Community Fair Menu Layout", description: "Create a readable one-page menu layout for a fictional community fair food booth.",
        category: "Graphics & Design", budget: 1000, deadline: "2026-09-20", skills: ["Layout", "Typography"], status: "open",
      }, now),
    ]);

    await Promise.all([
      upsertSaved(ctx, client._id, logo, "saved-logo", now),
      upsertSaved(ctx, client._id, poster, "saved-poster", now),
      upsertProposal(ctx, postUi, nico._id, "proposal-ui-nico", "I can map the cafe ordering flow, build five clean mobile screens, and include notes your developer can follow.", 2000, 5, "submitted", now),
      upsertProposal(ctx, postPoster, maya._id, "proposal-poster-maya", "I will prepare matching print and social poster layouts with a consistent youth-workshop visual direction.", 1500, 4, "submitted", now),
      upsertProposal(ctx, postBrand, student._id, "proposal-brand-live-student", "I can create a compact brand refresh with logo options, colors, and avatar exports for the council pages.", 1800, 4, "submitted", now),
      upsertPortfolio(ctx, student._id, "portfolio-brand-study", "Coffee Shop Brand Study", "A fictional identity study showing logo exploration, color rationale, and presentation layout.", "Graphics & Design", undefined, "logo", now),
      upsertPortfolio(ctx, maya._id, "portfolio-workshop-posters", "Workshop Poster System", "A coordinated poster set for a fictional student workshop campaign.", "Graphics & Design", undefined, "poster", now),
      upsertPortfolio(ctx, nico._id, "portfolio-ordering-ui", "Mobile Ordering UI Study", "A practical five-screen ordering flow prepared for a small cafe concept.", "Web & App", undefined, "uiux", now),
      upsertCertification(ctx, student._id, "cert-design", "Introduction to Graphic Design", "SkillFlow Demo Academy", 2026, now),
      upsertCertification(ctx, maya._id, "cert-layout", "Poster Layout Fundamentals", "SkillFlow Demo Academy", 2026, now),
      upsertCertification(ctx, nico._id, "cert-ui", "Mobile UI Basics", "SkillFlow Demo Academy", 2026, now),
    ]);

    const activeBooking = await upsertBooking(ctx, client._id, student._id, "booking-active-logo", {
      source: "service_request", serviceId: logo, title: "Cafe Loyalty Logo", description: "Create a friendly logo mark for a fictional cafe loyalty-card program.",
      category: "Graphics & Design", deliveryDays: 3, revisions: "2 revisions", budget: 1500, status: "demo_funded",
      acceptedAt: time("2026-08-24T09:00:00.000Z"), fundedAt: time("2026-08-25T10:00:00.000Z"), lastCommand: "fund",
    }, now);
    const reviewedBooking = await upsertBooking(ctx, client._id, student._id, "booking-reviewed-menu", {
      source: "service_request", serviceId: logo, title: "Mini Menu Logo Polish", description: "Polish a simple mark for a fictional weekend menu board.",
      category: "Graphics & Design", deliveryDays: 2, revisions: "1 revision", budget: 900, status: "reviewed",
      deliveryNote: "Final logo files and usage notes are ready for the simulated handoff.",
      acceptedAt: time("2026-08-10T09:00:00.000Z"), fundedAt: time("2026-08-10T11:00:00.000Z"),
      startedAt: time("2026-08-11T09:00:00.000Z"), submittedAt: time("2026-08-12T15:00:00.000Z"),
      completedAt: time("2026-08-13T16:00:00.000Z"), reviewedAt: time("2026-08-14T10:00:00.000Z"), lastCommand: "review",
    }, now);

    await Promise.all([
      upsertLedger(ctx, client._id, activeBooking, "hold", 1500, "ledger-active-hold", time("2026-08-25T10:00:00.000Z")),
      upsertLedger(ctx, student._id, reviewedBooking, "release", 900, "ledger-reviewed-release", time("2026-08-13T16:00:00.000Z")),
      upsertReview(ctx, reviewedBooking, client._id, student._id, "review-menu", 5, "The Student Designer delivered clean logo files and explained the design choices clearly.", time("2026-08-14T10:00:00.000Z")),
      upsertMessage(ctx, activeBooking, client._id, student._id, "message-active-1", "Thanks for accepting this simulated logo request. Please keep the loyalty-card use case in mind.", time("2026-08-25T10:20:00.000Z")),
      upsertMessage(ctx, activeBooking, student._id, client._id, "message-active-2", "Noted. I will send two logo directions before preparing the final preview.", time("2026-08-25T11:05:00.000Z")),
      upsertMessage(ctx, reviewedBooking, student._id, client._id, "message-reviewed-1", "Final logo files and a short usage note are ready for review.", time("2026-08-12T15:05:00.000Z"), time("2026-08-14T09:30:00.000Z")),
      upsertPortfolio(ctx, student._id, "portfolio-menu-polish", "Mini Menu Logo Polish", "Completed simulated client work with final files, usage notes, and review evidence.", "Completed Client Project", reviewedBooking, "logo", now),
      upsertMentor(ctx, student._id, "mentor-portfolio", "How can I present this logo project in my portfolio?", "Show the goal, two design decisions, and the final outcome. Add the client constraint and one lesson learned.", time("2026-08-26T08:30:00.000Z")),
      upsertMentor(ctx, student._id, "mentor-colors", "Can you review my color direction?", "Check contrast first, then test the palette on the logo, menu board, and small avatar before finalizing.", time("2026-08-26T08:34:00.000Z")),
      upsertPreference(ctx, client._id, "preference-client", now),
      upsertPreference(ctx, student._id, "preference-student", now),
    ]);

    await Promise.all([
      upsertNotification(ctx, student._id, "project", "Demo funds reserved", "Cafe Loyalty Logo", "booking", "notification-active-funded", time("2026-08-25T10:00:00.000Z"), activeBooking),
      upsertNotification(ctx, client._id, "message", `${student.name} sent a message`, "Noted. I will send two logo directions before preparing the final preview.", "booking", "notification-active-message", time("2026-08-25T11:05:00.000Z"), activeBooking),
      upsertNotification(ctx, student._id, "complete", "New client review", "5/5 for Mini Menu Logo Polish", "booking", "notification-reviewed", time("2026-08-14T10:00:00.000Z"), reviewedBooking, undefined, time("2026-08-15T08:00:00.000Z")),
      upsertNotification(ctx, client._id, "project", "New project proposal", "Nico V. proposed for Mobile Ordering UI Design", "post", "notification-proposal-ui", time("2026-08-26T13:00:00.000Z"), undefined, postUi),
      upsertNotification(ctx, client._id, "project", "New project proposal", "Maya S. proposed for Youth Workshop Poster Set", "post", "notification-proposal-poster", time("2026-08-27T09:00:00.000Z"), undefined, postPoster),
    ]);

    return { namespace, version, records: await countSeeded(ctx) };
  },
});

export const reset = mutation({
  args: { confirmation: v.literal("RESET skillflow-foundation:v1") },
  returns: v.object({ namespace: v.string(), deleted: v.number() }),
  handler: async (ctx) => {
    await requireDevelopmentOperator(ctx);
    const mediaAttachments = await seeded(ctx, "mediaAttachments");
    for (const attachment of mediaAttachments) await ctx.db.delete(attachment._id);
    const mediaFiles = await seeded(ctx, "uploadedFiles");
    for (const file of mediaFiles) { await ctx.storage.delete(file.storageId); await ctx.db.delete(file._id); }
    const groups = await Promise.all([
      seeded(ctx, "projectMessages"), seeded(ctx, "notifications"), seeded(ctx, "ledgerEntries"), seeded(ctx, "reviews"),
      seeded(ctx, "mentorMessages"), seeded(ctx, "savedServices"), seeded(ctx, "portfolioItems"), seeded(ctx, "certifications"),
      seeded(ctx, "projectBookings"), seeded(ctx, "proposals"), seeded(ctx, "projectPosts"), seeded(ctx, "services"),
      seeded(ctx, "preferences"),
    ]);
    for (const rows of groups) for (const row of rows) await ctx.db.delete(row._id);
    const verifications = await seeded(ctx, "studentVerifications");
    for (const item of verifications) {
      const profile = await ctx.db.get(item.studentProfileId);
      if (profile?.seedNamespace === namespace) await ctx.db.delete(item._id);
      else await ctx.db.patch(item._id, {
        status: "not_submitted", school: "", studentNumberMasked: "", program: "", gradeLevel: "",
        graduationYear: undefined, sampleDocumentName: undefined, rejectionReason: undefined, submittedAt: undefined,
        reviewedAt: undefined, seedNamespace: undefined, seedVersion: undefined, seedKey: undefined,
        version: item.version + 1, updatedAt: Date.now(),
      });
    }
    const profiles = await seeded(ctx, "profiles");
    for (const profile of profiles) await ctx.db.delete(profile._id);
    return { namespace, deleted: groups.reduce((total, rows) => total + rows.length, 0) + verifications.length + profiles.length + mediaAttachments.length + mediaFiles.length };
  },
});

export const createMediaUpload = mutation({
  args: {}, returns: v.string(),
  handler: async (ctx) => {
    await requireDevelopmentOperator(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const finalizeMediaUpload = mutation({
  args: {
    storageId: v.id("_storage"), ownerSeedKey: v.string(), targetType: mediaTargetType, targetSeedKey: v.string(),
    purpose: mediaPurpose, position: v.number(), altText: v.string(), originalName: v.string(), width: v.number(), height: v.number(),
  },
  returns: v.id("mediaAttachments"),
  handler: async (ctx, args) => {
    await requireDevelopmentOperator(ctx);
    const owner = await ctx.db.query("profiles").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", args.ownerSeedKey)).unique();
    if (!owner) throw new Error("Seed media owner not found.");
    const targetId = await seedMediaTarget(ctx, args.targetType, args.targetSeedKey);
    const attachmentKey = `media-attachment-${args.targetType}-${args.targetSeedKey}-${args.purpose}-${args.position}`;
    const existing = await ctx.db.query("mediaAttachments").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", attachmentKey)).unique();
    if (existing) { await ctx.storage.delete(args.storageId); return existing._id; }
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (!metadata?.contentType?.startsWith("image/") || metadata.size > 5 * 1024 * 1024) throw new Error("Seed media must be an image no larger than 5 MB.");
    const fileKey = `media-file-${args.targetType}-${args.targetSeedKey}-${args.purpose}-${args.position}`;
    const now = Date.now();
    const uploadedFileId = await ctx.db.insert("uploadedFiles", { storageId: args.storageId, ownerProfileId: owner._id, contentType: metadata.contentType, byteSize: metadata.size, width: args.width, height: args.height, originalName: args.originalName, linkCount: 1, createdAt: now, updatedAt: now, ...seedFields(fileKey) });
    return await ctx.db.insert("mediaAttachments", { uploadedFileId, ownerProfileId: owner._id, targetType: args.targetType, targetId, purpose: args.purpose, position: args.position, altText: args.altText, visibility: "public", createdAt: now, updatedAt: now, ...seedFields(attachmentKey) });
  },
});

async function seedMediaTarget(ctx: MutationCtx, targetType: Doc<"mediaAttachments">["targetType"], seedKey: string): Promise<Doc<"mediaAttachments">["targetId"]> {
  if (targetType === "profile") return requiredTargetId(await ctx.db.query("profiles").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", seedKey)).unique(), seedKey);
  if (targetType === "service") return requiredTargetId(await ctx.db.query("services").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", seedKey)).unique(), seedKey);
  if (targetType === "portfolio") return requiredTargetId(await ctx.db.query("portfolioItems").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", seedKey)).unique(), seedKey);
  if (targetType === "certification") return requiredTargetId(await ctx.db.query("certifications").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", seedKey)).unique(), seedKey);
  throw new Error("Seed media supports only public demo targets.");
}

function requiredTargetId<T extends Doc<"profiles"> | Doc<"services"> | Doc<"portfolioItems"> | Doc<"certifications">>(target: T | null, seedKey: string) {
  if (!target) throw new Error(`Seed media target not found: ${seedKey}`);
  return target._id;
}

type SeedProfile = Omit<Doc<"profiles">, "_id" | "_creationTime" | "authTokenIdentifier" | "createdAt" | "updatedAt" | "seedNamespace" | "seedVersion" | "seedKey">;

async function upsertSeedProfile(ctx: MutationCtx, key: string, input: SeedProfile, now: number) {
  const existing = await ctx.db.query("profiles").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  const fields = { ...input, updatedAt: now, ...seedFields(key) };
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return existing;
  }
  const profileId = await ctx.db.insert("profiles", { ...fields, createdAt: now });
  const profile = await ctx.db.get(profileId);
  if (!profile) throw new Error("Seed profile insert failed.");
  return profile;
}

async function upsertVerification(ctx: MutationCtx, studentProfileId: Id<"profiles">, key: string, now: number) {
  const existing = await ctx.db.query("studentVerifications").withIndex("by_student", (q) => q.eq("studentProfileId", studentProfileId)).unique();
  const fields = {
    status: "verified" as const, school: "Batangas State University TNEU", studentNumberMasked: "DEMO-****-2026",
    program: "Senior High School", gradeLevel: "Grade 12", graduationYear: 2027, sampleDocumentName: "Simulated demo student ID",
    isSimulated: true as const, submittedAt: time("2026-08-01T00:00:00.000Z"), reviewedAt: now, updatedAt: now, ...seedFields(key),
  };
  if (existing) await ctx.db.patch(existing._id, { ...fields, version: existing.version + 1 });
  else await ctx.db.insert("studentVerifications", { studentProfileId, ...fields, version: 1 });
}

type ServiceSeed = { title: string; subtitle: string; category: string; description: string; price: number; deliveryDays: number; revisions: string; assetKey: string };
async function upsertService(ctx: MutationCtx, ownerProfileId: Id<"profiles">, key: string, input: ServiceSeed, now: number) {
  const existing = await ctx.db.query("services").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  const fields = { ownerProfileId, ...input, status: "published" as const, normalizedSearch: `${input.title} ${input.subtitle} ${input.category} ${input.description}`.toLowerCase(), updatedAt: now, publishedAt: now, ...seedFields(key) };
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return existing._id;
  }
  return await ctx.db.insert("services", { ...fields, createdAt: now });
}

type PostSeed = { title: string; description: string; category: string; budget: number; deadline: string; skills: string[]; status: "open" | "draft" };
async function upsertPost(ctx: MutationCtx, clientProfileId: Id<"profiles">, key: string, input: PostSeed, now: number) {
  const existing = await ctx.db.query("projectPosts").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  const fields = {
    clientProfileId, ...input, deadlineEpoch: Date.parse(input.deadline),
    normalizedSearch: `${input.title} ${input.description} ${input.category} ${input.skills.join(" ")}`.toLowerCase(),
    updatedAt: now, openedAt: input.status === "open" ? now : undefined, ...seedFields(key),
  };
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return existing._id;
  }
  return await ctx.db.insert("projectPosts", { ...fields, createdAt: now });
}

async function upsertSaved(ctx: MutationCtx, profileId: Id<"profiles">, serviceId: Id<"services">, key: string, now: number) {
  const existing = await ctx.db.query("savedServices").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  if (!existing) await ctx.db.insert("savedServices", { profileId, serviceId, createdAt: now, ...seedFields(key) });
}

async function upsertProposal(ctx: MutationCtx, projectPostId: Id<"projectPosts">, studentProfileId: Id<"profiles">, key: string, coverLetter: string, amount: number, deliveryDays: number, status: "submitted", now: number) {
  const existing = await ctx.db.query("proposals").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  const fields = { projectPostId, studentProfileId, coverLetter, amount, deliveryDays, status, updatedAt: now, ...seedFields(key) };
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("proposals", { ...fields, createdAt: now });
}

type BookingSeed = {
  source: "service_request"; serviceId: Id<"services">; title: string; description: string; category: string; deliveryDays: number;
  revisions: string; budget: number; status: Doc<"projectBookings">["status"]; deliveryNote?: string; acceptedAt?: number; fundedAt?: number;
  startedAt?: number; submittedAt?: number; completedAt?: number; reviewedAt?: number; lastCommand: string;
};
async function upsertBooking(ctx: MutationCtx, clientProfileId: Id<"profiles">, studentProfileId: Id<"profiles">, key: string, input: BookingSeed, now: number) {
  const existing = await ctx.db.query("projectBookings").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  const fields = { clientProfileId, studentProfileId, requestKey: key, version: existing ? existing.version + 1 : 1, updatedAt: now, lastActorProfileId: clientProfileId, ...input, ...seedFields(key) };
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return existing._id;
  }
  return await ctx.db.insert("projectBookings", { ...fields, createdAt: now });
}

async function upsertLedger(ctx: MutationCtx, ownerProfileId: Id<"profiles">, bookingId: Id<"projectBookings">, type: "hold" | "release", amount: number, key: string, createdAt: number) {
  const existing = await ctx.db.query("ledgerEntries").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  if (existing) await ctx.db.patch(existing._id, { ownerProfileId, bookingId, type, amount, isSimulated: true as const, createdAt, ...seedFields(key) });
  else await ctx.db.insert("ledgerEntries", { ownerProfileId, bookingId, type, amount, isSimulated: true, createdAt, ...seedFields(key) });
}

async function upsertReview(ctx: MutationCtx, bookingId: Id<"projectBookings">, clientProfileId: Id<"profiles">, studentProfileId: Id<"profiles">, key: string, rating: number, comment: string, createdAt: number) {
  const existing = await ctx.db.query("reviews").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  const fields = { bookingId, clientProfileId, studentProfileId, rating, comment, createdAt, ...seedFields(key) };
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("reviews", fields);
}

async function upsertMessage(ctx: MutationCtx, bookingId: Id<"projectBookings">, senderProfileId: Id<"profiles">, recipientProfileId: Id<"profiles">, key: string, body: string, createdAt: number, readAt?: number) {
  const existing = await ctx.db.query("projectMessages").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  const fields = { bookingId, senderProfileId, recipientProfileId, body, sendKey: key, createdAt, readAt, ...seedFields(key) };
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("projectMessages", fields);
}

async function upsertNotification(ctx: MutationCtx, recipientProfileId: Id<"profiles">, kind: Doc<"notifications">["kind"], title: string, detail: string, targetType: Doc<"notifications">["targetType"], key: string, createdAt: number, bookingId?: Id<"projectBookings">, projectPostId?: Id<"projectPosts">, readAt?: number) {
  const existing = await ctx.db.query("notifications").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  const fields = { recipientProfileId, kind, title, detail, eventKey: key, targetType, bookingId, projectPostId, createdAt, readAt, ...seedFields(key) };
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("notifications", fields);
}

async function upsertPortfolio(ctx: MutationCtx, studentProfileId: Id<"profiles">, key: string, title: string, description: string, category: string, sourceBookingId: Id<"projectBookings"> | undefined, assetKey: string, now: number) {
  const existing = await ctx.db.query("portfolioItems").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  const fields = { studentProfileId, sourceKind: sourceBookingId ? "completed_booking" as const : "manual" as const, sourceBookingId, title, description, category, assetKey, idempotencyKey: key, updatedAt: now, ...seedFields(key) };
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("portfolioItems", { ...fields, createdAt: now });
}

async function upsertCertification(ctx: MutationCtx, studentProfileId: Id<"profiles">, key: string, name: string, issuer: string, year: number, now: number) {
  const existing = await ctx.db.query("certifications").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  const fields = { studentProfileId, name, issuer, year, idempotencyKey: key, updatedAt: now, ...seedFields(key) };
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("certifications", { ...fields, createdAt: now });
}

async function upsertMentor(ctx: MutationCtx, studentProfileId: Id<"profiles">, key: string, question: string, answer: string, createdAt: number) {
  const turnId = `${studentProfileId}:${key}`;
  const existing = await ctx.db.query("mentorMessages").withIndex("by_student_turn_key", (q) => q.eq("studentProfileId", studentProfileId).eq("turnKey", key)).first();
  if (existing) return;
  await ctx.db.insert("mentorMessages", { studentProfileId, turnId, role: "user", sequence: 0, body: question, turnKey: key, isSimulated: true, createdAt, ...seedFields(`${key}-user`) });
  await ctx.db.insert("mentorMessages", { studentProfileId, turnId, role: "mentor", sequence: 1, body: answer, turnKey: key, ruleVersion: "deterministic-v1", isSimulated: true, createdAt: createdAt + 1, ...seedFields(`${key}-mentor`) });
}

async function upsertPreference(ctx: MutationCtx, profileId: Id<"profiles">, key: string, now: number) {
  const existing = await ctx.db.query("preferences").withIndex("by_profile", (q) => q.eq("profileId", profileId)).unique();
  if (existing) return;
  await ctx.db.insert("preferences", {
    profileId, notificationBadgesEnabled: true, language: "en", settingsDarkMode: false,
    schemaVersion: 1, revision: 1, createdAt: now, updatedAt: now, ...seedFields(key),
  });
}
