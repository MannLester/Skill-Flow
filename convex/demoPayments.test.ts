/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = (subject: string) => ({
  subject,
  issuer: "https://skillflow-tests.clerk.accounts.dev",
  tokenIdentifier: `https://skillflow-tests.clerk.accounts.dev|${subject}`,
});

async function bookingFixture() {
  const t = convexTest(schema, modules);
  const client = t.withIdentity(identity("payment-client"));
  const student = t.withIdentity(identity("payment-student"));
  const other = t.withIdentity(identity("payment-other"));
  const clientId = await client.mutation(api.profiles.completeOnboarding, { role: "client", name: "Payment Client" });
  const studentId = await student.mutation(api.profiles.completeOnboarding, { role: "student", name: "Payment Student" });
  await other.mutation(api.profiles.completeOnboarding, { role: "client", name: "Other Client" });
  const bookingId = await t.run((ctx) => ctx.db.insert("projectBookings", {
    clientProfileId: clientId, studentProfileId: studentId, source: "service_request",
    title: "Demo logo", description: "Fictional logo project", deliveryDays: 3,
    budget: 1500, status: "accepted", version: 1, createdAt: 1, updatedAt: 1,
  }));
  return { t, client, student, other, bookingId };
}

describe("simulated payment lifecycle", () => {
  it("requires a method, reserves once, and refunds once before work starts", async () => {
    const { t, client, student, other, bookingId } = await bookingFixture();
    await expect(client.mutation(api.projects.actOnBooking, { bookingId, action: "fund" }))
      .rejects.toThrow("Choose a simulated payment method");
    await expect(other.mutation(api.projects.actOnBooking, { bookingId, action: "fund", demoPaymentMethod: "demo_cash" }))
      .rejects.toThrow("not available");
    await client.mutation(api.projects.actOnBooking, { bookingId, action: "fund", demoPaymentMethod: "demo_wallet" });
    await expect(client.mutation(api.projects.actOnBooking, { bookingId, action: "fund", demoPaymentMethod: "demo_bank" }))
      .rejects.toThrow("not available");
    await expect(student.mutation(api.projects.actOnBooking, { bookingId, action: "cancel" }))
      .rejects.toThrow("not available");
    await client.mutation(api.projects.actOnBooking, { bookingId, action: "cancel" });
    await expect(client.mutation(api.projects.actOnBooking, { bookingId, action: "cancel" }))
      .rejects.toThrow("not available");
    const { booking, ledger } = await t.run(async (ctx) => ({
      booking: await ctx.db.get(bookingId),
      ledger: await ctx.db.query("ledgerEntries").withIndex("by_booking_type", (q) => q.eq("bookingId", bookingId)).take(10),
    }));
    expect(booking?.status).toBe("cancelled");
    expect(ledger.map(({ type }) => type).sort()).toEqual(["hold", "refund"]);
    expect(ledger.find(({ type }) => type === "hold")).toMatchObject({ amount: 1500, demoPaymentMethod: "demo_wallet", isSimulated: true });
    expect(ledger.find(({ type }) => type === "refund")).toMatchObject({ amount: 1500, isSimulated: true });
  });

  it("releases simulated earnings after approval and blocks a late refund", async () => {
    const { t, client, student, bookingId } = await bookingFixture();
    await client.mutation(api.projects.actOnBooking, { bookingId, action: "fund", demoPaymentMethod: "demo_bank" });
    await student.mutation(api.projects.actOnBooking, { bookingId, action: "start" });
    await expect(client.mutation(api.projects.actOnBooking, { bookingId, action: "cancel" }))
      .rejects.toThrow("not available");
    await student.mutation(api.projects.actOnBooking, { bookingId, action: "submit", note: "Completed demo files" });
    await client.mutation(api.projects.actOnBooking, { bookingId, action: "approve" });
    await expect(client.mutation(api.projects.actOnBooking, { bookingId, action: "approve" }))
      .rejects.toThrow("not available");
    const ledger = await t.run((ctx) => ctx.db.query("ledgerEntries").withIndex("by_booking_type", (q) => q.eq("bookingId", bookingId)).take(10));
    expect(ledger.map(({ type }) => type).sort()).toEqual(["hold", "release"]);
    expect(ledger.find(({ type }) => type === "release")).toMatchObject({ amount: 1500, isSimulated: true });
  });
});
