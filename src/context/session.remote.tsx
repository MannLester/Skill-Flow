import { useClerk } from '@clerk/expo';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { createContext, PropsWithChildren, useCallback, useContext, useMemo } from 'react';

import { api } from '../../convex/_generated/api';
import { services as bundledServices, Service } from '@/data/fixtures';
import { calculateCareerReadiness, CareerReadinessBreakdown } from '@/domain/career-readiness';
import type { MediaAttachment, MediaInput } from '@/media/types';
import type {
  Certification, DemoAccount, DemoLedgerEntry, DemoNotification, DemoPreferences, MentorMessage, PortfolioItem,
  ProjectAction, ProjectBooking as LegacyProjectBooking, ProjectMessage, ProjectPost, ProjectPostInput, ProjectPostStatus,
  ProjectReview, Proposal, ProposalInput, ServiceInput, StoreResult, StudentVerification, UserProfile, UserRole,
} from './session';

export type ProjectStatus = Exclude<LegacyProjectBooking['status'], 'approved'>;
export type ProjectBooking = Omit<LegacyProjectBooking, 'status'> & { status: ProjectStatus };
export type CreateBookingInput = Pick<ProjectBooking, 'serviceId' | 'studentId' | 'title' | 'description' | 'deliveryDays' | 'budget'> & { referenceImages?: MediaInput[] };
export type ProjectActionPayload = { note?: string; rating?: number; comment?: string; deliveryImages?: MediaInput[] };
export type ProfileInput = Omit<UserProfile, 'accountId'> & { name: string; avatar?: MediaInput[] };
export type VerificationInput = Pick<StudentVerification, 'school' | 'program' | 'gradeLevel' | 'graduationYear' | 'sampleDocumentName'> & { studentNumber: string; evidenceImage?: MediaInput[] };
export type PortfolioInput = Pick<PortfolioItem, 'title' | 'description' | 'category' | 'sourceProjectId'> & { evidenceImages?: MediaInput[] };
export type CertificationInput = Pick<Certification, 'name' | 'issuer' | 'year'> & { evidenceImage?: MediaInput[] };
export type ServiceResult = { ok: true; service: Service } | { ok: false; message: string };
export type ProjectPostResult = { ok: true; projectPost: ProjectPost } | { ok: false; message: string };
export type ProposalDecisionResult = { ok: true; bookingId?: string } | { ok: false; message: string };

type AsyncResult<T> = Promise<T>;
type RemoteSessionValue = {
  hydrated: boolean; role: UserRole; homeRoute: '/student-home' | '/client-home'; currentAccount: DemoAccount | null;
  accounts: DemoAccount[]; services: Service[]; bookings: ProjectBooking[]; projectPosts: ProjectPost[]; proposals: Proposal[];
  messages: ProjectMessage[]; notifications: DemoNotification[]; ledger: DemoLedgerEntry[]; reviews: ProjectReview[]; profiles: UserProfile[];
  verifications: StudentVerification[]; portfolioItems: PortfolioItem[]; certifications: Certification[]; savedServiceIds: string[];
  mentorMessages: MentorMessage[]; preferences: DemoPreferences; unreadCount: number; mediaAttachments: MediaAttachment[];
  getCareerReadiness: (studentId: string) => CareerReadinessBreakdown;
  logout: () => AsyncResult<void>; createBooking: (input: CreateBookingInput) => AsyncResult<ProjectBooking>;
  actOnProject: (id: string, action: ProjectAction, payload?: ProjectActionPayload) => AsyncResult<StoreResult>;
  sendMessage: (id: string, body: string, image?: MediaInput) => AsyncResult<StoreResult>; markNotificationRead: (id: string) => AsyncResult<void>;
  markProjectMessagesRead: (id: string) => AsyncResult<void>; updateProfile: (input: ProfileInput) => AsyncResult<StoreResult>;
  submitVerification: (input: VerificationInput) => AsyncResult<StoreResult>; simulateVerificationReview: (approved: boolean, reason?: string) => AsyncResult<StoreResult>;
  addPortfolioItem: (input: PortfolioInput) => AsyncResult<StoreResult>; addCertification: (input: CertificationInput) => AsyncResult<StoreResult>;
  addCompletedProjectToPortfolio: (id: string) => AsyncResult<StoreResult>; saveService: (input: ServiceInput, publish: boolean, id?: string) => AsyncResult<ServiceResult>;
  setServiceStatus: (id: string, status: Service['status']) => AsyncResult<StoreResult>; saveProjectPost: (input: ProjectPostInput, publish: boolean, id?: string) => AsyncResult<ProjectPostResult>;
  setProjectPostStatus: (id: string, status: ProjectPostStatus) => AsyncResult<StoreResult>; submitProposal: (id: string, input: ProposalInput) => AsyncResult<StoreResult>;
  withdrawProposal: (id: string) => AsyncResult<StoreResult>; decideProposal: (id: string, accept: boolean) => AsyncResult<ProposalDecisionResult>;
  toggleSavedService: (id: string) => AsyncResult<void>; sendMentorMessage: (body: string) => AsyncResult<StoreResult>; clearMentorConversation: () => AsyncResult<void>;
  updatePreferences: (input: Partial<DemoPreferences>) => AsyncResult<void>;
};

const RemoteSessionContext = createContext<RemoteSessionValue | null>(null);
const idempotencyKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const iso = (value?: number) => value ? new Date(value).toISOString() : undefined;
const errorResult = (error: unknown): { ok: false; message: string } => ({ ok: false, message: error instanceof Error ? error.message : 'The request could not be completed.' });

export function SessionProvider({ children }: PropsWithChildren) {
  const { isAuthenticated } = useConvexAuth();
  const snapshot = useQuery(api.snapshot.get, isAuthenticated ? {} : 'skip');
  const { signOut } = useClerk();
  const updateProfileMutation = useMutation(api.profiles.update);
  const saveServiceMutation = useMutation(api.services.save);
  const setServiceStatusMutation = useMutation(api.services.setStatus);
  const toggleSavedMutation = useMutation(api.services.toggleSaved);
  const savePostMutation = useMutation(api.projects.savePost);
  const setPostStatusMutation = useMutation(api.projects.setPostStatus);
  const submitProposalMutation = useMutation(api.projects.submitProposal);
  const withdrawProposalMutation = useMutation(api.projects.withdrawProposal);
  const decideProposalMutation = useMutation(api.projects.decideProposal);
  const createBookingMutation = useMutation(api.projects.createBooking);
  const actBookingMutation = useMutation(api.projects.actOnBooking);
  const sendMessageMutation = useMutation(api.communication.sendMessage);
  const markThreadReadMutation = useMutation(api.communication.markThreadRead);
  const markNotificationReadMutation = useMutation(api.communication.markNotificationRead);
  const sendMentorMutation = useMutation(api.communication.sendMentorMessage);
  const clearMentorMutation = useMutation(api.communication.clearMentor);
  const submitVerificationMutation = useMutation(api.growth.submitVerification);
  const reviewVerificationMutation = useMutation(api.growth.simulateVerificationReview);
  const addPortfolioMutation = useMutation(api.growth.addPortfolio);
  const addCertificationMutation = useMutation(api.growth.addCertification);
  const updatePreferencesMutation = useMutation(api.growth.updatePreferences);

  const mapped = useMemo(() => mapSnapshot(snapshot), [snapshot]);
  const currentAccount = mapped.currentAccount;

  const updateProfile = useCallback(async (input: ProfileInput): Promise<StoreResult> => runStore(() => updateProfileMutation(input as never)), [updateProfileMutation]);
  const submitVerification = useCallback(async (input: VerificationInput): Promise<StoreResult> => runStore(() => submitVerificationMutation({ ...input, evidenceImage: input.evidenceImage ?? [] } as never)), [submitVerificationMutation]);
  const simulateVerificationReview = useCallback(async (approved: boolean, rejectionReason?: string): Promise<StoreResult> => runStore(() => reviewVerificationMutation({ approved, rejectionReason })), [reviewVerificationMutation]);
  const saveService = useCallback(async (input: ServiceInput, publish: boolean, serviceId?: string): Promise<ServiceResult> => {
    try { const id = await saveServiceMutation({ ...input, publish, serviceId: serviceId as never } as never); return { ok: true, service: { ...input, id, provider: currentAccount?.name ?? '', providerId: currentAccount?.id ?? '', rating: 0, reviews: 0, status: publish ? 'published' : 'draft', crop: bundledServices[0].crop } }; }
    catch (error) { return errorResult(error); }
  }, [currentAccount, saveServiceMutation]);
  const setServiceStatus = useCallback(async (serviceId: string, status: Service['status']): Promise<StoreResult> => runStore(() => setServiceStatusMutation({ serviceId: serviceId as never, status })), [setServiceStatusMutation]);
  const saveProjectPost = useCallback(async (input: ProjectPostInput, publish: boolean, projectPostId?: string): Promise<ProjectPostResult> => {
    try { const id = await savePostMutation({ ...input, publish, projectPostId: projectPostId as never } as never); const now = new Date().toISOString(); return { ok: true, projectPost: { ...input, id, clientId: currentAccount?.id ?? '', status: publish ? 'open' : 'draft', createdAt: now, updatedAt: now } }; }
    catch (error) { return errorResult(error); }
  }, [currentAccount, savePostMutation]);
  const setProjectPostStatus = useCallback(async (projectPostId: string, status: ProjectPostStatus): Promise<StoreResult> => runStore(() => setPostStatusMutation({ projectPostId: projectPostId as never, status })), [setPostStatusMutation]);
  const submitProposal = useCallback(async (projectPostId: string, input: ProposalInput): Promise<StoreResult> => runStore(() => submitProposalMutation({ projectPostId: projectPostId as never, ...input } as never)), [submitProposalMutation]);
  const withdrawProposal = useCallback(async (proposalId: string): Promise<StoreResult> => runStore(() => withdrawProposalMutation({ proposalId: proposalId as never })), [withdrawProposalMutation]);
  const decideProposal = useCallback(async (proposalId: string, accept: boolean): Promise<ProposalDecisionResult> => {
    try { const bookingId = await decideProposalMutation({ proposalId: proposalId as never, accept }); return { ok: true, bookingId: bookingId ?? undefined }; }
    catch (error) { return errorResult(error); }
  }, [decideProposalMutation]);
  const createBooking = useCallback(async (input: CreateBookingInput): Promise<ProjectBooking> => {
    if (!input.serviceId) throw new Error('Select a service first.');
    const id = await createBookingMutation({ serviceId: input.serviceId as never, description: input.description, deliveryDays: input.deliveryDays, budget: input.budget, requestKey: idempotencyKey('request'), referenceImages: input.referenceImages as never });
    const now = new Date().toISOString(); return { ...input, id, source: 'service_request', clientId: currentAccount?.id ?? '', status: 'requested', createdAt: now, updatedAt: now };
  }, [createBookingMutation, currentAccount]);
  const actOnProject = useCallback(async (bookingId: string, action: ProjectAction, payload: ProjectActionPayload = {}): Promise<StoreResult> => runStore(() => actBookingMutation({ bookingId: bookingId as never, action, ...payload } as never)), [actBookingMutation]);
  const sendMessage = useCallback(async (bookingId: string, body: string, image?: MediaInput): Promise<StoreResult> => runStore(() => sendMessageMutation({ bookingId: bookingId as never, body, image: image as never, sendKey: idempotencyKey('message') })), [sendMessageMutation]);
  const addPortfolioItem = useCallback(async (input: PortfolioInput): Promise<StoreResult> => runStore(() => addPortfolioMutation({ title: input.title, description: input.description, category: input.category, sourceBookingId: input.sourceProjectId as never, evidenceImages: input.evidenceImages as never, idempotencyKey: idempotencyKey('portfolio') })), [addPortfolioMutation]);
  const addCompletedProjectToPortfolio = useCallback(async (id: string): Promise<StoreResult> => {
    const booking = mapped.bookings.find((item: ProjectBooking) => item.id === id); if (!booking) return { ok: false, message: 'Project not found.' };
    return runStore(() => addPortfolioMutation({ title: booking.title, description: booking.deliveryNote ?? booking.description, category: 'Completed Client Project', sourceBookingId: id as never, idempotencyKey: `booking-${id}` }));
  }, [addPortfolioMutation, mapped.bookings]);
  const addCertification = useCallback(async (input: CertificationInput): Promise<StoreResult> => runStore(() => addCertificationMutation({ ...input, evidenceImage: input.evidenceImage ?? [], idempotencyKey: idempotencyKey('certification') } as never)), [addCertificationMutation]);
  const sendMentorMessage = useCallback(async (body: string): Promise<StoreResult> => runStore(() => sendMentorMutation({ body, turnKey: idempotencyKey('mentor') })), [sendMentorMutation]);

  const value = useMemo<RemoteSessionValue>(() => ({
    ...mapped, hydrated: snapshot !== undefined, role: currentAccount?.role ?? 'student', homeRoute: currentAccount?.role === 'client' ? '/client-home' : '/student-home', currentAccount,
    getCareerReadiness: (studentId) => calculateCareerReadiness(studentId, mapped), logout: () => signOut(), createBooking, actOnProject, sendMessage,
    markNotificationRead: async (id) => { await markNotificationReadMutation({ notificationId: id as never }); }, markProjectMessagesRead: async (id) => { await markThreadReadMutation({ bookingId: id as never }); },
    updateProfile, submitVerification, simulateVerificationReview, addPortfolioItem, addCertification, addCompletedProjectToPortfolio,
    saveService, setServiceStatus, saveProjectPost, setProjectPostStatus, submitProposal, withdrawProposal, decideProposal,
    toggleSavedService: async (id) => { await toggleSavedMutation({ serviceId: id as never }); }, sendMentorMessage,
    clearMentorConversation: async () => { await clearMentorMutation({}); }, updatePreferences: async (input) => { await updatePreferencesMutation({ notificationBadgesEnabled: input.notificationsEnabled, settingsDarkMode: input.darkMode }); },
  }), [actOnProject, addCertification, addCompletedProjectToPortfolio, addPortfolioItem, clearMentorMutation, createBooking, currentAccount, decideProposal, mapped, markNotificationReadMutation, markThreadReadMutation, saveProjectPost, saveService, sendMentorMessage, sendMessage, setProjectPostStatus, setServiceStatus, signOut, simulateVerificationReview, snapshot, submitProposal, submitVerification, toggleSavedMutation, updatePreferencesMutation, updateProfile, withdrawProposal]);
  return <RemoteSessionContext.Provider value={value}>{children}</RemoteSessionContext.Provider>;
}

async function runStore(request: () => Promise<unknown>): Promise<StoreResult> { try { await request(); return { ok: true }; } catch (error) { return errorResult(error); } }

type Raw = Record<string, any>;
const rows = (snapshot: Raw | null | undefined, key: string): Raw[] => snapshot?.[key] ?? [];
function mapSnapshot(snapshot: Raw | null | undefined) {
  const profiles = rows(snapshot, 'profiles').map(mapProfile);
  const verifications = rows(snapshot, 'verifications').map(mapVerification);
  const accounts = rows(snapshot, 'profiles').map((profile) => mapAccount(profile, verifications));
  const currentAccount = accounts.find((account) => account.id === snapshot?.currentProfile?._id) ?? null;
  const reviews = rows(snapshot, 'reviews').map(mapReview);
  const notifications = rows(snapshot, 'notifications').map(mapNotification);
  const preferences = mapPreferences(rows(snapshot, 'preferences'), currentAccount);
  return {
    currentAccount, accounts, profiles, verifications, reviews, notifications, preferences,
    services: rows(snapshot, 'services').map((item) => mapService(item, accounts, rows(snapshot, 'reviews'))),
    bookings: rows(snapshot, 'bookings').map(mapBooking), projectPosts: rows(snapshot, 'projectPosts').map(mapPost),
    proposals: rows(snapshot, 'proposals').map(mapProposal), messages: rows(snapshot, 'messages').map(mapMessage),
    ledger: rows(snapshot, 'ledger').filter((item) => item.type !== 'refund').map(mapLedger),
    portfolioItems: rows(snapshot, 'portfolioItems').filter((item) => !item.archivedAt).map(mapPortfolio),
    certifications: rows(snapshot, 'certifications').map(mapCertification), mentorMessages: rows(snapshot, 'mentorMessages').map(mapMentorMessage),
    savedServiceIds: rows(snapshot, 'savedServices').filter((item) => item.profileId === currentAccount?.id).map((item) => item.serviceId),
    mediaAttachments: rows(snapshot, 'mediaAttachments').map(mapMediaAttachment),
    unreadCount: unreadNotifications(preferences, notifications, currentAccount),
  };
}

const mapProfile = (profile: Raw): UserProfile => ({ accountId: profile._id, bio: profile.bio, location: profile.location, organization: profile.organization, school: profile.school, program: profile.program, gradeLevel: profile.gradeLevel, graduationYear: profile.graduationYear, skills: profile.skills });
const mapVerification = (item: Raw): StudentVerification => ({ studentId: item.studentProfileId, status: item.status, isSimulated: item.isSimulated, school: item.school, studentNumberMasked: item.studentNumberMasked, program: item.program, gradeLevel: item.gradeLevel, graduationYear: item.graduationYear, sampleDocumentName: item.sampleDocumentName, submittedAt: iso(item.submittedAt), reviewedAt: iso(item.reviewedAt), rejectionReason: item.rejectionReason });
const mapAccount = (profile: Raw, verifications: StudentVerification[]): DemoAccount => ({ id: profile._id, role: profile.role, name: profile.name, email: '', password: '', verified: verifications.some((item) => item.studentId === profile._id && item.status === 'verified') });
const mapService = (item: Raw, accounts: DemoAccount[], reviews: Raw[]): Service => ({ id: item._id, providerId: item.ownerProfileId, provider: accounts.find((account) => account.id === item.ownerProfileId)?.name ?? 'Student Designer', title: item.title, subtitle: item.subtitle, category: item.category, description: item.description, price: item.price, deliveryDays: item.deliveryDays, revisions: item.revisions, status: item.status, rating: ratingFor(item.ownerProfileId, reviews), reviews: reviews.filter((review) => review.studentProfileId === item.ownerProfileId).length, crop: bundledServices.find((seed) => seed.id === item.assetKey)?.crop ?? bundledServices[0].crop });
const mapBooking = (item: Raw): ProjectBooking => ({ id: item._id, source: item.source, serviceId: item.serviceId, projectPostId: item.projectPostId, proposalId: item.proposalId, clientId: item.clientProfileId, studentId: item.studentProfileId, title: item.title, description: item.description, deliveryDays: item.deliveryDays, budget: item.budget, status: item.status, createdAt: iso(item.createdAt)!, updatedAt: iso(item.updatedAt)!, deliveryNote: item.deliveryNote, revisionNote: item.revisionNote, completedAt: iso(item.completedAt) });
const mapPost = (item: Raw): ProjectPost => ({ id: item._id, clientId: item.clientProfileId, title: item.title, description: item.description, category: item.category, budget: item.budget, deadline: item.deadline, skills: item.skills, status: item.status, createdAt: iso(item.createdAt)!, updatedAt: iso(item.updatedAt)!, acceptedProposalId: item.acceptedProposalId });
const mapProposal = (item: Raw): Proposal => ({ id: item._id, projectPostId: item.projectPostId, studentId: item.studentProfileId, coverLetter: item.coverLetter, amount: item.amount, deliveryDays: item.deliveryDays, status: item.status, createdAt: iso(item.createdAt)! });
const mapMessage = (item: Raw): ProjectMessage => ({ id: item._id, projectId: item.bookingId, senderId: item.senderProfileId, body: item.body, createdAt: iso(item.createdAt)!, readBy: item.readAt ? [item.senderProfileId, item.recipientProfileId] : [item.senderProfileId] });
const mapNotification = (item: Raw): DemoNotification => ({ id: item._id, userId: item.recipientProfileId, title: item.title, detail: item.detail, kind: item.kind, projectId: item.bookingId, projectPostId: item.projectPostId, createdAt: iso(item.createdAt)!, read: Boolean(item.readAt) });
const mapLedger = (item: Raw): DemoLedgerEntry => ({ id: item._id, userId: item.ownerProfileId, projectId: item.bookingId, type: item.type, amount: item.amount, createdAt: iso(item.createdAt)! });
const mapReview = (item: Raw): ProjectReview => ({ id: item._id, projectId: item.bookingId, clientId: item.clientProfileId, studentId: item.studentProfileId, rating: item.rating, comment: item.comment, createdAt: iso(item.createdAt)! });
const mapPortfolio = (item: Raw): PortfolioItem => ({ id: item._id, studentId: item.studentProfileId, title: item.title, description: item.description, category: item.category, sourceProjectId: item.sourceBookingId, createdAt: iso(item.createdAt)! });
const mapCertification = (item: Raw): Certification => ({ id: item._id, studentId: item.studentProfileId, name: item.name, issuer: item.issuer, year: item.year, createdAt: iso(item.createdAt)! });
const mapMentorMessage = (item: Raw): MentorMessage => ({ id: item._id, accountId: item.studentProfileId, role: item.role, body: item.body, createdAt: iso(item.createdAt)! });
const mapMediaAttachment = (item: Raw): MediaAttachment => ({ id: item._id, targetType: item.targetType, targetId: item.targetId, purpose: item.purpose, position: item.position, altText: item.altText, visibility: item.visibility, publicUrl: item.publicUrl ?? undefined });
function mapPreferences(items: Raw[], account: DemoAccount | null): DemoPreferences { const own = items.find((item) => item.profileId === account?.id); return { notificationsEnabled: own?.notificationBadgesEnabled ?? true, darkMode: own?.settingsDarkMode ?? false, language: 'English' }; }
function unreadNotifications(preferences: DemoPreferences, notifications: DemoNotification[], account: DemoAccount | null) { return preferences.notificationsEnabled ? notifications.filter((item) => item.userId === account?.id && !item.read).length : 0; }

function ratingFor(studentId: string, reviews: any[]) { const own = reviews.filter((review) => review.studentProfileId === studentId); return own.length ? own.reduce((sum, review) => sum + review.rating, 0) / own.length : 0; }

export function useSession() { const value = useContext(RemoteSessionContext); if (!value) throw new Error('useSession must be used inside the remote SessionProvider'); return value; }

export type {
  Certification, DemoAccount, DemoLedgerEntry, DemoNotification, DemoPreferences, MentorMessage, PortfolioItem, ProjectAction,
  ProjectMessage, ProjectPost, ProjectPostInput, ProjectPostStatus, ProjectReview, Proposal, ProposalInput, ServiceInput, StoreResult,
  StudentVerification, UserProfile, UserRole, VerificationStatus,
} from './session';
