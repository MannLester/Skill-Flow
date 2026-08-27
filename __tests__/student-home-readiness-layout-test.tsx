import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import ClientHomeScreen from '@/app/client-home';
import StudentHomeScreen from '@/app/student-home';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: jest.fn() },
}));
jest.mock('@/context/session', () => ({
  useSession: () => ({
    bookings: [], currentAccount: { id: 'student-alex', role: 'student' }, getCareerReadiness: () => ({ score: 100, level: 'Career Ready' }),
    homeRoute: '/student-home', ledger: [], messages: [], projectPosts: [], unreadCount: 0,
  }),
}));

describe('Student Home Career Readiness card', () => {
  beforeEach(() => mockPush.mockClear());

  it('keeps flexible copy before a non-shrinking trailing score and exposes one score announcement', () => {
    const screen = render(<StudentHomeScreen />);
    const card = screen.getByTestId('career-readiness-card');
    const copyStyle = StyleSheet.flatten(screen.getByTestId('career-readiness-copy').props.style);
    const scoreStyle = StyleSheet.flatten(screen.getByTestId('career-readiness-score').props.style);

    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityLabel).toBe('Career Readiness. Career Ready · See what to improve next. 100 out of 100.');
    expect(card.props.accessibilityHint).toBe('Opens the career readiness breakdown');
    expect(copyStyle).toMatchObject({ flex: 1, flexShrink: 1, minWidth: 0 });
    expect(scoreStyle).toMatchObject({ flexDirection: 'row', alignItems: 'baseline', flexShrink: 0 });

    fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/career-readiness');
  });
});

describe('dashboard home shell geometry', () => {
  it('preserves each role geometry', () => {
    const student = render(<StudentHomeScreen />);
    const studentHero = StyleSheet.flatten(student.getByTestId('dashboard-hero').props.style);
    const studentFeatured = StyleSheet.flatten(student.getByTestId('dashboard-featured').props.style);
    const studentBody = StyleSheet.flatten(student.getByTestId('dashboard-body').props.style);
    student.unmount();

    const client = render(<ClientHomeScreen />);
    const clientHero = StyleSheet.flatten(client.getByTestId('dashboard-hero').props.style);
    const clientFeatured = StyleSheet.flatten(client.getByTestId('dashboard-featured').props.style);
    const clientBody = StyleSheet.flatten(client.getByTestId('dashboard-body').props.style);

    expect(studentHero).toEqual(clientHero);
    expect(studentHero).toMatchObject({ paddingBottom: 87 });
    expect(studentFeatured).toMatchObject({ marginTop: -42, minHeight: 150 });
    expect(clientFeatured).toMatchObject({ marginTop: -42, minHeight: 150 });
    expect(studentFeatured).toMatchObject({ borderRadius: 18 });
    expect(clientFeatured).toMatchObject({ borderRadius: 17 });
    expect(studentBody).toMatchObject({ marginTop: -55, paddingTop: 58 });
    expect(clientBody).toMatchObject({ marginTop: -55, paddingTop: 52 });
  });
});
