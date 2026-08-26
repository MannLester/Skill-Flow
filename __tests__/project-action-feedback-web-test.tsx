/** @jest-environment jsdom */

import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import ProjectDetailsScreen from '@/app/projects/[projectId]';
import { DemoAccount, ProjectBooking, ProjectStatus } from '@/context/session';

type ReactNativeWebTestRuntime = Pick<typeof import('react-native'),
  'ActivityIndicator' | 'Alert' | 'Image' | 'KeyboardAvoidingView' | 'Platform' | 'Pressable' |
  'ScrollView' | 'StyleSheet' | 'Text' | 'TextInput' | 'View' | 'useWindowDimensions'>;

const mockStudent: DemoAccount = { id: 'student-alex', role: 'student', name: 'Alex', email: 'alex@example.test', password: 'demo', verified: true };
const mockClient: DemoAccount = { id: 'client-mark', role: 'client', name: 'Mark', email: 'mark@example.test', password: 'demo', verified: true };
let mockCurrentAccount = mockStudent;
let mockStatus: ProjectStatus = 'in_progress';
const mockActOnProject = jest.fn();

function mockBooking(): ProjectBooking {
  return {
    id: 'booking-test', source: 'service_request', serviceId: 'logo', clientId: mockClient.id,
    studentId: mockStudent.id, title: 'Logo Design', description: 'Create a complete brand logo.',
    deliveryDays: 3, budget: 1500, status: mockStatus, createdAt: '2026-08-01', updatedAt: '2026-08-01',
  };
}

jest.mock('react-native', () => jest.requireActual<ReactNativeWebTestRuntime>('react-native-web'));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ projectId: 'booking-test' }),
}));
jest.mock('@/context/session', () => ({
  useSession: () => ({
    accounts: [mockStudent, mockClient], actOnProject: mockActOnProject, addCompletedProjectToPortfolio: jest.fn(),
    bookings: [mockBooking()], currentAccount: mockCurrentAccount, homeRoute: '/home/student', portfolioItems: [], reviews: [],
  }),
}));

function button(container: HTMLElement, label: string) {
  const target = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]')).find((element) => element.textContent?.trim() === label);
  if (!target) throw new Error(`Missing button ${label}`);
  return target;
}

function input(container: HTMLElement, label: string) {
  const target = container.querySelector<HTMLTextAreaElement>(`[aria-label="${label}"]`);
  if (!target) throw new Error(`Missing input ${label}`);
  return target;
}

function setInputValue(target: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (!setter) throw new Error('Missing textarea value setter');
  act(() => {
    setter.call(target, value);
    target.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('project lifecycle action feedback in the real React Native Web DOM', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockCurrentAccount = mockStudent;
    mockStatus = 'in_progress';
    mockActOnProject.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each([
    { role: 'student', status: 'in_progress', action: 'Submit Delivery', label: 'Delivery note', value: 'Final files attached.', message: 'Add a delivery note before submitting.' },
    { role: 'client', status: 'submitted', action: 'Request Revision', label: 'Revision instructions', value: 'Increase the heading contrast.', message: 'Explain the requested revision.' },
    { role: 'client', status: 'completed', action: 'Submit Review', label: 'Project review', value: 'Excellent final result.', message: 'Choose a rating and add a review.' },
  ] as const)('announces, clears, and retries $action without losing input', ({ role, status, action, label, value, message }) => {
    mockCurrentAccount = role === 'student' ? mockStudent : mockClient;
    mockStatus = status;
    mockActOnProject.mockReturnValueOnce({ ok: false, message }).mockReturnValueOnce({ ok: true });
    act(() => root.render(<ProjectDetailsScreen />));

    act(() => button(container, action).click());
    const feedback = container.querySelector<HTMLElement>('[role="alert"][data-testid="project-action-feedback"]');
    expect(feedback?.getAttribute('aria-live')).toBe('polite');
    expect(feedback?.textContent).toContain(message);
    expect(mockActOnProject).toHaveBeenCalledTimes(1);

    setInputValue(input(container, label), value);
    expect(container.querySelector('[data-testid="project-action-feedback"]')).toBeNull();
    expect(input(container, label).value).toBe(value);
    act(() => button(container, action).click());
    expect(mockActOnProject).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="project-action-feedback"]')).toBeNull();
  });
});
