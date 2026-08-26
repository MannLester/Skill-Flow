import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

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
