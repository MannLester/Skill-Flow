import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Authentication required.");
  return identity;
}

export async function requireProfile(ctx: QueryCtx | MutationCtx): Promise<Doc<"profiles">> {
  const identity = await requireIdentity(ctx);
  const profile = await ctx.db.query("profiles").withIndex("by_auth_token", (q) => q.eq("authTokenIdentifier", identity.tokenIdentifier)).unique();
  if (!profile) throw new Error("Complete account onboarding first.");
  return profile;
}

export async function requireRole(ctx: QueryCtx | MutationCtx, role: "student" | "client") {
  const profile = await requireProfile(ctx);
  if (profile.role !== role) throw new Error(role === "student" ? "Student Designer access required." : "Client access required.");
  return profile;
}

export function assertText(value: string, label: string, max = 2000) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  if (trimmed.length > max) throw new Error(`${label} is too long.`);
  return trimmed;
}

export function assertPositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be greater than zero.`);
  return value;
}
