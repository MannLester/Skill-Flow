import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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
    projectPosts: Array.isArray(candidate.projectPosts) ? candidate.projectPosts : seed.projectPosts,
    proposals: Array.isArray(candidate.proposals) ? candidate.proposals : [],
    messages: Array.isArray(candidate.messages) ? candidate.messages : [],
    notifications: Array.isArray(candidate.notifications) ? candidate.notifications : [],
    ledger: Array.isArray(candidate.ledger) ? candidate.ledger : [],
    reviews: Array.isArray(candidate.reviews) ? candidate.reviews : [],
    profiles: Array.isArray(candidate.profiles) ? candidate.profiles : candidate.accounts.map((account) => seed.profiles.find((profile) => profile.accountId === account.id) ?? { accountId: account.id, bio: '', location: '', skills: [] }),
    verifications: Array.isArray(candidate.verifications) ? candidate.verifications : candidate.accounts.filter((account) => account.role === 'student').map((account) => seed.verifications.find((verification) => verification.studentId === account.id) ?? { studentId: account.id, status: account.verified ? 'verified' : 'not_submitted', school: '', studentNumberMasked: '', program: '', gradeLevel: '' }),
    portfolioItems: Array.isArray(candidate.portfolioItems) ? candidate.portfolioItems : seed.portfolioItems,
    certifications: Array.isArray(candidate.certifications) ? candidate.certifications : seed.certifications,
    savedServiceIds: candidate.savedServiceIds,
    mentorMessages: Array.isArray(candidate.mentorMessages) ? candidate.mentorMessages : [],
    preferences: candidate.preferences && typeof candidate.preferences === 'object' ? { ...seed.preferences, ...candidate.preferences } : seed.preferences,
  };
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const makeNotification = (userId: string, title: string, detail: string, kind: NotificationKind, projectId: string, createdAt: string): DemoNotification => ({ id: makeId('notification'), userId, title, detail, kind, projectId, createdAt, read: false });
const makeProjectPostNotification = (userId: string, title: string, detail: string, projectPostId: string, createdAt: string): DemoNotification => ({ id: makeId('notification'), userId, title, detail, kind: 'project', projectPostId, createdAt, read: false });
const mentorResponse = (body: string) => {
  const prompt = body.toLowerCase();
  if (prompt.includes('portfolio')) return 'Choose three to four pieces that show different skills. For each one, explain the goal, your design decisions, and the outcome. Lead with your strongest work.';
  if (prompt.includes('color') || prompt.includes('palette')) return 'Start with one primary color, one supporting color, and a neutral. Check text contrast, then test the palette in grayscale so hierarchy does not depend on color alone.';
  if (prompt.includes('check') || prompt.includes('review') || prompt.includes('design')) return 'Review the design in this order: visual hierarchy, alignment and spacing, contrast, readability, then consistency. Ask one classmate to describe what they notice first.';
  if (prompt.includes('idea') || prompt.includes('project')) return 'Turn the idea into a short brief: target user, problem, required deliverables, constraints, and one measurable success criterion. Build the smallest useful first version.';
  return 'Break the task into goal, audience, constraints, and next action. If you share those four details, I can provide a more focused deterministic demo response.';
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<PersistedDemoState>(createSeedState);
  const [hydrated, setHydrated] = useState(false);

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
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [hydrated, state]);

  const currentAccount = state.accounts.find((account) => account.id === state.currentAccountId) ?? null;
  const role = currentAccount?.role ?? 'student';

  const loginAsRole = useCallback((nextRole: UserRole) => {
    const demoId = nextRole === 'student' ? 'student-alex' : 'client-mark';
    setState((current) => ({ ...current, currentAccountId: demoId }));
  }, []);

  const login = useCallback((email: string, password: string, selectedRole: UserRole): AuthResult => {
    const normalizedEmail = email.trim().toLowerCase();
    const account = state.accounts.find((candidate) => candidate.email.toLowerCase() === normalizedEmail);
    if (!account || account.password !== password) return { ok: false, message: 'Email or password is incorrect.' };
    if (account.role !== selectedRole) return { ok: false, message: `This account is registered as a ${account.role === 'student' ? 'Student Designer' : 'Client'}.` };
    setState((current) => ({ ...current, currentAccountId: account.id }));
    return { ok: true, account };
  }, [state.accounts]);

  const registerAccount = useCallback((input: RegisterAccountInput): AuthResult => {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (state.accounts.some((account) => account.email.toLowerCase() === normalizedEmail)) return { ok: false, message: 'An account with this email already exists.' };
    const account: DemoAccount = { ...input, id: makeId(input.role), name: input.name.trim(), email: normalizedEmail, verified: input.role === 'client' };
    const profile: UserProfile = { accountId: account.id, bio: '', location: '', skills: [] };
    const verification: StudentVerification | null = input.role === 'student' ? { studentId: account.id, status: 'not_submitted', school: '', studentNumberMasked: '', program: '', gradeLevel: '' } : null;
    setState((current) => ({ ...current, accounts: [...current.accounts, account], profiles: [...current.profiles, profile], verifications: verification ? [...current.verifications, verification] : current.verifications, currentAccountId: account.id }));
    return { ok: true, account };
  }, [state.accounts]);

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
  }, [currentAccount]);

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
  }, [currentAccount]);

  const simulateVerificationReview = useCallback((approved: boolean, rejectionReason?: string): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'Only a Student Designer verification can be reviewed in this demo.' };
    const verification = state.verifications.find((item) => item.studentId === currentAccount.id);
    if (!verification || verification.status !== 'pending') return { ok: false, message: 'Submit verification before running the simulated review.' };
    if (!approved && !rejectionReason?.trim()) return { ok: false, message: 'Select a simulated rejection reason.' };
    const updated: StudentVerification = { ...verification, status: approved ? 'verified' : 'rejected', reviewedAt: new Date().toISOString(), rejectionReason: approved ? undefined : rejectionReason?.trim() };
    setState((current) => ({ ...current, accounts: current.accounts.map((account) => account.id === currentAccount.id ? { ...account, verified: approved } : account), verifications: current.verifications.map((item) => item.studentId === currentAccount.id ? updated : item) }));
    return { ok: true };
  }, [currentAccount, state.verifications]);

  const addPortfolioItem = useCallback((input: PortfolioInput): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'Only Student Designers have portfolios.' };
    if (!input.title.trim() || !input.description.trim() || !input.category.trim()) return { ok: false, message: 'Complete the portfolio title, category, and description.' };
    const item: PortfolioItem = { id: makeId('portfolio'), studentId: currentAccount.id, title: input.title.trim(), description: input.description.trim(), category: input.category.trim(), sourceProjectId: input.sourceProjectId, createdAt: new Date().toISOString() };
    setState((current) => ({ ...current, portfolioItems: [item, ...current.portfolioItems] }));
    return { ok: true };
  }, [currentAccount]);

  const addCertification = useCallback((input: CertificationInput): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'Only Student Designers can add certifications.' };
    if (!input.name.trim() || !input.issuer.trim() || input.year < 2000 || input.year > 2100) return { ok: false, message: 'Enter a certification, issuer, and valid year.' };
    const item: Certification = { id: makeId('certification'), studentId: currentAccount.id, name: input.name.trim(), issuer: input.issuer.trim(), year: input.year, createdAt: new Date().toISOString() };
    setState((current) => ({ ...current, certifications: [item, ...current.certifications] }));
    return { ok: true };
  }, [currentAccount]);

  const addCompletedProjectToPortfolio = useCallback((projectId: string): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'Only Student Designers can add completed work.' };
    const booking = state.bookings.find((item) => item.id === projectId && item.studentId === currentAccount.id && ['completed', 'reviewed'].includes(item.status));
    if (!booking) return { ok: false, message: 'Only your completed projects can be added to the portfolio.' };
    if (state.portfolioItems.some((item) => item.sourceProjectId === projectId)) return { ok: false, message: 'This project is already in your portfolio.' };
    const item: PortfolioItem = { id: makeId('portfolio'), studentId: currentAccount.id, title: booking.title, description: booking.deliveryNote ?? booking.description, category: 'Completed Client Project', sourceProjectId: projectId, createdAt: new Date().toISOString() };
    setState((current) => ({ ...current, portfolioItems: [item, ...current.portfolioItems] }));
    return { ok: true };
  }, [currentAccount, state.bookings, state.portfolioItems]);

  const saveService = useCallback((input: ServiceInput, publish: boolean, serviceId?: string): ServiceResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'Only Student Designers can manage services.' };
    if (!input.title.trim() || !input.subtitle.trim() || !input.category.trim() || !input.description.trim() || input.price <= 0 || input.deliveryDays <= 0 || !input.revisions.trim()) return { ok: false, message: 'Complete all service fields with valid values.' };
    const verification = state.verifications.find((item) => item.studentId === currentAccount.id);
    if (publish && verification?.status !== 'verified') return { ok: false, message: 'Student verification is required before publishing a service.' };
    const existing = serviceId ? state.services.find((service) => service.id === serviceId && service.providerId === currentAccount.id) : undefined;
    if (serviceId && !existing) return { ok: false, message: 'You can only edit your own services.' };
    const service: Service = existing ? { ...existing, ...input, provider: currentAccount.name, status: publish ? 'published' : 'draft' } : { ...input, id: makeId('service'), provider: currentAccount.name, providerId: currentAccount.id, rating: 0, reviews: 0, status: publish ? 'published' : 'draft', crop: seededServices[0].crop };
    setState((current) => ({ ...current, services: existing ? current.services.map((item) => item.id === existing.id ? service : item) : [service, ...current.services] }));
    return { ok: true, service };
  }, [currentAccount, state.services, state.verifications]);

  const setServiceStatus = useCallback((serviceId: string, status: Service['status']): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'Only Student Designers can manage services.' };
    const service = state.services.find((item) => item.id === serviceId && item.providerId === currentAccount.id);
    if (!service) return { ok: false, message: 'You can only update your own services.' };
    if (status === 'published' && state.verifications.find((item) => item.studentId === currentAccount.id)?.status !== 'verified') return { ok: false, message: 'Student verification is required before publishing.' };
    setState((current) => ({ ...current, services: current.services.map((item) => item.id === serviceId ? { ...item, status } : item) }));
    return { ok: true };
  }, [currentAccount, state.services, state.verifications]);

  const saveProjectPost = useCallback((input: ProjectPostInput, publish: boolean, projectPostId?: string): ProjectPostResult => {
    if (!currentAccount || currentAccount.role !== 'client') return { ok: false, message: 'Only Clients can manage project posts.' };
    if (!input.title.trim() || !input.description.trim() || !input.category.trim() || input.budget <= 0 || !input.deadline.trim() || !input.skills.some((skill) => skill.trim())) return { ok: false, message: 'Complete every project field with valid values.' };
    const deadline = new Date(input.deadline);
    if (Number.isNaN(deadline.getTime())) return { ok: false, message: 'Use a valid deadline such as 2026-09-30.' };
    const existing = projectPostId ? state.projectPosts.find((item) => item.id === projectPostId && item.clientId === currentAccount.id) : undefined;
    if (projectPostId && !existing) return { ok: false, message: 'You can only edit your own project posts.' };
    if (existing && ['closed', 'archived'].includes(existing.status)) return { ok: false, message: 'Closed or archived projects cannot be edited.' };
    const now = new Date().toISOString();
    const projectPost: ProjectPost = {
      ...input,
      title: input.title.trim(), description: input.description.trim(), category: input.category.trim(), deadline: input.deadline.trim(),
      skills: input.skills.map((skill) => skill.trim()).filter(Boolean),
      id: existing?.id ?? makeId('post'), clientId: currentAccount.id,
      status: publish ? 'open' : 'draft', createdAt: existing?.createdAt ?? now, updatedAt: now,
      acceptedProposalId: existing?.acceptedProposalId,
    };
    setState((current) => ({ ...current, projectPosts: existing ? current.projectPosts.map((item) => item.id === existing.id ? projectPost : item) : [projectPost, ...current.projectPosts] }));
    return { ok: true, projectPost };
  }, [currentAccount, state.projectPosts]);

  const setProjectPostStatus = useCallback((projectPostId: string, status: ProjectPostStatus): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'client') return { ok: false, message: 'Only Clients can manage project posts.' };
    const post = state.projectPosts.find((item) => item.id === projectPostId && item.clientId === currentAccount.id);
    if (!post) return { ok: false, message: 'You can only update your own project posts.' };
    if (post.acceptedProposalId && status !== 'archived') return { ok: false, message: 'A project with an accepted proposal must remain closed.' };
    if (status === 'open' && post.status === 'archived') return { ok: false, message: 'Archived projects cannot be reopened.' };
    setState((current) => ({ ...current, projectPosts: current.projectPosts.map((item) => item.id === projectPostId ? { ...item, status, updatedAt: new Date().toISOString() } : item) }));
    return { ok: true };
  }, [currentAccount, state.projectPosts]);

  const submitProposal = useCallback((projectPostId: string, input: ProposalInput): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'Only Student Designers can submit proposals.' };
    const verification = state.verifications.find((item) => item.studentId === currentAccount.id);
    if (verification?.status !== 'verified') return { ok: false, message: 'Complete simulated student verification before submitting a proposal.' };
    const post = state.projectPosts.find((item) => item.id === projectPostId);
    if (!post || post.status !== 'open') return { ok: false, message: 'This project is not accepting proposals.' };
    if (!input.coverLetter.trim() || input.amount <= 0 || input.deliveryDays <= 0) return { ok: false, message: 'Add a cover letter, valid amount, and delivery time.' };
    if (state.proposals.some((item) => item.projectPostId === projectPostId && item.studentId === currentAccount.id && item.status === 'submitted')) return { ok: false, message: 'You already have an active proposal for this project.' };
    const now = new Date().toISOString();
    const proposal: Proposal = { id: makeId('proposal'), projectPostId, studentId: currentAccount.id, coverLetter: input.coverLetter.trim(), amount: input.amount, deliveryDays: input.deliveryDays, status: 'submitted', createdAt: now };
    const notification = makeProjectPostNotification(post.clientId, 'New project proposal', `${currentAccount.name} proposed for ${post.title}`, post.id, now);
    setState((current) => ({ ...current, proposals: [proposal, ...current.proposals], notifications: [notification, ...current.notifications] }));
    return { ok: true };
  }, [currentAccount, state.projectPosts, state.proposals, state.verifications]);

  const withdrawProposal = useCallback((proposalId: string): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'Only Student Designers can withdraw proposals.' };
    const proposal = state.proposals.find((item) => item.id === proposalId && item.studentId === currentAccount.id);
    if (!proposal || proposal.status !== 'submitted') return { ok: false, message: 'Only your submitted proposal can be withdrawn.' };
    setState((current) => ({ ...current, proposals: current.proposals.map((item) => item.id === proposalId ? { ...item, status: 'withdrawn' } : item) }));
    return { ok: true };
  }, [currentAccount, state.proposals]);

  const decideProposal = useCallback((proposalId: string, accept: boolean): ProposalDecisionResult => {
    if (!currentAccount || currentAccount.role !== 'client') return { ok: false, message: 'Only the project Client can decide proposals.' };
    const proposal = state.proposals.find((item) => item.id === proposalId);
    const post = proposal ? state.projectPosts.find((item) => item.id === proposal.projectPostId) : undefined;
    if (!proposal || !post || post.clientId !== currentAccount.id || post.status !== 'open' || proposal.status !== 'submitted') return { ok: false, message: 'This proposal is no longer available for a decision.' };
    const now = new Date().toISOString();
    if (!accept) {
      const notification = makeProjectPostNotification(proposal.studentId, 'Proposal not selected', post.title, post.id, now);
      setState((current) => ({ ...current, proposals: current.proposals.map((item) => item.id === proposalId ? { ...item, status: 'rejected' } : item), notifications: [notification, ...current.notifications] }));
      return { ok: true };
    }
    const booking: ProjectBooking = { id: makeId('booking'), source: 'proposal', projectPostId: post.id, proposalId: proposal.id, clientId: post.clientId, studentId: proposal.studentId, title: post.title, description: post.description, deliveryDays: proposal.deliveryDays, budget: proposal.amount, status: 'accepted', createdAt: now, updatedAt: now };
    const affected = state.proposals.filter((item) => item.projectPostId === post.id && item.status === 'submitted');
    const notifications = affected.map((item) => item.id === proposal.id ? makeNotification(item.studentId, 'Proposal accepted', post.title, 'project', booking.id, now) : makeProjectPostNotification(item.studentId, 'Proposal not selected', post.title, post.id, now));
    setState((current) => ({
      ...current,
      projectPosts: current.projectPosts.map((item) => item.id === post.id ? { ...item, status: 'closed', acceptedProposalId: proposal.id, updatedAt: now } : item),
      proposals: current.proposals.map((item) => item.projectPostId === post.id && item.status === 'submitted' ? { ...item, status: item.id === proposal.id ? 'accepted' : 'rejected' } : item),
      bookings: [booking, ...current.bookings], notifications: [...notifications, ...current.notifications],
    }));
    return { ok: true, bookingId: booking.id };
  }, [currentAccount, state.projectPosts, state.proposals]);

  const logout = useCallback(() => setState((current) => ({ ...current, currentAccountId: null })), []);

  const createBooking = useCallback((input: CreateBookingInput) => {
    const clientId = currentAccount?.role === 'client' ? currentAccount.id : state.accounts.find((account) => account.id === 'client-mark')?.id;
    if (!clientId) throw new Error('A client demo account is required to create a booking.');
    const now = new Date().toISOString();
    const booking: ProjectBooking = { ...input, id: makeId('booking'), source: 'service_request', clientId, status: 'requested', createdAt: now, updatedAt: now };
    const notification = makeNotification(input.studentId, 'New service request', input.title, 'project', booking.id, now);
    setState((current) => ({ ...current, bookings: [booking, ...current.bookings], notifications: [notification, ...current.notifications] }));
    return booking;
  }, [currentAccount, state.accounts]);

  const actOnProject = useCallback((projectId: string, action: ProjectAction, payload: ProjectActionPayload = {}): StoreResult => {
    const booking = state.bookings.find((item) => item.id === projectId);
    if (!booking || !currentAccount) return { ok: false, message: 'Project or active account not found.' };
    const isClient = currentAccount.id === booking.clientId;
    const isStudent = currentAccount.id === booking.studentId;
    const allowed = (requiredRole: 'client' | 'student', statuses: ProjectStatus[]) => (requiredRole === 'client' ? isClient : isStudent) && statuses.includes(booking.status);
    const now = new Date().toISOString();
    let nextStatus: ProjectStatus = booking.status;
    let notification: DemoNotification | null = null;
    let deliveryNote = booking.deliveryNote;
    let revisionNote = booking.revisionNote;
    let completedAt = booking.completedAt;
    let ledgerEntry: DemoLedgerEntry | null = null;
    let review: ProjectReview | null = null;

    if (action === 'accept' && allowed('student', ['requested'])) { nextStatus = 'accepted'; notification = makeNotification(booking.clientId, 'Request accepted', booking.title, 'project', projectId, now); }
    else if (action === 'decline' && allowed('student', ['requested'])) { nextStatus = 'declined'; notification = makeNotification(booking.clientId, 'Request declined', booking.title, 'project', projectId, now); }
    else if (action === 'cancel' && allowed('client', ['requested', 'accepted'])) { nextStatus = 'cancelled'; notification = makeNotification(booking.studentId, 'Request cancelled', booking.title, 'project', projectId, now); }
    else if (action === 'fund' && allowed('client', ['accepted'])) { nextStatus = 'demo_funded'; notification = makeNotification(booking.studentId, 'Demo funds reserved', booking.title, 'payment', projectId, now); ledgerEntry = { id: makeId('ledger'), userId: booking.clientId, projectId, type: 'hold', amount: booking.budget, createdAt: now }; }
    else if (action === 'start' && allowed('student', ['demo_funded'])) { nextStatus = 'in_progress'; notification = makeNotification(booking.clientId, 'Work started', booking.title, 'project', projectId, now); }
    else if (action === 'submit' && allowed('student', ['in_progress', 'revision_requested'])) {
      if (!payload.note?.trim()) return { ok: false, message: 'Add a delivery note before submitting.' };
      nextStatus = 'submitted'; deliveryNote = payload.note.trim(); revisionNote = undefined; notification = makeNotification(booking.clientId, 'Delivery submitted', booking.title, 'project', projectId, now);
    }
    else if (action === 'request_revision' && allowed('client', ['submitted'])) {
      if (!payload.note?.trim()) return { ok: false, message: 'Explain the requested revision.' };
      nextStatus = 'revision_requested'; revisionNote = payload.note.trim(); notification = makeNotification(booking.studentId, 'Revision requested', booking.title, 'project', projectId, now);
    }
    else if (action === 'approve' && allowed('client', ['submitted'])) { nextStatus = 'completed'; completedAt = now; notification = makeNotification(booking.studentId, 'Project approved', `${booking.title} — simulated earnings released`, 'payment', projectId, now); ledgerEntry = { id: makeId('ledger'), userId: booking.studentId, projectId, type: 'release', amount: booking.budget, createdAt: now }; }
    else if (action === 'review' && allowed('client', ['completed'])) {
      if (!payload.rating || payload.rating < 1 || payload.rating > 5 || !payload.comment?.trim()) return { ok: false, message: 'Choose a rating and add a review.' };
      nextStatus = 'reviewed'; review = { id: makeId('review'), projectId, clientId: booking.clientId, studentId: booking.studentId, rating: payload.rating, comment: payload.comment.trim(), createdAt: now }; notification = makeNotification(booking.studentId, 'New client review', `${payload.rating}/5 for ${booking.title}`, 'complete', projectId, now);
    }
    else return { ok: false, message: 'This action is not available for the current account or project status.' };

    const updated: ProjectBooking = { ...booking, status: nextStatus, updatedAt: now, deliveryNote, revisionNote, completedAt };
    setState((current) => ({
      ...current,
      bookings: current.bookings.map((item) => item.id === projectId ? updated : item),
      notifications: notification ? [notification, ...current.notifications] : current.notifications,
      ledger: ledgerEntry ? [ledgerEntry, ...current.ledger] : current.ledger,
      reviews: review ? [review, ...current.reviews] : current.reviews,
    }));
    return { ok: true };
  }, [currentAccount, state.bookings]);

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
  }, [currentAccount, state.bookings]);

  const markNotificationRead = useCallback((notificationId: string) => setState((current) => ({ ...current, notifications: current.notifications.map((item) => item.id === notificationId ? { ...item, read: true } : item) })), []);
  const markProjectMessagesRead = useCallback((projectId: string) => {
    if (!currentAccount) return;
    setState((current) => ({
      ...current,
      messages: current.messages.map((message) => message.projectId === projectId && !message.readBy.includes(currentAccount.id) ? { ...message, readBy: [...message.readBy, currentAccount.id] } : message),
      notifications: current.notifications.map((notification) => notification.userId === currentAccount.id && notification.projectId === projectId && notification.kind === 'message' ? { ...notification, read: true } : notification),
    }));
  }, [currentAccount]);
  const sendMentorMessage = useCallback((body: string): StoreResult => {
    if (!currentAccount || currentAccount.role !== 'student') return { ok: false, message: 'The AI Project Mentor is available to Student Designers.' };
    const trimmed = body.trim();
    if (!trimmed) return { ok: false, message: 'Enter a mentor question first.' };
    const now = new Date().toISOString();
    const userMessage: MentorMessage = { id: makeId('mentor-user'), accountId: currentAccount.id, role: 'user', body: trimmed, createdAt: now };
    const reply: MentorMessage = { id: makeId('mentor-reply'), accountId: currentAccount.id, role: 'mentor', body: mentorResponse(trimmed), createdAt: new Date(Date.now() + 1).toISOString() };
    setState((current) => ({ ...current, mentorMessages: [...current.mentorMessages, userMessage, reply] }));
    return { ok: true };
  }, [currentAccount]);
  const clearMentorConversation = useCallback(() => { if (currentAccount) setState((current) => ({ ...current, mentorMessages: current.mentorMessages.filter((item) => item.accountId !== currentAccount.id) })); }, [currentAccount]);
  const updatePreferences = useCallback((input: Partial<DemoPreferences>) => setState((current) => ({ ...current, preferences: { ...current.preferences, ...input, language: 'English' } })), []);
  const changePassword = useCallback((currentPassword: string, newPassword: string): StoreResult => {
    if (!currentAccount || currentAccount.password !== currentPassword) return { ok: false, message: 'Current password is incorrect.' };
    if (newPassword.length < 6) return { ok: false, message: 'New password must contain at least 6 characters.' };
    if (currentPassword === newPassword) return { ok: false, message: 'Choose a password different from the current password.' };
    setState((current) => ({ ...current, accounts: current.accounts.map((account) => account.id === currentAccount.id ? { ...account, password: newPassword } : account) }));
    return { ok: true };
  }, [currentAccount]);
  const toggleSavedService = useCallback((serviceId: string) => setState((current) => ({ ...current, savedServiceIds: current.savedServiceIds.includes(serviceId) ? current.savedServiceIds.filter((id) => id !== serviceId) : [...current.savedServiceIds, serviceId] })), []);
  const resetDemoData = useCallback(async () => { const seed = createSeedState(); setState(seed); await Promise.all([AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seed)), AsyncStorage.removeItem(LEGACY_STORAGE_KEY)]); }, []);

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

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
