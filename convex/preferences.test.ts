/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = {
  subject: "settings-student",
  issuer: "https://skillflow-tests.clerk.accounts.dev",
  tokenIdentifier: "https://skillflow-tests.clerk.accounts.dev|settings-student",
};

describe("persisted settings", () => {
  it("stores Filipino and dark mode for the authenticated profile", async () => {
    const t = convexTest(schema, modules);
    const student = t.withIdentity(identity);
    const profileId = await student.mutation(api.profiles.completeOnboarding, { role: "student", name: "Settings Student" });
    await student.mutation(api.growth.updatePreferences, { language: "fil", settingsDarkMode: true });
    const preference = await t.run((ctx) => ctx.db.query("preferences").withIndex("by_profile", (q) => q.eq("profileId", profileId)).unique());
    expect(preference).toMatchObject({ profileId, language: "fil", settingsDarkMode: true, notificationBadgesEnabled: true });
  });
});
