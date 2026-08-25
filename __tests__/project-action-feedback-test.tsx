import { fireEvent, render } from '@testing-library/react-native';

import ProjectDetailsScreen from '@/app/projects/[projectId]';
import { DemoAccount, ProjectBooking, ProjectStatus } from '@/context/session';

const mockStudent: DemoAccount = { id: 'student-alex', role: 'student', name: 'Alex', email: 'alex@example.test', password: 'demo', verified: true };
const mockClient: DemoAccount = { id: 'client-mark', role: 'client', name: 'Mark', email: 'mark@example.test', password: 'demo', verified: true };
let mockCurrentAccount = mockStudent;
let mockStatus: ProjectStatus = 'in_progress';
const mockActOnProject = jest.fn();

const booking = (): ProjectBooking => ({
  id: 'booking-test', source: 'service_request', serviceId: 'logo', clientId: mockClient.id,
  studentId: mockStudent.id, title: 'Logo Design', description: 'Create a complete brand logo.',
  deliveryDays: 3, budget: 1500, status: mockStatus, createdAt: '2026-08-01', updatedAt: '2026-08-01',
});

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ projectId: 'booking-test' }),
}));
jest.mock('@/context/session', () => ({
  useSession: () => ({
    accounts: [mockStudent, mockClient], actOnProject: mockActOnProject, addCompletedProjectToPortfolio: jest.fn(),
    bookings: [booking()], currentAccount: mockCurrentAccount, homeRoute: '/home/student', portfolioItems: [], reviews: [],
  }),
}));

function expectFeedback(screen: ReturnType<typeof render>, message: string) {
  const feedback = screen.getByTestId('project-action-feedback');
  expect(feedback.props.accessibilityRole).toBe('alert');
  expect(feedback.props.accessibilityLiveRegion).toBe('polite');
  expect(screen.getByText(message)).toBeTruthy();
}

describe('project lifecycle action feedback', () => {
  beforeEach(() => {
    mockCurrentAccount = mockStudent;
    mockStatus = 'in_progress';
    mockActOnProject.mockReset();
  });

  it.each([
    ['in_progress', 'Submit Delivery'],
    ['revision_requested', 'Submit Revision'],
  ] as const)('keeps delivery input after a blank %s action and clears feedback on edit', (status, button) => {
    mockStatus = status;
    mockActOnProject.mockReturnValueOnce({ ok: false, message: 'Add a delivery note before submitting.' }).mockReturnValueOnce({ ok: true });
    const screen = render(<ProjectDetailsScreen />);

    fireEvent.press(screen.getByRole('button', { name: button }));
    expectFeedback(screen, 'Add a delivery note before submitting.');
    expect(mockActOnProject).toHaveBeenCalledTimes(1);

    fireEvent.changeText(screen.getByLabelText('Delivery note'), 'Attached are the final files.');
    expect(screen.queryByTestId('project-action-feedback')).toBeNull();
    expect(screen.getByDisplayValue('Attached are the final files.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: button }));
    expect(mockActOnProject).toHaveBeenCalledTimes(2);
    expect(mockActOnProject).toHaveBeenLastCalledWith('booking-test', 'submit', { note: 'Attached are the final files.' });
  });

  it('keeps revision instructions on failure and clears stale feedback after the role/status changes', () => {
    mockCurrentAccount = mockClient;
    mockStatus = 'submitted';
    mockActOnProject.mockReturnValue({ ok: false, message: 'Explain the requested revision.' });
    const screen = render(<ProjectDetailsScreen />);

    fireEvent.press(screen.getByText('Request Revision'));
    expectFeedback(screen, 'Explain the requested revision.');
    fireEvent.changeText(screen.getByLabelText('Revision instructions'), 'Please increase the contrast.');
    expect(screen.queryByTestId('project-action-feedback')).toBeNull();
    expect(screen.getByDisplayValue('Please increase the contrast.')).toBeTruthy();

    mockCurrentAccount = mockStudent;
    mockStatus = 'revision_requested';
    screen.rerender(<ProjectDetailsScreen />);
    expect(screen.queryByText('Please increase the contrast.')).toBeNull();
    expect(screen.queryByTestId('project-action-feedback')).toBeNull();
  });

  it('announces a blank review error, preserves the rating, and submits a valid review once', () => {
    mockCurrentAccount = mockClient;
    mockStatus = 'completed';
    mockActOnProject.mockReturnValueOnce({ ok: false, message: 'Choose a rating and add a review.' }).mockReturnValueOnce({ ok: true });
    const screen = render(<ProjectDetailsScreen />);

    fireEvent.press(screen.getByLabelText('4 star rating'));
    fireEvent.press(screen.getByText('Submit Review'));
    expectFeedback(screen, 'Choose a rating and add a review.');
    fireEvent.changeText(screen.getByLabelText('Project review'), 'Excellent work and communication.');
    expect(screen.queryByTestId('project-action-feedback')).toBeNull();
    fireEvent.press(screen.getByText('Submit Review'));

    expect(mockActOnProject).toHaveBeenCalledTimes(2);
    expect(mockActOnProject).toHaveBeenLastCalledWith('booking-test', 'review', { rating: 4, comment: 'Excellent work and communication.' });
  });
});
