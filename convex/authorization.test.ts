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

const hasField = (field: string, value: unknown) => (item: unknown): item is Record<string, unknown> =>
  typeof item === 'object' && item !== null && field in item && item[field as keyof typeof item] === value;

function expectExactKeys(record: unknown, keys: string[]) {
  expect(record).toBeDefined();
  expect(Object.keys(record as Record<string, unknown>).sort()).toEqual(keys);
}

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

  it('returns private profile and verification fields only to their owner', async () => {
    const t = convexTest(schema, modules);
    const student = t.withIdentity(identity('snapshot-private-student'));
    const observer = t.withIdentity(identity('snapshot-profile-observer'));
    const studentId = await student.mutation(api.profiles.completeOnboarding, { role: 'student', name: 'Public Student' });
    const observerId = await observer.mutation(api.profiles.completeOnboarding, { role: 'client', name: 'Profile Observer' });
    await student.mutation(api.profiles.update, {
      name: 'Public Student', bio: 'Public biography', location: 'Private location', school: 'Private school',
      program: 'Private program', gradeLevel: 'Private grade', graduationYear: 2030, skills: ['Public skill'],
    });
    const verificationId = await t.run(async (ctx) => {
      const verification = await ctx.db.query('studentVerifications').withIndex('by_student', (q) => q.eq('studentProfileId', studentId)).unique();
      if (!verification) throw new Error('Verification fixture missing.');
      return verification._id;
    });

    const notSubmittedObserverSnapshot = await observer.query(api.snapshot.get, {});
    expect(notSubmittedObserverSnapshot.verifications.some(hasField('studentProfileId', studentId))).toBe(false);

    await t.run(async (ctx) => {
      await ctx.db.patch(verificationId, {
        status: 'pending', school: 'Private school', studentNumberMasked: 'PRIVATE-****', program: 'Private program',
        gradeLevel: 'Private grade', graduationYear: 2030, sampleDocumentName: 'private-document.png',
        rejectionReason: 'Private rejection', submittedAt: 10, reviewedAt: 20, updatedAt: 30,
      });
    });

    const ownerSnapshot = await student.query(api.snapshot.get, {});
    const ownerProfile = ownerSnapshot.profiles.find(hasField('_id', studentId));
    const ownerVerification = ownerSnapshot.verifications.find(hasField('studentProfileId', studentId));
    expectExactKeys(ownerProfile, [
      '_creationTime', '_id', 'bio', 'createdAt', 'gradeLevel', 'graduationYear', 'location', 'name', 'program', 'role',
      'school', 'skills', 'updatedAt',
    ]);
    expectExactKeys(ownerVerification, [
      '_creationTime', '_id', 'gradeLevel', 'graduationYear', 'isSimulated', 'program', 'rejectionReason', 'reviewedAt',
      'sampleDocumentName', 'school', 'status', 'studentNumberMasked', 'studentProfileId', 'submittedAt', 'updatedAt', 'version',
    ]);

    const pendingObserverSnapshot = await observer.query(api.snapshot.get, {});
    const publicProfile = pendingObserverSnapshot.profiles.find(hasField('_id', studentId));
    expectExactKeys(publicProfile, ['_creationTime', '_id', 'bio', 'name', 'role', 'skills']);
    expect(publicProfile).toMatchObject({ role: 'student', name: 'Public Student', bio: 'Public biography', skills: ['Public skill'] });
    expect(pendingObserverSnapshot.verifications.some(hasField('studentProfileId', studentId))).toBe(false);

    await t.run(async (ctx) => {
      await ctx.db.patch(verificationId, { status: 'rejected' });
    });
    const rejectedObserverSnapshot = await observer.query(api.snapshot.get, {});
    expect(rejectedObserverSnapshot.verifications.some(hasField('studentProfileId', studentId))).toBe(false);

    const consumerFixtures = await t.run(async (ctx) => {
      await ctx.db.patch(verificationId, { status: 'verified' });
      const serviceId = await ctx.db.insert('services', {
        ownerProfileId: studentId, title: 'Public service', subtitle: 'Marketplace subtitle', category: 'Design',
        description: 'Marketplace description', price: 1000, deliveryDays: 3, revisions: 'Two', status: 'published',
        normalizedSearch: 'public service', createdAt: 1, updatedAt: 1, publishedAt: 1,
      });
      const postId = await ctx.db.insert('projectPosts', {
        clientProfileId: observerId, title: 'Public project', description: 'Project description', category: 'Design',
        budget: 2000, deadline: '2030-01-01', deadlineEpoch: 1, skills: ['Public skill'], status: 'open',
        normalizedSearch: 'public project', createdAt: 1, updatedAt: 1, openedAt: 1,
      });
      const proposalId = await ctx.db.insert('proposals', {
        projectPostId: postId, studentProfileId: studentId, coverLetter: 'Proposal evidence', amount: 1800,
        deliveryDays: 4, status: 'submitted', createdAt: 1, updatedAt: 1,
      });
      const bookingId = await ctx.db.insert('projectBookings', {
        clientProfileId: observerId, studentProfileId: studentId, source: 'proposal', projectPostId: postId, proposalId,
        title: 'Reviewed project', description: 'Booking description', deliveryDays: 4, budget: 1800,
        status: 'reviewed', version: 1, createdAt: 1, updatedAt: 1,
      });
      const reviewId = await ctx.db.insert('reviews', {
        bookingId, clientProfileId: observerId, studentProfileId: studentId, rating: 5,
        comment: 'Review evidence', createdAt: 1,
      });
      const portfolioId = await ctx.db.insert('portfolioItems', {
        studentProfileId: studentId, sourceKind: 'manual', title: 'Portfolio evidence',
        description: 'Portfolio description', category: 'Design', idempotencyKey: 'portfolio-evidence', createdAt: 1, updatedAt: 1,
      });
      const certificationId = await ctx.db.insert('certifications', {
        studentProfileId: studentId, name: 'Certification evidence', issuer: 'Demo issuer', year: 2030,
        idempotencyKey: 'certification-evidence', createdAt: 1, updatedAt: 1,
      });
      return { serviceId, postId, proposalId, reviewId, portfolioId, certificationId };
    });
    const verifiedObserverSnapshot = await observer.query(api.snapshot.get, {});
    const publicVerification = verifiedObserverSnapshot.verifications.find(hasField('studentProfileId', studentId));
    expectExactKeys(publicVerification, ['_creationTime', '_id', 'isSimulated', 'status', 'studentProfileId']);
    expect(publicVerification).toMatchObject({ studentProfileId: studentId, status: 'verified', isSimulated: true });
    expect(verifiedObserverSnapshot.services.find(hasField('_id', consumerFixtures.serviceId))).toMatchObject({ ownerProfileId: studentId, title: 'Public service' });
    expect(verifiedObserverSnapshot.projectPosts.find(hasField('_id', consumerFixtures.postId))).toMatchObject({ clientProfileId: observerId, status: 'open' });
    expect(verifiedObserverSnapshot.proposals.find(hasField('_id', consumerFixtures.proposalId))).toMatchObject({ studentProfileId: studentId, coverLetter: 'Proposal evidence' });
    expect(verifiedObserverSnapshot.reviews.find(hasField('_id', consumerFixtures.reviewId))).toMatchObject({ studentProfileId: studentId, rating: 5 });
    expect(verifiedObserverSnapshot.portfolioItems.find(hasField('_id', consumerFixtures.portfolioId))).toMatchObject({ studentProfileId: studentId, title: 'Portfolio evidence' });
    expect(verifiedObserverSnapshot.certifications.find(hasField('_id', consumerFixtures.certificationId))).toMatchObject({ studentProfileId: studentId, name: 'Certification evidence' });
  });
});
