/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = {
  subject: "project-status-owner",
  issuer: "https://skillflow-tests.clerk.accounts.dev",
  tokenIdentifier: "https://skillflow-tests.clerk.accounts.dev|project-status-owner",
};

async function createDraftPost() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(identity);
  await owner.mutation(api.profiles.completeOnboarding, { role: "client", name: "Project Owner" });
  const projectPostId = await owner.mutation(api.projects.savePost, {
    title: "Design an academic poster",
    description: "Create a polished poster for a university research presentation.",
    category: "Graphics & Design",
    budget: 2500,
    deadline: "2030-05-01",
    skills: ["Poster Design"],
    publish: false,
  });
  return { t, owner, projectPostId };
}

describe("project post status transitions", () => {
  it("allows ordinary transitions and an idempotent archive", async () => {
    const { t, owner, projectPostId } = await createDraftPost();

    await owner.mutation(api.projects.setPostStatus, { projectPostId, status: "open" });
    await owner.mutation(api.projects.setPostStatus, { projectPostId, status: "closed" });
    await owner.mutation(api.projects.setPostStatus, { projectPostId, status: "archived" });
    await owner.mutation(api.projects.setPostStatus, { projectPostId, status: "archived" });

    const post = await t.run(async (ctx) => ctx.db.get(projectPostId));
    expect(post?.status).toBe("archived");
  });

  it.each(["draft", "open", "closed"] as const)("rejects archived -> %s", async (status) => {
    const { t, owner, projectPostId } = await createDraftPost();
    await owner.mutation(api.projects.setPostStatus, { projectPostId, status: "archived" });

    await expect(owner.mutation(api.projects.setPostStatus, { projectPostId, status }))
      .rejects.toThrow("Archived projects cannot change status.");

    const post = await t.run(async (ctx) => ctx.db.get(projectPostId));
    expect(post?.status).toBe("archived");
  });

  it("blocks the archived -> draft -> open resurrection sequence", async () => {
    const { owner, projectPostId } = await createDraftPost();
    await owner.mutation(api.projects.setPostStatus, { projectPostId, status: "archived" });

    await expect(owner.mutation(api.projects.setPostStatus, { projectPostId, status: "draft" }))
      .rejects.toThrow("Archived projects cannot change status.");
    await expect(owner.mutation(api.projects.savePost, {
      projectPostId,
      title: "Resurrected project",
      description: "This archived project must not return to the marketplace.",
      category: "Graphics & Design",
      budget: 2500,
      deadline: "2030-05-01",
      skills: ["Poster Design"],
      publish: true,
    })).rejects.toThrow("Closed or archived projects cannot be edited.");
  });
});
