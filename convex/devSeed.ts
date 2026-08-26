import { v } from "convex/values";
import type { Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

const namespace = "skillflow-foundation";
const version = "v1";
const operatorToken = "skillflow.dev.operator|seed";

async function requireDevelopmentOperator(ctx: QueryCtx | MutationCtx) {
  if (process.env.SKILLFLOW_DEPLOYMENT_CLASS !== "cloud-development") throw new Error("Seed operations are disabled outside cloud development.");
  const identity = await ctx.auth.getUserIdentity();
  if (identity?.tokenIdentifier !== operatorToken) throw new Error("Convex CLI development-operator identity required.");
}

async function countSeeded(ctx: QueryCtx) {
  const groups = await Promise.all([
    seeded(ctx, "services"), seeded(ctx, "projectPosts"), seeded(ctx, "savedServices"), seeded(ctx, "portfolioItems"), seeded(ctx, "certifications"),
    seeded(ctx, "projectBookings"), seeded(ctx, "proposals"), seeded(ctx, "projectMessages"), seeded(ctx, "notifications"), seeded(ctx, "ledgerEntries"), seeded(ctx, "reviews"), seeded(ctx, "mentorMessages"),
  ]);
  return groups.reduce((total, rows) => total + rows.length, 0);
}

function seeded<T extends TableNames>(ctx: QueryCtx | MutationCtx, table: T) {
  return ctx.db.query(table).withIndex("by_seed", (q) => q.eq("seedNamespace", namespace as never)).take(500);
}

export const preview = query({
  args: {}, returns: v.object({ namespace: v.string(), version: v.string(), records: v.number() }),
  handler: async (ctx) => { await requireDevelopmentOperator(ctx); return { namespace, version, records: await countSeeded(ctx) }; },
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
    await upsertVerification(ctx, student._id, now);
    const logo = await upsertService(ctx, student._id, "service-logo", { title: "Logo Design", subtitle: "A focused identity for a growing local brand", category: "Graphics & Design", description: "A clearly scoped logo-design demonstration with concepts, revisions, and presentation files.", price: 1500, deliveryDays: 3, revisions: "2 revisions", assetKey: "logo" }, now);
    const ui = await upsertService(ctx, student._id, "service-ui", { title: "Mobile UI Design", subtitle: "Clear and practical mobile interface design", category: "Web & App", description: "A five-screen mobile interface concept with reusable visual direction.", price: 2000, deliveryDays: 5, revisions: "2 revisions", assetKey: "uiux" }, now);
    await upsertPost(ctx, client._id, "post-mobile-ui", now);
    await upsertSaved(ctx, client._id, logo, "saved-logo", now);
    await upsertSaved(ctx, client._id, ui, "saved-ui", now);
    await upsertPortfolio(ctx, student._id, "portfolio-brand-study", now);
    await upsertCertification(ctx, student._id, "cert-design", now);
    return { namespace, version, records: await countSeeded(ctx) };
  },
});

export const reset = mutation({
  args: { confirmation: v.literal("RESET skillflow-foundation:v1") },
  returns: v.object({ namespace: v.string(), deleted: v.number() }),
  handler: async (ctx) => {
    await requireDevelopmentOperator(ctx);
    const groups = await Promise.all([
      seeded(ctx, "projectMessages"), seeded(ctx, "notifications"), seeded(ctx, "ledgerEntries"), seeded(ctx, "reviews"), seeded(ctx, "mentorMessages"),
      seeded(ctx, "savedServices"), seeded(ctx, "portfolioItems"), seeded(ctx, "certifications"), seeded(ctx, "projectBookings"), seeded(ctx, "proposals"), seeded(ctx, "projectPosts"), seeded(ctx, "services"),
    ]);
    for (const rows of groups) for (const row of rows) await ctx.db.delete(row._id);
    const verifications = await ctx.db.query("studentVerifications").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace)).take(20);
    for (const item of verifications) await ctx.db.patch(item._id, { status: "not_submitted", school: "", studentNumberMasked: "", program: "", gradeLevel: "", graduationYear: undefined, sampleDocumentName: undefined, rejectionReason: undefined, submittedAt: undefined, reviewedAt: undefined, seedNamespace: undefined, seedVersion: undefined, seedKey: undefined, version: item.version + 1, updatedAt: Date.now() });
    return { namespace, deleted: groups.reduce((total, rows) => total + rows.length, 0) };
  },
});

async function upsertVerification(ctx: MutationCtx, studentProfileId: Id<"profiles">, now: number) {
  const existing = await ctx.db.query("studentVerifications").withIndex("by_student", (q) => q.eq("studentProfileId", studentProfileId)).unique();
  const fields = { status: "verified" as const, school: "Batangas State University TNEU", studentNumberMasked: "DEMO-****-2026", program: "Arts and Design", gradeLevel: "Grade 12", graduationYear: 2027, sampleDocumentName: "Simulated demo student ID", isSimulated: true as const, reviewedAt: now, updatedAt: now, seedNamespace: namespace, seedVersion: version, seedKey: "verification-student" };
  if (existing) await ctx.db.patch(existing._id, { ...fields, version: existing.version + 1 });
  else await ctx.db.insert("studentVerifications", { studentProfileId, ...fields, version: 1 });
}

type ServiceSeed = { title: string; subtitle: string; category: string; description: string; price: number; deliveryDays: number; revisions: string; assetKey: string };
async function upsertService(ctx: MutationCtx, ownerProfileId: Id<"profiles">, key: string, input: ServiceSeed, now: number) {
  const existing = await ctx.db.query("services").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  const fields = { ownerProfileId, ...input, status: "published" as const, normalizedSearch: `${input.title} ${input.subtitle} ${input.category}`.toLowerCase(), updatedAt: now, publishedAt: now, seedNamespace: namespace, seedVersion: version, seedKey: key };
  if (existing) { await ctx.db.patch(existing._id, fields); return existing._id; }
  return await ctx.db.insert("services", { ...fields, createdAt: now });
}

async function upsertPost(ctx: MutationCtx, clientProfileId: Id<"profiles">, key: string, now: number) {
  const existing = await ctx.db.query("projectPosts").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  const fields = { clientProfileId, title: "Mobile App UI Design", description: "Create a polished mobile ordering experience for a local coffee shop, including five key screens and a reusable visual system.", category: "Web & App", budget: 2000, deadline: "2026-09-30", deadlineEpoch: Date.parse("2026-09-30"), skills: ["UI/UX", "Mobile Design", "Prototyping"], status: "open" as const, normalizedSearch: "mobile app ui design coffee shop ui ux mobile design prototyping", updatedAt: now, openedAt: now, seedNamespace: namespace, seedVersion: version, seedKey: key };
  if (existing) { await ctx.db.patch(existing._id, fields); return existing._id; }
  return await ctx.db.insert("projectPosts", { ...fields, createdAt: now });
}

async function upsertSaved(ctx: MutationCtx, profileId: Id<"profiles">, serviceId: Id<"services">, key: string, now: number) {
  const existing = await ctx.db.query("savedServices").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  if (!existing) await ctx.db.insert("savedServices", { profileId, serviceId, createdAt: now, seedNamespace: namespace, seedVersion: version, seedKey: key });
}

async function upsertPortfolio(ctx: MutationCtx, studentProfileId: Id<"profiles">, key: string, now: number) {
  const existing = await ctx.db.query("portfolioItems").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  const fields = { studentProfileId, sourceKind: "manual" as const, title: "Coffee Shop Brand Study", description: "A simulated identity study demonstrating logo exploration and presentation.", category: "Graphics & Design", idempotencyKey: key, updatedAt: now, seedNamespace: namespace, seedVersion: version, seedKey: key };
  if (existing) await ctx.db.patch(existing._id, fields); else await ctx.db.insert("portfolioItems", { ...fields, createdAt: now });
}

async function upsertCertification(ctx: MutationCtx, studentProfileId: Id<"profiles">, key: string, now: number) {
  const existing = await ctx.db.query("certifications").withIndex("by_seed", (q) => q.eq("seedNamespace", namespace).eq("seedKey", key)).unique();
  const fields = { studentProfileId, name: "Introduction to Graphic Design", issuer: "SkillFlow Demo Academy", year: 2026, idempotencyKey: key, updatedAt: now, seedNamespace: namespace, seedVersion: version, seedKey: key };
  if (existing) await ctx.db.patch(existing._id, fields); else await ctx.db.insert("certifications", { ...fields, createdAt: now });
}
