/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = (name: string) => ({ subject: name, issuer: "test", tokenIdentifier: `test|${name}` });

async function profile(t: TestConvex<typeof schema>, name: string, role: "student" | "client") {
  return await t.run(async (ctx) => await ctx.db.insert("profiles", {
    authTokenIdentifier: `test|${name}`, role, name, bio: "", location: "", skills: [], createdAt: 1, updatedAt: 1,
  }));
}

async function uploadedImage(t: TestConvex<typeof schema>, name: string, purpose: "portfolio_evidence" | "verification_sample") {
  await profile(t, name, "student");
  const user = t.withIdentity(identity(name));
  const intent = await user.mutation(api.media.createUploadIntent, { purpose });
  const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" })));
  const uploadedFileId = await user.mutation(api.media.finalizeUpload, {
    intentId: intent.intentId, storageId, width: 100, height: 80, originalName: "sample.jpg", contentType: "image/jpeg", byteSize: 3,
  });
  return { user, uploadedFileId };
}

describe("media storage", () => {
  test("requires authentication and enforces upload ownership", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.media.createUploadIntent, { purpose: "avatar" })).rejects.toThrow("Authentication required");
    const { uploadedFileId } = await uploadedImage(t, "alex", "portfolio_evidence");
    await profile(t, "other", "student");
    await expect(t.withIdentity(identity("other")).mutation(api.media.discardUpload, { uploadedFileId })).rejects.toThrow("not found");
  });

  test("rejects invalid MIME metadata and oversized dimensions", async () => {
    const t = convexTest(schema, modules);
    await profile(t, "alex", "student");
    const user = t.withIdentity(identity("alex"));
    const intent = await user.mutation(api.media.createUploadIntent, { purpose: "avatar" });
    const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["bad"], { type: "text/plain" })));
    await expect(user.mutation(api.media.finalizeUpload, { intentId: intent.intentId, storageId, width: 100, height: 100, originalName: "bad.txt", contentType: "text/plain", byteSize: 3 })).rejects.toThrow("JPEG, PNG, or WebP");
    const intent2 = await user.mutation(api.media.createUploadIntent, { purpose: "avatar" });
    const imageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["ok"], { type: "image/jpeg" })));
    await expect(user.mutation(api.media.finalizeUpload, { intentId: intent2.intentId, storageId: imageId, width: 2001, height: 100, originalName: "wide.jpg", contentType: "image/jpeg", byteSize: 2 })).rejects.toThrow("2000 pixels");
  });

  test("enforces required evidence, supports shared references, and restricts private media", async () => {
    const t = convexTest(schema, modules);
    const { user, uploadedFileId } = await uploadedImage(t, "alex", "portfolio_evidence");
    const first = await user.mutation(api.growth.addPortfolio, { title: "First", description: "Evidence", category: "Design", idempotencyKey: "one", evidenceImages: [{ uploadedFileId, altText: "First sample" }] });
    const second = await user.mutation(api.growth.addPortfolio, { title: "Second", description: "Evidence", category: "Design", idempotencyKey: "two", evidenceImages: [{ uploadedFileId, altText: "Second sample" }] });
    const linkCount = await t.run(async (ctx) => (await ctx.db.get(uploadedFileId))?.linkCount);
    expect(linkCount).toBe(2);
    expect(first).not.toBe(second);
    await expect(user.mutation(api.growth.addPortfolio, { title: "Missing", description: "Evidence", category: "Design", idempotencyKey: "missing", evidenceImages: [] })).rejects.toThrow("between 1 and 5");

    const privateUpload = await uploadedImage(t, "sam", "verification_sample");
    const verificationId = await t.run(async (ctx) => await ctx.db.insert("studentVerifications", { studentProfileId: await ctx.db.query("profiles").withIndex("by_auth_token", (q) => q.eq("authTokenIdentifier", "test|sam")).unique().then((item) => item!._id), status: "pending", school: "Demo", studentNumberMasked: "0000-****-0000", program: "Demo", gradeLevel: "Demo", version: 1, isSimulated: true, updatedAt: 1 }));
    const samProfile = await t.run(async (ctx) => (await ctx.db.query("profiles").withIndex("by_auth_token", (q) => q.eq("authTokenIdentifier", "test|sam")).unique())!._id);
    const attachmentId = await t.run(async (ctx) => {
      await ctx.db.patch(privateUpload.uploadedFileId, { linkCount: 1 });
      return await ctx.db.insert("mediaAttachments", { uploadedFileId: privateUpload.uploadedFileId, ownerProfileId: samProfile, targetType: "verification", targetId: verificationId, purpose: "verification_sample", position: 0, altText: "Private sample", visibility: "owner", createdAt: 1, updatedAt: 1 });
    });
    await profile(t, "stranger", "client");
    expect(await t.withIdentity(identity("stranger")).query(internal.media.authorizeDownload, { attachmentId })).toBeNull();
    expect(await privateUpload.user.query(internal.media.authorizeDownload, { attachmentId })).not.toBeNull();
  });
});
