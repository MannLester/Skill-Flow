/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = {
  subject: "demo-verification-student",
  issuer: "https://skillflow-tests.clerk.accounts.dev",
  tokenIdentifier: "https://skillflow-tests.clerk.accounts.dev|demo-verification-student",
};

async function fixture() {
  const t = convexTest(schema, modules);
  const student = t.withIdentity(identity);
  const studentId = await student.mutation(api.profiles.completeOnboarding, { role: "student", name: "Demo Student" });
  const intent = await student.mutation(api.media.createUploadIntent, { purpose: "verification_sample" });
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" })));
  const uploadedFileId = await student.mutation(api.media.finalizeUpload, {
    intentId: intent.intentId, storageId, width: 100, height: 80,
    originalName: "fictional-id.jpg", contentType: "image/jpeg", byteSize: 3,
  });
  return { t, student, studentId, uploadedFileId };
}

describe("automatic demo verification", () => {
  it("moves a valid fictional submission from checking to demo approved without a student review call", async () => {
    const { t, student, studentId, uploadedFileId } = await fixture();
    vi.useFakeTimers();
    try {
      await student.mutation(api.growth.submitVerification, {
        school: "Demo School", studentNumber: "DEMO-123456", program: "Design",
        gradeLevel: "Grade 12", graduationYear: 2028, sampleDocumentName: "fictional-id.jpg",
        evidenceImage: [{ uploadedFileId, altText: "Fictional ID sample" }],
      });
      const pending = await t.run((ctx) => ctx.db.query("studentVerifications").withIndex("by_student", (q) => q.eq("studentProfileId", studentId)).unique());
      expect(pending).toMatchObject({ status: "pending", isSimulated: true, version: 2 });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const checked = await t.run((ctx) => ctx.db.get(pending!._id));
      expect(checked).toMatchObject({ status: "verified", isSimulated: true, version: 3 });
      expect(checked?.reviewedAt).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores a stale scheduled check version", async () => {
    const { t, student, studentId, uploadedFileId } = await fixture();
    vi.useFakeTimers();
    try {
      const submission = {
        school: "Demo School", studentNumber: "DEMO-123456", program: "Design",
        gradeLevel: "Grade 12", graduationYear: 2028, sampleDocumentName: "fictional-id.jpg",
        evidenceImage: [{ uploadedFileId, altText: "Fictional ID sample" }],
      };
      await student.mutation(api.growth.submitVerification, submission);
      const pending = await t.run((ctx) => ctx.db.query("studentVerifications").withIndex("by_student", (q) => q.eq("studentProfileId", studentId)).unique());
      await t.mutation(internal.growth.completeDemoVerification, { verificationId: pending!._id, submittedVersion: 0 });
      const unchanged = await t.run((ctx) => ctx.db.get(pending!._id));
      expect(unchanged?.status).toBe("pending");
      await t.finishAllScheduledFunctions(vi.runAllTimers);
    } finally {
      vi.useRealTimers();
    }
  });

  it("schedules a check for a pending submission from the older flow", async () => {
    const { t, student, studentId } = await fixture();
    const legacy = await t.run(async (ctx) => {
      const current = await ctx.db.query("studentVerifications").withIndex("by_student", (q) => q.eq("studentProfileId", studentId)).unique();
      if (!current) throw new Error("Verification fixture missing.");
      await ctx.db.patch(current._id, { status: "pending", version: current.version + 1, submittedAt: Date.now(), checkScheduledAt: undefined });
      return current._id;
    });
    vi.useFakeTimers();
    try {
      await student.mutation(api.growth.ensureDemoVerificationCheck, {});
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const checked = await t.run((ctx) => ctx.db.get(legacy));
      expect(checked?.status).toBe("verified");
    } finally {
      vi.useRealTimers();
    }
  });
});
