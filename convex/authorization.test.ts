/// <reference types="vite/client" />

import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';

import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
const identity = (subject: string) => ({
  subject,
  issuer: 'https://skillflow-tests.clerk.accounts.dev',
  tokenIdentifier: `https://skillflow-tests.clerk.accounts.dev|${subject}`,
});

describe('Convex authorization boundaries', () => {
  it('requires authentication and keeps service ownership on the server', async () => {
    const t = convexTest(schema, modules);
    const student = t.withIdentity(identity('student-owner'));
    const otherStudent = t.withIdentity(identity('student-other'));

    await expect(t.mutation(api.profiles.completeOnboarding, { role: 'student', name: 'Anonymous' }))
      .rejects.toThrow('Authentication required');
    await student.mutation(api.profiles.completeOnboarding, { role: 'student', name: 'Student Owner' });
    await otherStudent.mutation(api.profiles.completeOnboarding, { role: 'student', name: 'Other Student' });

    const serviceId = await student.mutation(api.services.save, {
      title: 'Presentation Design',
      subtitle: 'Clear academic slides',
      category: 'Graphics & Design',
      description: 'A complete presentation design service for academic clients.',
      price: 1200,
      deliveryDays: 3,
      revisions: 'Two revisions',
      publish: false,
    });

    await expect(otherStudent.mutation(api.services.setStatus, { serviceId, status: 'archived' }))
      .rejects.toThrow('only update your own services');
    await student.mutation(api.services.setStatus, { serviceId, status: 'archived' });
    const service = await t.run(async (ctx) => ctx.db.get(serviceId));
    expect(service?.status).toBe('archived');
  });

  it('allows only the owning client to decide a verified student proposal', async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity(identity('client-owner'));
    const otherClient = t.withIdentity(identity('client-other'));
    const student = t.withIdentity(identity('student-proposer'));
    await owner.mutation(api.profiles.completeOnboarding, { role: 'client', name: 'Project Owner' });
    await otherClient.mutation(api.profiles.completeOnboarding, { role: 'client', name: 'Other Client' });
    const studentId = await student.mutation(api.profiles.completeOnboarding, { role: 'student', name: 'Verified Student' });
    await t.run(async (ctx) => {
      const verification = await ctx.db.query('studentVerifications').withIndex('by_student', (q) => q.eq('studentProfileId', studentId)).unique();
      if (!verification) throw new Error('Verification fixture missing.');
      await ctx.db.patch(verification._id, { status: 'verified', reviewedAt: 1 });
    });

    const projectPostId = await owner.mutation(api.projects.savePost, {
      title: 'Design an academic poster',
      description: 'Create a polished poster for a university research presentation.',
      category: 'Graphics & Design',
      budget: 2500,
      deadline: '2030-05-01',
      skills: ['Poster Design'],
      publish: true,
    });
    const proposalId = await student.mutation(api.projects.submitProposal, {
      projectPostId,
      coverLetter: 'I can deliver a readable, presentation-ready research poster.',
      amount: 2200,
      deliveryDays: 4,
    });

    await expect(otherClient.mutation(api.projects.decideProposal, { proposalId, accept: true }))
      .rejects.toThrow('no longer available for a decision');
    const bookingId = await owner.mutation(api.projects.decideProposal, { proposalId, accept: true });
    expect(bookingId).not.toBeNull();
    const booking = await t.run(async (ctx) => bookingId ? ctx.db.get(bookingId) : null);
    expect(booking?.status).toBe('accepted');
    await expect(t.mutation(api.projects.actOnBooking, { bookingId: bookingId!, action: 'fund' }))
      .rejects.toThrow('Authentication required');
  });

  it('scopes the aggregate snapshot to the signed-in account', async () => {
    const t = convexTest(schema, modules);
    const client = t.withIdentity(identity('snapshot-client'));
    const otherClient = t.withIdentity(identity('snapshot-other-client'));
    const student = t.withIdentity(identity('snapshot-student'));
    const clientId = await client.mutation(api.profiles.completeOnboarding, { role: 'client', name: 'Snapshot Client' });
    const otherClientId = await otherClient.mutation(api.profiles.completeOnboarding, { role: 'client', name: 'Private Client' });
    const studentId = await student.mutation(api.profiles.completeOnboarding, { role: 'student', name: 'Snapshot Student' });
    const fixture = await t.run(async (ctx) => {
      const makeBooking = (ownerId: typeof clientId, key: string) => ctx.db.insert('projectBookings', {
        clientProfileId: ownerId, studentProfileId: studentId, source: 'service_request' as const, requestKey: key,
        title: key, description: 'Scoped booking fixture', deliveryDays: 3, budget: 1000, status: 'requested' as const,
        version: 1, createdAt: 1, updatedAt: 1,
      });
      const ownBooking = await makeBooking(clientId, 'own-booking');
      const otherBooking = await makeBooking(otherClientId, 'other-booking');
      const ownMessage = await ctx.db.insert('projectMessages', { bookingId: ownBooking, senderProfileId: studentId, recipientProfileId: clientId, body: 'Visible', sendKey: 'own-message', createdAt: 1 });
      const otherMessage = await ctx.db.insert('projectMessages', { bookingId: otherBooking, senderProfileId: studentId, recipientProfileId: otherClientId, body: 'Private', sendKey: 'other-message', createdAt: 1 });
      const ownNotification = await ctx.db.insert('notifications', { recipientProfileId: clientId, kind: 'message', title: 'Visible', detail: 'Visible', eventKey: 'own-notification', targetType: 'booking', bookingId: ownBooking, createdAt: 1 });
      const otherNotification = await ctx.db.insert('notifications', { recipientProfileId: otherClientId, kind: 'message', title: 'Private', detail: 'Private', eventKey: 'other-notification', targetType: 'booking', bookingId: otherBooking, createdAt: 1 });
      const ownLedger = await ctx.db.insert('ledgerEntries', { ownerProfileId: clientId, bookingId: ownBooking, type: 'hold', amount: 1000, isSimulated: true, createdAt: 1 });
      const otherLedger = await ctx.db.insert('ledgerEntries', { ownerProfileId: otherClientId, bookingId: otherBooking, type: 'hold', amount: 1000, isSimulated: true, createdAt: 1 });
      return { ownBooking, otherBooking, ownMessage, otherMessage, ownNotification, otherNotification, ownLedger, otherLedger };
    });

    const snapshot = await client.query(api.snapshot.get, {});
    expect(snapshot.bookings.map((item: { _id: string }) => item._id)).toEqual([fixture.ownBooking]);
    expect(snapshot.messages.map((item: { _id: string }) => item._id)).toEqual([fixture.ownMessage]);
    expect(snapshot.notifications.map((item: { _id: string }) => item._id)).toEqual([fixture.ownNotification]);
    expect(snapshot.ledger.map((item: { _id: string }) => item._id)).toEqual([fixture.ownLedger]);
    expect(snapshot.profiles.every((profile) => !('authTokenIdentifier' in profile))).toBe(true);
    expect('authTokenIdentifier' in snapshot.currentProfile).toBe(false);
  });
});
