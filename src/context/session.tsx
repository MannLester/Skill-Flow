import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, memo, PropsWithChildren, SetStateAction, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { Service, services as seededServices } from '@/data/fixtures';
import { calculateCareerReadiness, CareerReadinessBreakdown } from '@/domain/career-readiness';

export type UserRole = 'student' | 'client';
export type ProjectStatus = 'requested' | 'accepted' | 'declined' | 'cancelled' | 'demo_funded' | 'in_progress' | 'submitted' | 'revision_requested' | 'approved' | 'completed' | 'reviewed';
export type ProjectAction = 'accept' | 'decline' | 'cancel' | 'fund' | 'start' | 'submit' | 'request_revision' | 'approve' | 'review';
export type NotificationKind = 'project' | 'message' | 'payment' | 'complete';
export type VerificationStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected';
export type ProjectPostStatus = 'draft' | 'open' | 'closed' | 'archived';
export type ProposalStatus = 'submitted' | 'accepted' | 'rejected' | 'withdrawn';

export type DemoAccount = {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  password: string;
  verified: boolean;
};

export type ProjectBooking = {
  id: string;
  source: 'service_request' | 'proposal';
  serviceId?: string;
  projectPostId?: string;
  proposalId?: string;
  clientId: string;
  studentId: string;
  title: string;
  description: string;
  deliveryDays: number;
  budget: number;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  deliveryNote?: string;
  revisionNote?: string;
  completedAt?: string;
};

export type ProjectPost = {
  id: string;
  clientId: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  deadline: string;
  skills: string[];
  status: ProjectPostStatus;
  createdAt: string;
  updatedAt: string;
  acceptedProposalId?: string;
};

export type Proposal = {
  id: string;
  projectPostId: string;
  studentId: string;
  coverLetter: string;
  amount: number;
  deliveryDays: number;
  status: ProposalStatus;
  createdAt: string;
};

export type MentorMessage = { id: string; accountId: string; role: 'user' | 'mentor'; body: string; createdAt: string };
export type DemoPreferences = { notificationsEnabled: boolean; darkMode: boolean; language: 'English' };

export type ProjectMessage = {
  id: string;
  projectId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readBy: string[];
};

export type DemoNotification = {
  id: string;
  userId: string;
  title: string;
  detail: string;
  kind: NotificationKind;
  projectId?: string;
  projectPostId?: string;
  createdAt: string;
  read: boolean;
};

export type DemoLedgerEntry = {
  id: string;
  userId: string;
  projectId: string;
  type: 'hold' | 'release';
  amount: number;
  createdAt: string;
};

export type ProjectReview = {
  id: string;
  projectId: string;
  clientId: string;
  studentId: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type UserProfile = {
  accountId: string;
  bio: string;
  location: string;
  organization?: string;
  school?: string;
  program?: string;
  gradeLevel?: string;
  graduationYear?: number;
  skills: string[];
};

export type StudentVerification = {
  studentId: string;
  status: VerificationStatus;
  school: string;
  studentNumberMasked: string;
  program: string;
  gradeLevel: string;
  graduationYear?: number;
  sampleDocumentName?: string;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
};

export type PortfolioItem = {
  id: string;
  studentId: string;
  title: string;
  description: string;
  category: string;
  sourceProjectId?: string;
  createdAt: string;
};

export type Certification = {
  id: string;
  studentId: string;
  name: string;
  issuer: string;
  year: number;
  createdAt: string;
};

type PersistedDemoState = {
  version: 5;
  currentAccountId: string | null;
  accounts: DemoAccount[];
  services: Service[];
  bookings: ProjectBooking[];
  projectPosts: ProjectPost[];
  proposals: Proposal[];
  messages: ProjectMessage[];
  notifications: DemoNotification[];
  ledger: DemoLedgerEntry[];
  reviews: ProjectReview[];
  profiles: UserProfile[];
  verifications: StudentVerification[];
  portfolioItems: PortfolioItem[];
  certifications: Certification[];
  savedServiceIds: string[];
  mentorMessages: MentorMessage[];
  preferences: DemoPreferences;
};

type CreateBookingInput = Pick<ProjectBooking, 'serviceId' | 'studentId' | 'title' | 'description' | 'deliveryDays' | 'budget'>;
type RegisterAccountInput = Pick<DemoAccount, 'name' | 'email' | 'password' | 'role'>;
type AuthResult = { ok: true; account: DemoAccount } | { ok: false; message: string };
export type StoreResult = { ok: true } | { ok: false; message: string };

type ProjectActionPayload = { note?: string; rating?: number; comment?: string };
type ProfileInput = Omit<UserProfile, 'accountId'> & { name: string };
type VerificationInput = Pick<StudentVerification, 'school' | 'program' | 'gradeLevel' | 'graduationYear' | 'sampleDocumentName'> & { studentNumber: string };
type PortfolioInput = Pick<PortfolioItem, 'title' | 'description' | 'category' | 'sourceProjectId'>;
type CertificationInput = Pick<Certification, 'name' | 'issuer' | 'year'>;
export type ServiceInput = Pick<Service, 'title' | 'subtitle' | 'category' | 'description' | 'price' | 'deliveryDays' | 'revisions'>;
type ServiceResult = { ok: true; service: Service } | { ok: false; message: string };
export type ProjectPostInput = Pick<ProjectPost, 'title' | 'description' | 'category' | 'budget' | 'deadline' | 'skills'>;
export type ProposalInput = Pick<Proposal, 'coverLetter' | 'amount' | 'deliveryDays'>;
type ProjectPostResult = { ok: true; projectPost: ProjectPost } | { ok: false; message: string };
type ProposalDecisionResult = { ok: true; bookingId?: string } | { ok: false; message: string };

type SessionValue = {
  hydrated: boolean;
  role: UserRole;
  setRole: (role: UserRole) => void;
  homeRoute: '/student-home' | '/client-home';
  currentAccount: DemoAccount | null;
  accounts: DemoAccount[];
  services: Service[];
  bookings: ProjectBooking[];
  projectPosts: ProjectPost[];
  proposals: Proposal[];
  messages: ProjectMessage[];
  notifications: DemoNotification[];
  ledger: DemoLedgerEntry[];
  reviews: ProjectReview[];
  profiles: UserProfile[];
  verifications: StudentVerification[];
  portfolioItems: PortfolioItem[];
  certifications: Certification[];
  savedServiceIds: string[];
  mentorMessages: MentorMessage[];
  preferences: DemoPreferences;
  unreadCount: number;
  getCareerReadiness: (studentId: string) => CareerReadinessBreakdown;
  login: (email: string, password: string, role: UserRole) => AuthResult;
  loginAsRole: (role: UserRole) => void;
  registerAccount: (input: RegisterAccountInput) => AuthResult;
  logout: () => void;
  createBooking: (input: CreateBookingInput) => ProjectBooking;
  actOnProject: (projectId: string, action: ProjectAction, payload?: ProjectActionPayload) => StoreResult;
  sendMessage: (projectId: string, body: string) => StoreResult;
  markNotificationRead: (notificationId: string) => void;
  markProjectMessagesRead: (projectId: string) => void;
  updateProfile: (input: ProfileInput) => StoreResult;
  submitVerification: (input: VerificationInput) => StoreResult;
  simulateVerificationReview: (approved: boolean, rejectionReason?: string) => StoreResult;
  addPortfolioItem: (input: PortfolioInput) => StoreResult;
  addCertification: (input: CertificationInput) => StoreResult;
  addCompletedProjectToPortfolio: (projectId: string) => StoreResult;
  saveService: (input: ServiceInput, publish: boolean, serviceId?: string) => ServiceResult;
  setServiceStatus: (serviceId: string, status: Service['status']) => StoreResult;
  saveProjectPost: (input: ProjectPostInput, publish: boolean, projectPostId?: string) => ProjectPostResult;
  setProjectPostStatus: (projectPostId: string, status: ProjectPostStatus) => StoreResult;
  submitProposal: (projectPostId: string, input: ProposalInput) => StoreResult;
  withdrawProposal: (proposalId: string) => StoreResult;
  decideProposal: (proposalId: string, accept: boolean) => ProposalDecisionResult;
  toggleSavedService: (serviceId: string) => void;
  sendMentorMessage: (body: string) => StoreResult;
  clearMentorConversation: () => void;
  updatePreferences: (input: Partial<DemoPreferences>) => void;
  changePassword: (currentPassword: string, newPassword: string) => StoreResult;
  resetDemoData: () => Promise<void>;
};

const STORAGE_KEY = 'skillflow.demo-state';
const LEGACY_STORAGE_KEY = 'skillflow.demo-state.v1';

const seededAccounts: DemoAccount[] = [
  { id: 'student-alex', role: 'student', name: 'Alex D.', email: 'alex@skillflow.demo', password: 'demo123', verified: true },
  { id: 'client-mark', role: 'client', name: 'Mark C.', email: 'mark@skillflow.demo', password: 'demo123', verified: true },
  { id: 'student-jamie', role: 'student', name: 'Jamie R.', email: 'jamie@skillflow.demo', password: 'demo123', verified: true },
  { id: 'student-sam', role: 'student', name: 'Sam M.', email: 'sam@skillflow.demo', password: 'demo123', verified: true },
  { id: 'student-elis', role: 'student', name: 'Elis G.', email: 'elis@skillflow.demo', password: 'demo123', verified: true },
];

const createSeedState = (): PersistedDemoState => ({
  version: 5,
  currentAccountId: null,
  accounts: seededAccounts,
  services: seededServices,
  bookings: [],
  projectPosts: [{ id: 'post-mark-mobile-ui', clientId: 'client-mark', title: 'Mobile App UI Design', description: 'Create a polished mobile ordering experience for a local coffee shop, including five key screens and a reusable visual system.', category: 'Web & App', budget: 2000, deadline: '2026-09-30', skills: ['UI/UX', 'Mobile Design', 'Prototyping'], status: 'open', createdAt: '2026-08-20T00:00:00.000Z', updatedAt: '2026-08-20T00:00:00.000Z' }],
  proposals: [],
  messages: [],
  notifications: [],
  ledger: [],
  reviews: [],
  profiles: [
    { accountId: 'student-alex', bio: 'Student graphic designer focused on clean brand identities.', location: 'Batangas City', school: 'Batangas State University TNEU', program: 'Arts and Design', gradeLevel: 'Grade 12', graduationYear: 2027, skills: ['Logo Design', 'Branding', 'Illustration'] },
    { accountId: 'client-mark', bio: 'Local client supporting student creative talent.', location: 'Batangas City', organization: 'Mark’s Coffee Shop', skills: [] },
    { accountId: 'student-jamie', bio: 'Student UI/UX designer.', location: 'Batangas City', school: 'Batangas State University TNEU', program: 'ICT', gradeLevel: 'Grade 12', graduationYear: 2027, skills: ['UI/UX', 'Prototyping'] },
    { accountId: 'student-sam', bio: 'Student poster designer.', location: 'Batangas City', school: 'Batangas State University TNEU', program: 'Arts and Design', gradeLevel: 'Grade 11', graduationYear: 2028, skills: ['Poster Design'] },
    { accountId: 'student-elis', bio: 'Student digital illustrator.', location: 'Batangas City', school: 'Batangas State University TNEU', program: 'Arts and Design', gradeLevel: 'Grade 12', graduationYear: 2027, skills: ['Illustration'] },
  ],
  verifications: seededAccounts.filter((account) => account.role === 'student').map((account) => ({ studentId: account.id, status: 'verified', school: 'Batangas State University TNEU', studentNumberMasked: '2026-****-DEMO', program: 'Senior High School', gradeLevel: 'Grade 12', graduationYear: 2027, sampleDocumentName: 'Seeded demo student ID', submittedAt: '2026-08-01T00:00:00.000Z', reviewedAt: '2026-08-01T00:00:00.000Z' })),
  portfolioItems: [{ id: 'portfolio-alex-logo', studentId: 'student-alex', title: 'Coffee Shop Brand Study', description: 'A sample identity study demonstrating logo exploration and presentation.', category: 'Graphics & Design', createdAt: '2026-08-01T00:00:00.000Z' }],
  certifications: [{ id: 'cert-alex-design', studentId: 'student-alex', name: 'Introduction to Graphic Design', issuer: 'SkillFlow Demo Academy', year: 2026, createdAt: '2026-08-01T00:00:00.000Z' }],
  savedServiceIds: ['logo'],
  mentorMessages: [],
  preferences: { notificationsEnabled: true, darkMode: false, language: 'English' },
});

const arrayOr = <T,>(value: unknown, fallback: T[]): T[] => Array.isArray(value) ? value as T[] : fallback;
const migratedProfiles = (candidate: Partial<PersistedDemoState>, seed: PersistedDemoState) => arrayOr(candidate.profiles, candidate.accounts!.map((account) => seed.profiles.find((profile) => profile.accountId === account.id) ?? { accountId: account.id, bio: '', location: '', skills: [] }));
const migratedVerifications = (candidate: Partial<PersistedDemoState>, seed: PersistedDemoState): StudentVerification[] => arrayOr<StudentVerification>(candidate.verifications, candidate.accounts!.filter((account) => account.role === 'student').map((account): StudentVerification => seed.verifications.find((verification) => verification.studentId === account.id) ?? { studentId: account.id, status: account.verified ? 'verified' : 'not_submitted', school: '', studentNumberMasked: '', program: '', gradeLevel: '' }));
const migratedPreferences = (value: unknown, seed: DemoPreferences): DemoPreferences => value && typeof value === 'object' ? { ...seed, ...value } : seed;

const migrateState = (value: unknown): PersistedDemoState | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PersistedDemoState> & { version?: number };
  if (!Array.isArray(candidate.accounts) || !Array.isArray(candidate.services) || !Array.isArray(candidate.bookings) || !Array.isArray(candidate.savedServiceIds)) return null;
  const now = new Date().toISOString();
  const seed = createSeedState();
  return {
    version: 5,
    currentAccountId: candidate.currentAccountId ?? null,
    accounts: candidate.accounts,
    services: candidate.services.map((service) => ({ ...service, status: service.status ?? 'published' })),
    bookings: candidate.bookings.map((booking) => ({ ...booking, updatedAt: booking.updatedAt ?? booking.createdAt ?? now })),
    projectPosts: arrayOr(candidate.projectPosts, seed.projectPosts),
    proposals: arrayOr(candidate.proposals, []),
    messages: arrayOr(candidate.messages, []),
    notifications: arrayOr(candidate.notifications, []),
    ledger: arrayOr(candidate.ledger, []),
    reviews: arrayOr(candidate.reviews, []),
    profiles: migratedProfiles(candidate, seed),
    verifications: migratedVerifications(candidate, seed),
    portfolioItems: arrayOr(candidate.portfolioItems, seed.portfolioItems),
    certifications: arrayOr(candidate.certifications, seed.certifications),
    savedServiceIds: candidate.savedServiceIds,
    mentorMessages: arrayOr(candidate.mentorMessages, []),
    preferences: migratedPreferences(candidate.preferences, seed.preferences),
  };
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const makeNotification = (userId: string, title: string, detail: string, kind: NotificationKind, projectId: string, createdAt: string): DemoNotification => ({ id: makeId('notification'), userId, title, detail, kind, projectId, createdAt, read: false });
const makeProjectPostNotification = (userId: string, title: string, detail: string, projectPostId: string, createdAt: string): DemoNotification => ({ id: makeId('notification'), userId, title, detail, kind: 'project', projectPostId, createdAt, read: false });
type ProposalDecisionPlan = { now: string; bookingId?: string };
type ProposalDecisionTransaction = { state: PersistedDemoState; result: ProposalDecisionResult };

const staleProposalDecision = (state: PersistedDemoState): ProposalDecisionTransaction => ({ state, result: { ok: false, message: 'This proposal is no longer available for a decision.' } });

const rejectProposal = (state: PersistedDemoState, proposal: Proposal, post: ProjectPost, proposalId: string, plan: ProposalDecisionPlan): ProposalDecisionTransaction => {
  const notification = makeProjectPostNotification(proposal.studentId, 'Proposal not selected', post.title, post.id, plan.now);
  return {
    state: { ...state, proposals: state.proposals.map((item) => item.id === proposalId ? { ...item, status: 'rejected' } : item), notifications: [notification, ...state.notifications] },
    result: { ok: true },
  };
};

const acceptProposal = (state: PersistedDemoState, proposal: Proposal, post: ProjectPost, proposalId: string, plan: ProposalDecisionPlan): ProposalDecisionTransaction => {
  if (!plan.bookingId) return staleProposalDecision(state);
  const booking: ProjectBooking = { id: plan.bookingId, source: 'proposal', projectPostId: post.id, proposalId: proposal.id, clientId: post.clientId, studentId: proposal.studentId, title: post.title, description: post.description, deliveryDays: proposal.deliveryDays, budget: proposal.amount, status: 'accepted', createdAt: plan.now, updatedAt: plan.now };
  const affected = state.proposals.filter((item) => item.projectPostId === post.id && item.status === 'submitted');
  const notifications = affected.map((item) => item.id === proposal.id ? makeNotification(item.studentId, 'Proposal accepted', post.title, 'project', booking.id, plan.now) : makeProjectPostNotification(item.studentId, 'Proposal not selected', post.title, post.id, plan.now));
  return {
    state: {
      ...state,
      projectPosts: state.projectPosts.map((item) => item.id === post.id ? { ...item, status: 'closed', acceptedProposalId: proposal.id, updatedAt: plan.now } : item),
      proposals: state.proposals.map((item) => item.projectPostId === post.id && item.status === 'submitted' ? { ...item, status: item.id === proposal.id ? 'accepted' : 'rejected' } : item),
      bookings: [booking, ...state.bookings],
      notifications: [...notifications, ...state.notifications],
    },
    result: { ok: true, bookingId: booking.id },
  };
};

const applyProposalDecision = (state: PersistedDemoState, proposalId: string, accept: boolean, clientId: string, plan: ProposalDecisionPlan): ProposalDecisionTransaction => {
  const proposal = state.proposals.find((item) => item.id === proposalId);
  if (!proposal) return staleProposalDecision(state);
  const post = state.projectPosts.find((item) => item.id === proposal.projectPostId);
  if (!post || post.clientId !== clientId) return staleProposalDecision(state);
  if (accept && state.bookings.some((item) => item.proposalId === proposal.id)) return { state, result: { ok: false, message: 'This proposal has already been accepted.' } };
  if (post.status !== 'open' || proposal.status !== 'submitted') return staleProposalDecision(state);
  return accept ? acceptProposal(state, proposal, post, proposalId, plan) : rejectProposal(state, proposal, post, proposalId, plan);
};

const mentorResponse = (body: string) => {
  const prompt = body.toLowerCase();
  if (prompt.includes('portfolio')) return 'Choose three to four pieces that show different skills. For each one, explain the goal, your design decisions, and the outcome. Lead with your strongest work.';
  if (prompt.includes('color') || prompt.includes('palette')) return 'Start with one primary color, one supporting color, and a neutral. Check text contrast, then test the palette in grayscale so hierarchy does not depend on color alone.';
  if (prompt.includes('check') || prompt.includes('review') || prompt.includes('design')) return 'Review the design in this order: visual hierarchy, alignment and spacing, contrast, readability, then consistency. Ask one classmate to describe what they notice first.';
  if (prompt.includes('idea') || prompt.includes('project')) return 'Turn the idea into a short brief: target user, problem, required deliverables, constraints, and one measurable success criterion. Build the smallest useful first version.';
  return 'Break the task into goal, audience, constraints, and next action. If you share those four details, I can provide a more focused deterministic demo response.';
};

const SessionContext = createContext<SessionValue | null>(null);

export type NavigationSessionValue = {
  currentAccount: DemoAccount | null;
  role: UserRole;
  messageUnread: boolean;
};

export const NavigationSessionContext = createContext<NavigationSessionValue | null>(null);

const NavigationSessionProvider = memo(function NavigationSessionProvider({ value, children }: PropsWithChildren<{ value: NavigationSessionValue }>) {
  return <NavigationSessionContext.Provider value={value}>{children}</NavigationSessionContext.Provider>;
});

const markNotificationReadState = (current: PersistedDemoState, notificationId: string) => {
  const notification = current.notifications.find((item) => item.id === notificationId);
  if (!notification || notification.read) return current;
  return { ...current, notifications: current.notifications.map((item) => item.id === notificationId ? { ...item, read: true } : item) };
};

const markProjectMessagesReadState = (current: PersistedDemoState, projectId: string, accountId: string) => {
  const hasUnreadMessage = current.messages.some((message) => message.projectId === projectId && !message.readBy.includes(accountId));
  const hasUnreadNotification = current.notifications.some((notification) => notification.userId === accountId && notification.projectId === projectId && notification.kind === 'message' && !notification.read);
  if (!hasUnreadMessage && !hasUnreadNotification) return current;
  return {
    ...current,
    messages: hasUnreadMessage ? current.messages.map((message) => message.projectId === projectId && !message.readBy.includes(accountId) ? { ...message, readBy: [...message.readBy, accountId] } : message) : current.messages,
    notifications: hasUnreadNotification ? current.notifications.map((notification) => notification.userId === accountId && notification.projectId === projectId && notification.kind === 'message' && !notification.read ? { ...notification, read: true } : notification) : current.notifications,
  };
};

const failure = (message: string): { ok: false; message: string } => ({ ok: false, message });

function verificationReviewIssue(account: DemoAccount | null, verification: StudentVerification | undefined, approved: boolean, rejectionReason?: string) {
  if (account?.role !== 'student') return 'Only a Student Designer verification can be reviewed in this demo.';
  if (verification?.status !== 'pending') return 'Submit verification before running the simulated review.';
  if (!approved && !rejectionReason?.trim()) return 'Select a simulated rejection reason.';
  return null;
}

function reviewedVerification(verification: StudentVerification, approved: boolean, rejectionReason?: string): StudentVerification {
  return { ...verification, status: approved ? 'verified' : 'rejected', reviewedAt: new Date().toISOString(), rejectionReason: approved ? undefined : rejectionReason?.trim() };
}

function validServiceInput(input: ServiceInput) {
  const missing = [input.title, input.subtitle, input.category, input.description, input.revisions].some((value) => !value.trim());
  return !missing && input.price > 0 && input.deliveryDays > 0;
}

function serviceIssue(account: DemoAccount | null, input: ServiceInput, publish: boolean, verification: StudentVerification | undefined, serviceId: string | undefined, existing: Service | undefined) {
  if (account?.role !== 'student') return 'Only Student Designers can manage services.';
  if (!validServiceInput(input)) return 'Complete all service fields with valid values.';
  if (publish && verification?.status !== 'verified') return 'Student verification is required before publishing a service.';
  if (serviceId && !existing) return 'You can only edit your own services.';
  return null;
}

function buildService(input: ServiceInput, publish: boolean, account: DemoAccount, existing?: Service): Service {
  const status = publish ? 'published' : 'draft';
  if (existing) return { ...existing, ...input, provider: account.name, status };
  return { ...input, id: makeId('service'), provider: account.name, providerId: account.id, rating: 0, reviews: 0, status, crop: seededServices[0].crop };
}

function validProjectPostInput(input: ProjectPostInput) {
  const missing = [input.title, input.description, input.category, input.deadline].some((value) => !value.trim());
  return !missing && input.budget > 0 && input.skills.some((skill) => skill.trim());
}

function projectPostIssue(account: DemoAccount | null, input: ProjectPostInput, projectPostId: string | undefined, existing: ProjectPost | undefined) {
  if (account?.role !== 'client') return 'Only Clients can manage project posts.';
  if (!validProjectPostInput(input)) return 'Complete every project field with valid values.';
  if (Number.isNaN(new Date(input.deadline).getTime())) return 'Use a valid deadline such as 2026-09-30.';
  if (projectPostId && !existing) return 'You can only edit your own project posts.';
  if (existing && ['closed', 'archived'].includes(existing.status)) return 'Closed or archived projects cannot be edited.';
  return null;
}

function buildProjectPost(input: ProjectPostInput, publish: boolean, account: DemoAccount, existing?: ProjectPost): ProjectPost {
  const now = new Date().toISOString();
  return { ...input, title: input.title.trim(), description: input.description.trim(), category: input.category.trim(), deadline: input.deadline.trim(), skills: input.skills.map((skill) => skill.trim()).filter(Boolean), id: existing?.id ?? makeId('post'), clientId: account.id, status: publish ? 'open' : 'draft', createdAt: existing?.createdAt ?? now, updatedAt: now, acceptedProposalId: existing?.acceptedProposalId };
}

function validProposalInput(input: ProposalInput) {
  return Boolean(input.coverLetter.trim()) && input.amount > 0 && input.deliveryDays > 0;
}

function proposalIssue(account: DemoAccount | null, verification: StudentVerification | undefined, post: ProjectPost | undefined, input: ProposalInput, hasActiveProposal: boolean) {
  if (account?.role !== 'student') return 'Only Student Designers can submit proposals.';
  if (verification?.status !== 'verified') return 'Complete simulated student verification before submitting a proposal.';
  if (post?.status !== 'open') return 'This project is not accepting proposals.';
  if (!validProposalInput(input)) return 'Add a cover letter, valid amount, and delivery time.';
  if (hasActiveProposal) return 'You already have an active proposal for this project.';
  return null;
}

type ProjectActionContext = { booking: ProjectBooking; account: DemoAccount; payload: ProjectActionPayload; now: string };
type ProjectActionUpdate = { status: ProjectStatus; notification: DemoNotification; deliveryNote?: string; revisionNote?: string; completedAt?: string; ledgerEntry?: DemoLedgerEntry; review?: ProjectReview };
type ProjectActionHandler = (context: ProjectActionContext) => ProjectActionUpdate | StoreResult;

function actionAllowed(context: ProjectActionContext, role: UserRole, statuses: ProjectStatus[]) {
  const actorId = role === 'client' ? context.booking.clientId : context.booking.studentId;
  return context.account.id === actorId && statuses.includes(context.booking.status);
}

function basicAction(context: ProjectActionContext, role: UserRole, statuses: ProjectStatus[], status: ProjectStatus, recipientId: string, title: string): ProjectActionUpdate | StoreResult {
  if (!actionAllowed(context, role, statuses)) return failure('This action is not available for the current account or project status.');
  return { status, notification: makeNotification(recipientId, title, context.booking.title, 'project', context.booking.id, context.now), deliveryNote: context.booking.deliveryNote, revisionNote: context.booking.revisionNote, completedAt: context.booking.completedAt };
}

const acceptProject: ProjectActionHandler = (context) => basicAction(context, 'student', ['requested'], 'accepted', context.booking.clientId, 'Request accepted');
const declineProject: ProjectActionHandler = (context) => basicAction(context, 'student', ['requested'], 'declined', context.booking.clientId, 'Request declined');
const cancelProject: ProjectActionHandler = (context) => basicAction(context, 'client', ['requested', 'accepted'], 'cancelled', context.booking.studentId, 'Request cancelled');
const startProject: ProjectActionHandler = (context) => basicAction(context, 'student', ['demo_funded'], 'in_progress', context.booking.clientId, 'Work started');

const fundProject: ProjectActionHandler = (context) => {
  if (!actionAllowed(context, 'client', ['accepted'])) return failure('This action is not available for the current account or project status.');
  const booking = context.booking;
  return { status: 'demo_funded', notification: makeNotification(booking.studentId, 'Demo funds reserved', booking.title, 'payment', booking.id, context.now), deliveryNote: booking.deliveryNote, revisionNote: booking.revisionNote, completedAt: booking.completedAt, ledgerEntry: { id: makeId('ledger'), userId: booking.clientId, projectId: booking.id, type: 'hold', amount: booking.budget, createdAt: context.now } };
};

const submitProject: ProjectActionHandler = (context) => {
  if (!actionAllowed(context, 'student', ['in_progress', 'revision_requested'])) return failure('This action is not available for the current account or project status.');
  const note = context.payload.note?.trim();
  if (!note) return failure('Add a delivery note before submitting.');
  return { status: 'submitted', notification: makeNotification(context.booking.clientId, 'Delivery submitted', context.booking.title, 'project', context.booking.id, context.now), deliveryNote: note, completedAt: context.booking.completedAt };
};

const requestProjectRevision: ProjectActionHandler = (context) => {
  if (!actionAllowed(context, 'client', ['submitted'])) return failure('This action is not available for the current account or project status.');
  const note = context.payload.note?.trim();
  if (!note) return failure('Explain the requested revision.');
  return { status: 'revision_requested', notification: makeNotification(context.booking.studentId, 'Revision requested', context.booking.title, 'project', context.booking.id, context.now), deliveryNote: context.booking.deliveryNote, revisionNote: note, completedAt: context.booking.completedAt };
};

const approveProject: ProjectActionHandler = (context) => {
  if (!actionAllowed(context, 'client', ['submitted'])) return failure('This action is not available for the current account or project status.');
  const booking = context.booking;
  return { status: 'completed', notification: makeNotification(booking.studentId, 'Project approved', `${booking.title} — simulated earnings released`, 'payment', booking.id, context.now), deliveryNote: booking.deliveryNote, revisionNote: booking.revisionNote, completedAt: context.now, ledgerEntry: { id: makeId('ledger'), userId: booking.studentId, projectId: booking.id, type: 'release', amount: booking.budget, createdAt: context.now } };
};

const reviewProject: ProjectActionHandler = (context) => {
  if (!actionAllowed(context, 'client', ['completed'])) return failure('This action is not available for the current account or project status.');
  const { rating, comment } = context.payload;
  if (!rating || rating < 1 || rating > 5 || !comment?.trim()) return failure('Choose a rating and add a review.');
  const booking = context.booking;
  const review = { id: makeId('review'), projectId: booking.id, clientId: booking.clientId, studentId: booking.studentId, rating, comment: comment.trim(), createdAt: context.now };
  return { status: 'reviewed', notification: makeNotification(booking.studentId, 'New client review', `${rating}/5 for ${booking.title}`, 'complete', booking.id, context.now), deliveryNote: booking.deliveryNote, revisionNote: booking.revisionNote, completedAt: booking.completedAt, review };
};

const projectActionHandlers: Record<ProjectAction, ProjectActionHandler> = { accept: acceptProject, decline: declineProject, cancel: cancelProject, fund: fundProject, start: startProject, submit: submitProject, request_revision: requestProjectRevision, approve: approveProject, review: reviewProject };

const SESSION_PERSIST_DEBOUNCE_MS = 100;

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setReactState] = useState<PersistedDemoState>(createSeedState);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  const setState = useCallback((update: SetStateAction<PersistedDemoState>) => {
    const next = typeof update === 'function' ? update(stateRef.current) : update;
    stateRef.current = next;
    setReactState(next);
  }, []);
  const persistenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistenceState = useRef<PersistedDemoState | null>(null);
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());
  const resetSnapshot = useRef<PersistedDemoState | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(LEGACY_STORAGE_KEY)])
      .then(([stored, legacy]) => {
        if (!active) return;
        const raw = stored ?? legacy;
        if (!raw) return;
        const migrated = migrateState(JSON.parse(raw) as unknown);
        if (migrated) setState(migrated);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setHydrated(true); });
    return () => { active = false; };
  }, [setState]);

  const queueSerializedState = useCallback((serialized: string) => {
    const queued = persistenceQueue.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(STORAGE_KEY, serialized))
      .catch(() => undefined);
    persistenceQueue.current = queued;
    return queued;
  }, []);

  const flushPendingPersistence = useCallback(() => {
    if (persistenceTimer.current) clearTimeout(persistenceTimer.current);
    persistenceTimer.current = null;
    const next = pendingPersistenceState.current;
    pendingPersistenceState.current = null;
    return next ? queueSerializedState(JSON.stringify(next)) : persistenceQueue.current;
  }, [queueSerializedState]);

  const scheduleStatePersistence = useCallback((snapshot: PersistedDemoState) => {
    pendingPersistenceState.current = snapshot;
    if (persistenceTimer.current) clearTimeout(persistenceTimer.current);
    persistenceTimer.current = setTimeout(() => {
      void flushPendingPersistence();
    }, SESSION_PERSIST_DEBOUNCE_MS);
  }, [flushPendingPersistence]);

  useEffect(() => {
    if (!hydrated) return;
    if (resetSnapshot.current === state) {
      resetSnapshot.current = null;
      return;
    }
    scheduleStatePersistence(state);
  }, [hydrated, scheduleStatePersistence, state]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') void flushPendingPersistence();
    });
    return () => {
      subscription.remove();
      void flushPendingPersistence();
    };
  }, [flushPendingPersistence]);

  const currentAccount = state.accounts.find((account) => account.id === state.currentAccountId) ?? null;
  const role = currentAccount?.role ?? 'student';

  const loginAsRole = useCallback((nextRole: UserRole) => {
    const demoId = nextRole === 'student' ? 'student-alex' : 'client-mark';
    setState((current) => ({ ...current, currentAccountId: demoId }));
  }, [setState]);

  const login = useCallback((email: string, password: string, selectedRole: UserRole): AuthResult => {
    const normalizedEmail = email.trim().toLowerCase();
    const account = state.accounts.find((candidate) => candidate.email.toLowerCase() === normalizedEmail);
    if (!account || account.password !== password) return { ok: false, message: 'Email or password is incorrect.' };
    if (account.role !== selectedRole) return { ok: false, message: `This account is registered as a ${account.role === 'student' ? 'Student Designer' : 'Client'}.` };
    setState((current) => ({ ...current, currentAccountId: account.id }));
    return { ok: true, account };
  }, [setState, state.accounts]);

  const registerAccount = useCallback((input: RegisterAccountInput): AuthResult => {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (state.accounts.some((account) => account.email.toLowerCase() === normalizedEmail)) return { ok: false, message: 'An account with this email already exists.' };
    const account: DemoAccount = { ...input, id: makeId(input.role), name: input.name.trim(), email: normalizedEmail, verified: input.role === 'client' };
    const profile: UserProfile = { accountId: account.id, bio: '', location: '', skills: [] };
    const verification: StudentVerification | null = input.role === 'student' ? { studentId: account.id, status: 'not_submitted', school: '', studentNumberMasked: '', program: '', gradeLevel: '' } : null;
    setState((current) => ({ ...current, accounts: [...current.accounts, account], profiles: [...current.profiles, profile], verifications: verification ? [...current.verifications, verification] : current.verifications, currentAccountId: account.id }));
    return { ok: true, account };
  }, [setState, state.accounts]);

  const updateProfile = useCallback((input: ProfileInput): StoreResult => {
    if (!currentAccount || !input.name.trim()) return { ok: false, message: 'A profile name is required.' };
    const profile: UserProfile = { accountId: currentAccount.id, bio: input.bio.trim(), location: input.location.trim(), organization: input.organization?.trim(), school: input.school?.trim(), program: input.program?.trim(), gradeLevel: input.gradeLevel?.trim(), graduationYear: input.graduationYear, skills: input.skills.map((skill) => skill.trim()).filter(Boolean) };
    setState((current) => ({
      ...current,
      accounts: current.accounts.map((account) => account.id === currentAccount.id ? { ...account, name: input.name.trim() } : account),
      profiles: current.profiles.some((item) => item.accountId === currentAccount.id) ? current.profiles.map((item) => item.accountId === currentAccount.id ? profile : item) : [...current.profiles, profile],
      services: current.services.map((service) => service.providerId === currentAccount.id ? { ...service, provider: input.name.trim() } : service),
    }));
    return { ok: true };
  }, [currentAccount, setState]);

  const submitVerification = useCallback((input: VerificationInput): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'Only Student Designer accounts can submit verification.' };
    if (!input.school.trim() || !input.studentNumber.trim() || !input.program.trim() || !input.gradeLevel.trim() || !input.graduationYear || !input.sampleDocumentName) return { ok: false, message: 'Complete every verification field and select the sample student ID.' };
    const normalized = input.studentNumber.replace(/\s/g, '');
    if (normalized.length < 6) return { ok: false, message: 'Enter a student number with at least 6 characters.' };
    const now = new Date().toISOString();
    const masked = `${normalized.slice(0, 4)}-****-${normalized.slice(-4)}`;
    const record: StudentVerification = { studentId: currentAccount.id, status: 'pending', school: input.school.trim(), studentNumberMasked: masked, program: input.program.trim(), gradeLevel: input.gradeLevel.trim(), graduationYear: input.graduationYear, sampleDocumentName: input.sampleDocumentName, submittedAt: now };
    setState((current) => ({
      ...current,
      accounts: current.accounts.map((account) => account.id === currentAccount.id ? { ...account, verified: false } : account),
      verifications: current.verifications.some((item) => item.studentId === currentAccount.id) ? current.verifications.map((item) => item.studentId === currentAccount.id ? record : item) : [...current.verifications, record],
      profiles: current.profiles.map((profile) => profile.accountId === currentAccount.id ? { ...profile, school: record.school, program: record.program, gradeLevel: record.gradeLevel, graduationYear: record.graduationYear } : profile),
    }));
    return { ok: true };
  }, [currentAccount, setState]);

  const simulateVerificationReview = useCallback((approved: boolean, rejectionReason?: string): StoreResult => {
    const verification = state.verifications.find((item) => item.studentId === currentAccount?.id);
    const issue = verificationReviewIssue(currentAccount, verification, approved, rejectionReason);
    if (issue || !verification || !currentAccount) return failure(issue ?? 'A current account is required.');
    const updated = reviewedVerification(verification, approved, rejectionReason);
    setState((current) => ({ ...current, accounts: current.accounts.map((account) => account.id === currentAccount.id ? { ...account, verified: approved } : account), verifications: current.verifications.map((item) => item.studentId === currentAccount.id ? updated : item) }));
    return { ok: true };
  }, [currentAccount, setState, state.verifications]);

  const addPortfolioItem = useCallback((input: PortfolioInput): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'Only Student Designers have portfolios.' };
    if (!input.title.trim() || !input.description.trim() || !input.category.trim()) return { ok: false, message: 'Complete the portfolio title, category, and description.' };
    const item: PortfolioItem = { id: makeId('portfolio'), studentId: currentAccount.id, title: input.title.trim(), description: input.description.trim(), category: input.category.trim(), sourceProjectId: input.sourceProjectId, createdAt: new Date().toISOString() };
    setState((current) => ({ ...current, portfolioItems: [item, ...current.portfolioItems] }));
    return { ok: true };
  }, [currentAccount, setState]);

  const addCertification = useCallback((input: CertificationInput): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'Only Student Designers can add certifications.' };
    if (!input.name.trim() || !input.issuer.trim() || input.year < 2000 || input.year > 2100) return { ok: false, message: 'Enter a certification, issuer, and valid year.' };
    const item: Certification = { id: makeId('certification'), studentId: currentAccount.id, name: input.name.trim(), issuer: input.issuer.trim(), year: input.year, createdAt: new Date().toISOString() };
    setState((current) => ({ ...current, certifications: [item, ...current.certifications] }));
    return { ok: true };
  }, [currentAccount, setState]);

  const addCompletedProjectToPortfolio = useCallback((projectId: string): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'Only Student Designers can add completed work.' };
    const booking = state.bookings.find((item) => item.id === projectId && item.studentId === currentAccount.id && ['completed', 'reviewed'].includes(item.status));
    if (!booking) return { ok: false, message: 'Only your completed projects can be added to the portfolio.' };
    if (state.portfolioItems.some((item) => item.sourceProjectId === projectId)) return { ok: false, message: 'This project is already in your portfolio.' };
    const item: PortfolioItem = { id: makeId('portfolio'), studentId: currentAccount.id, title: booking.title, description: booking.deliveryNote ?? booking.description, category: 'Completed Client Project', sourceProjectId: projectId, createdAt: new Date().toISOString() };
    setState((current) => ({ ...current, portfolioItems: [item, ...current.portfolioItems] }));
    return { ok: true };
  }, [currentAccount, setState, state.bookings, state.portfolioItems]);

  const saveService = useCallback((input: ServiceInput, publish: boolean, serviceId?: string): ServiceResult => {
    const verification = state.verifications.find((item) => item.studentId === currentAccount?.id);
    const existing = serviceId ? state.services.find((service) => service.id === serviceId && service.providerId === currentAccount?.id) : undefined;
    const issue = serviceIssue(currentAccount, input, publish, verification, serviceId, existing);
    if (issue || !currentAccount) return failure(issue ?? 'A current account is required.');
    const service = buildService(input, publish, currentAccount, existing);
    setState((current) => ({ ...current, services: existing ? current.services.map((item) => item.id === existing.id ? service : item) : [service, ...current.services] }));
    return { ok: true, service };
  }, [currentAccount, setState, state.services, state.verifications]);

  const setServiceStatus = useCallback((serviceId: string, status: Service['status']): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'Only Student Designers can manage services.' };
    const service = state.services.find((item) => item.id === serviceId && item.providerId === currentAccount.id);
    if (!service) return { ok: false, message: 'You can only update your own services.' };
    if (status === 'published' && state.verifications.find((item) => item.studentId === currentAccount.id)?.status !== 'verified') return { ok: false, message: 'Student verification is required before publishing.' };
    setState((current) => ({ ...current, services: current.services.map((item) => item.id === serviceId ? { ...item, status } : item) }));
    return { ok: true };
  }, [currentAccount, setState, state.services, state.verifications]);

  const saveProjectPost = useCallback((input: ProjectPostInput, publish: boolean, projectPostId?: string): ProjectPostResult => {
    const existing = projectPostId ? state.projectPosts.find((item) => item.id === projectPostId && item.clientId === currentAccount?.id) : undefined;
    const issue = projectPostIssue(currentAccount, input, projectPostId, existing);
    if (issue || !currentAccount) return failure(issue ?? 'A current account is required.');
    const projectPost = buildProjectPost(input, publish, currentAccount, existing);
    setState((current) => ({ ...current, projectPosts: existing ? current.projectPosts.map((item) => item.id === existing.id ? projectPost : item) : [projectPost, ...current.projectPosts] }));
    return { ok: true, projectPost };
  }, [currentAccount, setState, state.projectPosts]);

  const setProjectPostStatus = useCallback((projectPostId: string, status: ProjectPostStatus): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'client') return { ok: false, message: 'Only Clients can manage project posts.' };
    const post = state.projectPosts.find((item) => item.id === projectPostId && item.clientId === currentAccount.id);
    if (!post) return { ok: false, message: 'You can only update your own project posts.' };
    if (post.acceptedProposalId && status !== 'archived') return { ok: false, message: 'A project with an accepted proposal must remain closed.' };
    if (status === 'open' && post.status === 'archived') return { ok: false, message: 'Archived projects cannot be reopened.' };
    setState((current) => ({ ...current, projectPosts: current.projectPosts.map((item) => item.id === projectPostId ? { ...item, status, updatedAt: new Date().toISOString() } : item) }));
    return { ok: true };
  }, [currentAccount, setState, state.projectPosts]);

  const submitProposal = useCallback((projectPostId: string, input: ProposalInput): StoreResult => {
    const verification = state.verifications.find((item) => item.studentId === currentAccount?.id);
    const post = state.projectPosts.find((item) => item.id === projectPostId);
    const hasActiveProposal = state.proposals.some((item) => item.projectPostId === projectPostId && item.studentId === currentAccount?.id && item.status === 'submitted');
    const issue = proposalIssue(currentAccount, verification, post, input, hasActiveProposal);
    if (issue || !currentAccount || !post) return failure(issue ?? 'A current account and open project are required.');
    const now = new Date().toISOString();
    const proposal: Proposal = { id: makeId('proposal'), projectPostId, studentId: currentAccount.id, coverLetter: input.coverLetter.trim(), amount: input.amount, deliveryDays: input.deliveryDays, status: 'submitted', createdAt: now };
    const notification = makeProjectPostNotification(post.clientId, 'New project proposal', `${currentAccount.name} proposed for ${post.title}`, post.id, now);
    setState((current) => ({ ...current, proposals: [proposal, ...current.proposals], notifications: [notification, ...current.notifications] }));
    return { ok: true };
  }, [currentAccount, setState, state.projectPosts, state.proposals, state.verifications]);

  const withdrawProposal = useCallback((proposalId: string): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'Only Student Designers can withdraw proposals.' };
    const proposal = state.proposals.find((item) => item.id === proposalId && item.studentId === currentAccount.id);
    if (!proposal || proposal.status !== 'submitted') return { ok: false, message: 'Only your submitted proposal can be withdrawn.' };
    setState((current) => ({ ...current, proposals: current.proposals.map((item) => item.id === proposalId ? { ...item, status: 'withdrawn' } : item) }));
    return { ok: true };
  }, [currentAccount, setState, state.proposals]);

  const decideProposal = useCallback((proposalId: string, accept: boolean): ProposalDecisionResult => {
    if (!currentAccount || currentAccount.role !== 'client') return { ok: false, message: 'Only the project Client can decide proposals.' };
    const plan: ProposalDecisionPlan = { now: new Date().toISOString(), bookingId: accept ? makeId('booking') : undefined };
    const transaction = applyProposalDecision(stateRef.current, proposalId, accept, currentAccount.id, plan);
    if (!transaction.result.ok) return transaction.result;
    setState(transaction.state);
    return transaction.result;
  }, [currentAccount, setState]);

  const logout = useCallback(() => setState((current) => ({ ...current, currentAccountId: null })), [setState]);

  const createBooking = useCallback((input: CreateBookingInput) => {
    const clientId = currentAccount?.role === 'client' ? currentAccount.id : state.accounts.find((account) => account.id === 'client-mark')?.id;
    if (!clientId) throw new Error('A client demo account is required to create a booking.');
    const now = new Date().toISOString();
    const booking: ProjectBooking = { ...input, id: makeId('booking'), source: 'service_request', clientId, status: 'requested', createdAt: now, updatedAt: now };
    const notification = makeNotification(input.studentId, 'New service request', input.title, 'project', booking.id, now);
    setState((current) => ({ ...current, bookings: [booking, ...current.bookings], notifications: [notification, ...current.notifications] }));
    return booking;
  }, [currentAccount, setState, state.accounts]);

  const actOnProject = useCallback((projectId: string, action: ProjectAction, payload: ProjectActionPayload = {}): StoreResult => {
    const booking = state.bookings.find((item) => item.id === projectId);
    if (!booking || !currentAccount) return failure('Project or active account not found.');
    const now = new Date().toISOString();
    const transition = projectActionHandlers[action]({ booking, account: currentAccount, payload, now });
    if ('ok' in transition) return transition;
    const updated: ProjectBooking = { ...booking, status: transition.status, updatedAt: now, deliveryNote: transition.deliveryNote, revisionNote: transition.revisionNote, completedAt: transition.completedAt };
    setState((current) => ({
      ...current,
      bookings: current.bookings.map((item) => item.id === projectId ? updated : item),
      notifications: [transition.notification, ...current.notifications],
      ledger: transition.ledgerEntry ? [transition.ledgerEntry, ...current.ledger] : current.ledger,
      reviews: transition.review ? [transition.review, ...current.reviews] : current.reviews,
    }));
    return { ok: true };
  }, [currentAccount, setState, state.bookings]);

  const sendMessage = useCallback((projectId: string, body: string): StoreResult => {
    const booking = state.bookings.find((item) => item.id === projectId);
    const trimmed = body.trim();
    if (!booking || !currentAccount || !trimmed) return { ok: false, message: 'Enter a message first.' };
    if (currentAccount.id !== booking.clientId && currentAccount.id !== booking.studentId) return { ok: false, message: 'This account is not part of the project.' };
    const now = new Date().toISOString();
    const recipientId = currentAccount.id === booking.clientId ? booking.studentId : booking.clientId;
    const message: ProjectMessage = { id: makeId('message'), projectId, senderId: currentAccount.id, body: trimmed, createdAt: now, readBy: [currentAccount.id] };
    const notification = makeNotification(recipientId, `${currentAccount.name} sent a message`, trimmed, 'message', projectId, now);
    setState((current) => ({ ...current, messages: [...current.messages, message], notifications: [notification, ...current.notifications] }));
    return { ok: true };
  }, [currentAccount, setState, state.bookings]);

  const markNotificationRead = useCallback((notificationId: string) => setState((current) => markNotificationReadState(current, notificationId)), [setState]);
  const currentAccountId = currentAccount?.id;
  const markProjectMessagesRead = useCallback((projectId: string) => {
    if (currentAccountId) setState((current) => markProjectMessagesReadState(current, projectId, currentAccountId));
  }, [currentAccountId, setState]);
  const sendMentorMessage = useCallback((body: string): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'The AI Project Mentor is available to Student Designers.' };
    const trimmed = body.trim();
    if (!trimmed) return { ok: false, message: 'Enter a mentor question first.' };
    const now = new Date().toISOString();
    const userMessage: MentorMessage = { id: makeId('mentor-user'), accountId: currentAccount.id, role: 'user', body: trimmed, createdAt: now };
    const reply: MentorMessage = { id: makeId('mentor-reply'), accountId: currentAccount.id, role: 'mentor', body: mentorResponse(trimmed), createdAt: new Date(Date.now() + 1).toISOString() };
    setState((current) => ({ ...current, mentorMessages: [...current.mentorMessages, userMessage, reply] }));
    return { ok: true };
  }, [currentAccount, setState]);
  const clearMentorConversation = useCallback(() => { if (currentAccount) setState((current) => ({ ...current, mentorMessages: current.mentorMessages.filter((item) => item.accountId !== currentAccount.id) })); }, [currentAccount, setState]);
  const updatePreferences = useCallback((input: Partial<DemoPreferences>) => setState((current) => ({ ...current, preferences: { ...current.preferences, ...input, language: 'English' } })), [setState]);
  const changePassword = useCallback((currentPassword: string, newPassword: string): StoreResult => {
    if (!currentAccount || currentAccount.password !== currentPassword) return { ok: false, message: 'Current password is incorrect.' };
    if (newPassword.length < 6) return { ok: false, message: 'New password must contain at least 6 characters.' };
    if (currentPassword === newPassword) return { ok: false, message: 'Choose a password different from the current password.' };
    setState((current) => ({ ...current, accounts: current.accounts.map((account) => account.id === currentAccount.id ? { ...account, password: newPassword } : account) }));
    return { ok: true };
  }, [currentAccount, setState]);
  const toggleSavedService = useCallback((serviceId: string) => setState((current) => ({ ...current, savedServiceIds: current.savedServiceIds.includes(serviceId) ? current.savedServiceIds.filter((id) => id !== serviceId) : [...current.savedServiceIds, serviceId] })), [setState]);
  const resetDemoData = useCallback(async () => {
    const seed = createSeedState();
    if (persistenceTimer.current) clearTimeout(persistenceTimer.current);
    persistenceTimer.current = null;
    pendingPersistenceState.current = null;
    resetSnapshot.current = seed;
    setState(seed);
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        queueSerializedState(JSON.stringify(seed)).then(resolve);
      }, 0);
    });
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY).catch(() => undefined);
  }, [queueSerializedState, setState]);

  const unreadCount = currentAccount && state.preferences.notificationsEnabled ? state.notifications.filter((item) => item.userId === currentAccount.id && !item.read).length : 0;
  const getCareerReadiness = useCallback((studentId: string) => calculateCareerReadiness(studentId, state), [state]);
  const value = useMemo<SessionValue>(() => ({
    hydrated, role, setRole: loginAsRole, loginAsRole, login, registerAccount, logout,
    homeRoute: role === 'student' ? '/student-home' : '/client-home', currentAccount,
    accounts: state.accounts, services: state.services, bookings: state.bookings, projectPosts: state.projectPosts, proposals: state.proposals, messages: state.messages,
    notifications: state.notifications, ledger: state.ledger, reviews: state.reviews, profiles: state.profiles,
    verifications: state.verifications, portfolioItems: state.portfolioItems, certifications: state.certifications, savedServiceIds: state.savedServiceIds, mentorMessages: state.mentorMessages, preferences: state.preferences,
    unreadCount, getCareerReadiness, createBooking, actOnProject, sendMessage, markNotificationRead, markProjectMessagesRead,
    updateProfile, submitVerification, simulateVerificationReview, addPortfolioItem, addCertification, addCompletedProjectToPortfolio,
    saveService, setServiceStatus, saveProjectPost, setProjectPostStatus, submitProposal, withdrawProposal, decideProposal, toggleSavedService, sendMentorMessage, clearMentorConversation, updatePreferences, changePassword, resetDemoData,
  }), [actOnProject, addCertification, addCompletedProjectToPortfolio, addPortfolioItem, changePassword, clearMentorConversation, createBooking, currentAccount, decideProposal, getCareerReadiness, hydrated, login, loginAsRole, logout, markNotificationRead, markProjectMessagesRead, registerAccount, resetDemoData, role, saveProjectPost, saveService, sendMentorMessage, sendMessage, setProjectPostStatus, setServiceStatus, simulateVerificationReview, state, submitProposal, submitVerification, toggleSavedService, unreadCount, updatePreferences, updateProfile, withdrawProposal]);

  const messageUnread = Boolean(currentAccount && state.messages.some((message) => message.senderId !== currentAccount.id && !message.readBy.includes(currentAccount.id)));
  const navigationValue = useMemo<NavigationSessionValue>(() => ({ currentAccount, role, messageUnread }), [currentAccount, messageUnread, role]);

  return <SessionContext.Provider value={value}><NavigationSessionProvider value={navigationValue}>{children}</NavigationSessionProvider></SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

export function useNavigationSession() {
  const value = useContext(NavigationSessionContext);
  if (!value) throw new Error('useNavigationSession must be used inside SessionProvider');
  return value;
}
