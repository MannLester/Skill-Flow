import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

import { ProjectAction, useSession, SessionProvider } from '@/context/session';

function LifecycleHarness() {
  const { actOnProject, addCompletedProjectToPortfolio, bookings, createBooking, ledger, loginAsRole, messages, notifications, portfolioItems, reviews, sendMessage } = useSession();
  const project = bookings[0];
  const act = (action: ProjectAction, payload?: { note?: string; rating?: number; comment?: string }) => project && actOnProject(project.id, action, payload);
  return (
    <View>
      <Text>Status: {project?.status ?? 'none'}</Text>
      <Text>Notifications: {notifications.length}</Text>
      <Text>Messages: {messages.length}</Text>
      <Text>Holds: {ledger.filter((entry) => entry.type === 'hold').length}</Text>
      <Text>Releases: {ledger.filter((entry) => entry.type === 'release').length}</Text>
      <Text>Reviews: {reviews.length}</Text>
      <Text>Portfolio: {portfolioItems.length}</Text>
      <Text testID="lifecycle-state">{JSON.stringify({ status: project?.status ?? 'none', notifications: notifications.length, holds: ledger.filter((entry) => entry.type === 'hold').length, releases: ledger.filter((entry) => entry.type === 'release').length, reviews: reviews.length, deliveryNote: project?.deliveryNote, revisionNote: project?.revisionNote })}</Text>
      <Pressable onPress={() => loginAsRole('client')}><Text>Use Mark</Text></Pressable>
      <Pressable onPress={() => loginAsRole('student')}><Text>Use Alex</Text></Pressable>
      <Pressable onPress={() => createBooking({ serviceId: 'logo', studentId: 'student-alex', title: 'Logo Design', description: 'Create a complete brand logo.', deliveryDays: 3, budget: 1500 })}><Text>Create</Text></Pressable>
      <Pressable onPress={() => act('accept')}><Text>Accept</Text></Pressable>
      <Pressable onPress={() => act('decline')}><Text>Decline</Text></Pressable>
      <Pressable onPress={() => act('cancel')}><Text>Cancel</Text></Pressable>
      <Pressable onPress={() => act('fund')}><Text>Fund</Text></Pressable>
      <Pressable onPress={() => act('start')}><Text>Start</Text></Pressable>
      <Pressable onPress={() => project && sendMessage(project.id, 'The first concept is ready.')}><Text>Message</Text></Pressable>
      <Pressable onPress={() => act('submit', { note: 'Logo files and preview submitted.' })}><Text>Submit</Text></Pressable>
      <Pressable onPress={() => act('submit', { note: '   ' })}><Text>Submit Empty</Text></Pressable>
      <Pressable onPress={() => act('request_revision', { note: 'Please use a darker red.' })}><Text>Revision</Text></Pressable>
      <Pressable onPress={() => act('request_revision', { note: '' })}><Text>Revision Empty</Text></Pressable>
      <Pressable onPress={() => act('submit', { note: 'Revised darker-red logo submitted.' })}><Text>Resubmit</Text></Pressable>
      <Pressable onPress={() => act('approve')}><Text>Approve</Text></Pressable>
      <Pressable onPress={() => act('review', { rating: 5, comment: 'Excellent student designer.' })}><Text>Review</Text></Pressable>
      <Pressable onPress={() => act('review', { rating: 5, comment: ' ' })}><Text>Review Empty</Text></Pressable>
      <Pressable onPress={() => project && addCompletedProjectToPortfolio(project.id)}><Text>Add Work</Text></Pressable>
    </View>
  );
}

describe('direct booking closed loop', () => {
  it('moves one shared project through funding, revision, completion, and review', () => {
    const screen = render(<SessionProvider><LifecycleHarness /></SessionProvider>);

    fireEvent.press(screen.getByText('Use Mark'));
    fireEvent.press(screen.getByText('Create'));
    expect(screen.getByText('Status: requested')).toBeTruthy();
    expect(screen.getByText('Notifications: 1')).toBeTruthy();

    fireEvent.press(screen.getByText('Use Alex'));
    fireEvent.press(screen.getByText('Accept'));
    expect(screen.getByText('Status: accepted')).toBeTruthy();
    fireEvent.press(screen.getByText('Message'));
    expect(screen.getByText('Messages: 1')).toBeTruthy();

    fireEvent.press(screen.getByText('Use Mark'));
    fireEvent.press(screen.getByText('Fund'));
    expect(screen.getByText('Status: demo_funded')).toBeTruthy();
    expect(screen.getByText('Holds: 1')).toBeTruthy();

    fireEvent.press(screen.getByText('Use Alex'));
    fireEvent.press(screen.getByText('Start'));
    expect(screen.getByText('Status: in_progress')).toBeTruthy();
    fireEvent.press(screen.getByText('Submit'));
    expect(screen.getByText('Status: submitted')).toBeTruthy();

    fireEvent.press(screen.getByText('Use Mark'));
    fireEvent.press(screen.getByText('Revision'));
    expect(screen.getByText('Status: revision_requested')).toBeTruthy();

    fireEvent.press(screen.getByText('Use Alex'));
    fireEvent.press(screen.getByText('Resubmit'));
    expect(screen.getByText('Status: submitted')).toBeTruthy();

    fireEvent.press(screen.getByText('Use Mark'));
    fireEvent.press(screen.getByText('Approve'));
    expect(screen.getByText('Status: completed')).toBeTruthy();
    expect(screen.getByText('Releases: 1')).toBeTruthy();
    fireEvent.press(screen.getByText('Review'));
    expect(screen.getByText('Status: reviewed')).toBeTruthy();
    expect(screen.getByText('Reviews: 1')).toBeTruthy();
    fireEvent.press(screen.getByText('Use Alex'));
    fireEvent.press(screen.getByText('Add Work'));
    expect(screen.getByText('Portfolio: 2')).toBeTruthy();
  });

  it('allows the assigned student to decline a request', () => {
    const screen = render(<SessionProvider><LifecycleHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Mark'));
    fireEvent.press(screen.getByText('Create'));
    fireEvent.press(screen.getByText('Use Alex'));
    fireEvent.press(screen.getByText('Decline'));
    expect(screen.getByText('Status: declined')).toBeTruthy();
    expect(screen.getByText('Holds: 0')).toBeTruthy();
  });

  it('allows the client to cancel before demo funding', () => {
    const screen = render(<SessionProvider><LifecycleHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Mark'));
    fireEvent.press(screen.getByText('Create'));
    fireEvent.press(screen.getByText('Cancel'));
    expect(screen.getByText('Status: cancelled')).toBeTruthy();
    expect(screen.getByText('Holds: 0')).toBeTruthy();
  });

  it('does not mutate lifecycle state for blank action payloads and applies valid transitions once', () => {
    const screen = render(<SessionProvider><LifecycleHarness /></SessionProvider>);
    const state = () => screen.getByTestId('lifecycle-state').props.children as string;
    fireEvent.press(screen.getByText('Use Mark'));
    fireEvent.press(screen.getByText('Create'));
    fireEvent.press(screen.getByText('Use Alex'));
    fireEvent.press(screen.getByText('Accept'));
    fireEvent.press(screen.getByText('Use Mark'));
    fireEvent.press(screen.getByText('Fund'));
    fireEvent.press(screen.getByText('Use Alex'));
    fireEvent.press(screen.getByText('Start'));

    const beforeSubmit = state();
    fireEvent.press(screen.getByText('Submit Empty'));
    expect(state()).toBe(beforeSubmit);
    fireEvent.press(screen.getByText('Submit'));
    expect(JSON.parse(state())).toMatchObject({ status: 'submitted', deliveryNote: 'Logo files and preview submitted.' });

    fireEvent.press(screen.getByText('Use Mark'));
    const beforeRevision = state();
    fireEvent.press(screen.getByText('Revision Empty'));
    expect(state()).toBe(beforeRevision);
    fireEvent.press(screen.getByText('Revision'));
    expect(JSON.parse(state())).toMatchObject({ status: 'revision_requested', revisionNote: 'Please use a darker red.' });

    fireEvent.press(screen.getByText('Use Alex'));
    fireEvent.press(screen.getByText('Resubmit'));
    fireEvent.press(screen.getByText('Use Mark'));
    fireEvent.press(screen.getByText('Approve'));
    const beforeReview = state();
    fireEvent.press(screen.getByText('Review Empty'));
    expect(state()).toBe(beforeReview);
    fireEvent.press(screen.getByText('Review'));
    expect(JSON.parse(state())).toMatchObject({ status: 'reviewed', releases: 1, reviews: 1 });
  });
});
