/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const priorDeploymentClass = process.env.SKILLFLOW_DEPLOYMENT_CLASS;
const operatorIdentity = {
  subject: "seed",
  issuer: "skillflow.dev.operator",
  tokenIdentifier: "skillflow.dev.operator|seed",
};
const identity = (subject: string) => ({
  subject,
  issuer: "https://skillflow-tests.clerk.accounts.dev",
  tokenIdentifier: `https://skillflow-tests.clerk.accounts.dev|${subject}`,
});

function requireSnapshot<T>(snapshot: T | null): T {
  expect(snapshot).not.toBeNull();
  if (snapshot === null) throw new Error("Expected an onboarded account snapshot.");
  return snapshot;
}

describe("development seed data", () => {
  beforeEach(() => {
    process.env.SKILLFLOW_DEPLOYMENT_CLASS = "cloud-development";
  });

  afterEach(() => {
    if (priorDeploymentClass === undefined) delete process.env.SKILLFLOW_DEPLOYMENT_CLASS;
    else process.env.SKILLFLOW_DEPLOYMENT_CLASS = priorDeploymentClass;
  });

  it("applies compact realistic data idempotently and exposes it in account snapshots", async () => {
    const t = convexTest(schema, modules);
    const operator = t.withIdentity(operatorIdentity);
    const student = t.withIdentity(identity("seed-student"));
    const client = t.withIdentity(identity("seed-client"));
    const studentProfileId = await student.mutation(api.profiles.completeOnboarding, { role: "student", name: "Alex Demo" });
    const clientProfileId = await client.mutation(api.profiles.completeOnboarding, { role: "client", name: "Mark Demo" });

    const first = await operator.mutation(api.devSeed.apply, { studentProfileId, clientProfileId });
    const second = await operator.mutation(api.devSeed.apply, { studentProfileId, clientProfileId });

    expect(second.records).toBe(first.records);
    expect(second.records).toBeLessThanOrEqual(50);

    const clientSnapshot = requireSnapshot(await client.query(api.snapshot.get, {}));
    expect(clientSnapshot.services.length).toBeGreaterThanOrEqual(5);
    expect(clientSnapshot.projectPosts.filter((post: { clientProfileId: string }) => post.clientProfileId === clientProfileId)).toHaveLength(2);
    expect(clientSnapshot.proposals.length).toBeGreaterThanOrEqual(2);
    expect(clientSnapshot.notifications.length).toBeGreaterThanOrEqual(3);
    expect(clientSnapshot.bookings.length).toBeGreaterThanOrEqual(2);

    const studentSnapshot = requireSnapshot(await student.query(api.snapshot.get, {}));
    expect(studentSnapshot.mentorMessages).toHaveLength(4);
    expect(studentSnapshot.ledger.some((entry: { type: string }) => entry.type === "release")).toBe(true);
    expect(studentSnapshot.reviews.some((review: { rating: number }) => review.rating === 5)).toBe(true);
  });

  it("resets only seed-owned rows and restores the live student verification state", async () => {
    const t = convexTest(schema, modules);
    const operator = t.withIdentity(operatorIdentity);
    const student = t.withIdentity(identity("reset-student"));
    const client = t.withIdentity(identity("reset-client"));
    const studentProfileId = await student.mutation(api.profiles.completeOnboarding, { role: "student", name: "Reset Student" });
    const clientProfileId = await client.mutation(api.profiles.completeOnboarding, { role: "client", name: "Reset Client" });

    const applied = await operator.mutation(api.devSeed.apply, { studentProfileId, clientProfileId });
    expect(applied.records).toBeGreaterThan(0);
    const reset = await operator.mutation(api.devSeed.reset, { confirmation: "RESET skillflow-foundation:v1" });
    expect(reset.deleted).toBe(applied.records);

    const preview = await operator.query(api.devSeed.preview, {});
    expect(preview.records).toBe(0);
    const verification = await t.run(async (ctx) => ctx.db.query("studentVerifications").withIndex("by_student", (q) => q.eq("studentProfileId", studentProfileId)).unique());
    expect(verification).toMatchObject({ status: "not_submitted" });
    expect(verification && "seedNamespace" in verification).toBe(false);
    const profile = await t.run(async (ctx) => ctx.db.get(studentProfileId));
    expect(profile?.name).toBe("Reset Student");
  });
});
