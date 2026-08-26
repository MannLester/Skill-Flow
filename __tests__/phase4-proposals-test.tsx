import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';

import { SessionProvider, useSession } from '@/context/session';

const listOrNone = (items: string[]) => items.join('|') || 'none';

function ProposalHarness() {
  const { bookings, currentAccount, decideProposal, login, loginAsRole, notifications, projectPosts, proposals, registerAccount, setProjectPostStatus, submitProposal, withdrawProposal } = useSession();
  const [result, setResult] = useState('none');
  const post = projectPosts.find((item) => item.id === 'post-mark-mobile-ui');
  const ownProposal = proposals.find((item) => item.projectPostId === post?.id && item.studentId === currentAccount?.id);
  const submitted = proposals.find((item) => item.projectPostId === post?.id && item.status === 'submitted');
  const proposalStates = listOrNone(proposals.map((item) => `${item.studentId}:${item.status}`).sort());
  const decisionNotifications = listOrNone(notifications.filter((item) => item.title === 'Proposal accepted' || item.title === 'Proposal not selected').map((item) => `${item.userId}:${item.title}`).sort());
  const show = (value: { ok: boolean; message?: string }) => setResult(value.ok ? 'ok' : value.message ?? 'failed');
  return <View>
    <Text>Account: {currentAccount?.name ?? 'none'}</Text><Text>Result: {result}</Text><Text>Post: {post?.status ?? 'missing'}</Text><Text>Proposal: {ownProposal?.status ?? proposals[0]?.status ?? 'none'}</Text><Text>Proposal count: {proposals.length}</Text><Text>Proposal states: {proposalStates}</Text><Text>Booking: {bookings[0] ? `${bookings[0].source}/${bookings[0].status}` : 'none'}</Text><Text>Booking count: {bookings.length}</Text><Text>Notification count: {notifications.length}</Text><Text>Decision notifications: {decisionNotifications}</Text>
    <Pressable onPress={() => registerAccount({ name: 'Unverified Student', email: 'unverified@demo.test', password: 'secret1', role: 'student' })}><Text>Register Unverified</Text></Pressable>
    <Pressable onPress={() => loginAsRole('student')}><Text>Use Alex</Text></Pressable>
    <Pressable onPress={() => login('jamie@skillflow.demo', 'demo123', 'student')}><Text>Use Jamie</Text></Pressable>
    <Pressable onPress={() => loginAsRole('client')}><Text>Use Mark</Text></Pressable>
    <Pressable onPress={() => post && show(submitProposal(post.id, { coverLetter: 'I can create the five mobile screens and prototype.', amount: 1800, deliveryDays: 5 }))}><Text>Submit Proposal</Text></Pressable>
    <Pressable onPress={() => submitted && show(decideProposal(submitted.id, true))}><Text>Accept Proposal</Text></Pressable>
    <Pressable onPress={() => { if (!submitted) return; const first = decideProposal(submitted.id, true); const second = decideProposal(submitted.id, true); setResult(`${first.ok ? 'first-ok' : first.message}|${second.ok ? 'second-ok' : second.message}`); }}><Text>Accept Proposal Twice</Text></Pressable>
    <Pressable onPress={() => { if (!post || !submitted) return; const archived = setProjectPostStatus(post.id, 'archived'); const accepted = decideProposal(submitted.id, true); setResult(`${archived.ok ? 'archive-ok' : archived.message}|${accepted.ok ? 'accept-ok' : accepted.message}`); }}><Text>Archive Then Accept</Text></Pressable>
    <Pressable onPress={() => submitted && show(decideProposal(submitted.id, false))}><Text>Reject Proposal</Text></Pressable>
    <Pressable onPress={() => ownProposal && show(withdrawProposal(ownProposal.id))}><Text>Withdraw Proposal</Text></Pressable>
  </View>;
}

describe('open project and proposal funnel', () => {
  it('requires simulated student verification before proposing', () => {
    const screen = render(<SessionProvider><ProposalHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Register Unverified')); fireEvent.press(screen.getByText('Submit Proposal'));
    expect(screen.getByText('Result: Complete simulated student verification before submitting a proposal.')).toBeTruthy(); expect(screen.getByText('Proposal count: 0')).toBeTruthy();
  });
  it('converts an accepted proposal into the shared accepted booking lifecycle', () => {
    const screen = render(<SessionProvider><ProposalHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Alex')); fireEvent.press(screen.getByText('Submit Proposal')); expect(screen.getByText('Proposal count: 1')).toBeTruthy(); fireEvent.press(screen.getByText('Use Mark')); fireEvent.press(screen.getByText('Accept Proposal'));
    expect(screen.getByText('Post: closed')).toBeTruthy(); expect(screen.getByText('Proposal: accepted')).toBeTruthy(); expect(screen.getByText('Booking: proposal/accepted')).toBeTruthy();
  });
  it('keeps a rapid repeated accept idempotent and returns a recoverable stale result', () => {
    const screen = render(<SessionProvider><ProposalHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Alex')); fireEvent.press(screen.getByText('Submit Proposal')); fireEvent.press(screen.getByText('Use Mark')); fireEvent.press(screen.getByText('Accept Proposal Twice'));
    expect(screen.getByText('Result: first-ok|This proposal has already been accepted.')).toBeTruthy();
    expect(screen.getByText('Post: closed')).toBeTruthy(); expect(screen.getByText('Proposal: accepted')).toBeTruthy(); expect(screen.getByText('Booking count: 1')).toBeTruthy(); expect(screen.getByText('Notification count: 2')).toBeTruthy();
  });
  it('rejects competing proposals and notifies each student once when one is accepted', () => {
    const screen = render(<SessionProvider><ProposalHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Alex')); fireEvent.press(screen.getByText('Submit Proposal')); fireEvent.press(screen.getByText('Use Jamie')); fireEvent.press(screen.getByText('Submit Proposal')); fireEvent.press(screen.getByText('Use Mark')); fireEvent.press(screen.getByText('Accept Proposal'));
    expect(screen.getByText('Post: closed')).toBeTruthy(); expect(screen.getByText('Booking count: 1')).toBeTruthy(); expect(screen.getByText('Notification count: 4')).toBeTruthy();
    expect(screen.getByText('Proposal states: student-alex:rejected|student-jamie:accepted')).toBeTruthy();
    expect(screen.getByText('Decision notifications: student-alex:Proposal not selected|student-jamie:Proposal accepted')).toBeTruthy();
  });
  it('rejects a proposal decision when an earlier same-tick mutation made it stale', () => {
    const screen = render(<SessionProvider><ProposalHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Alex')); fireEvent.press(screen.getByText('Submit Proposal')); fireEvent.press(screen.getByText('Use Mark')); fireEvent.press(screen.getByText('Archive Then Accept'));
    expect(screen.getByText('Result: archive-ok|This proposal is no longer available for a decision.')).toBeTruthy();
    expect(screen.getByText('Post: archived')).toBeTruthy(); expect(screen.getByText('Proposal: submitted')).toBeTruthy(); expect(screen.getByText('Booking count: 0')).toBeTruthy(); expect(screen.getByText('Decision notifications: none')).toBeTruthy();
  });
  it('preserves rejection without creating a booking', () => {
    const screen = render(<SessionProvider><ProposalHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Alex')); fireEvent.press(screen.getByText('Submit Proposal')); fireEvent.press(screen.getByText('Use Mark')); fireEvent.press(screen.getByText('Reject Proposal'));
    expect(screen.getByText('Result: ok')).toBeTruthy(); expect(screen.getByText('Proposal: rejected')).toBeTruthy(); expect(screen.getByText('Booking count: 0')).toBeTruthy(); expect(screen.getByText('Notification count: 2')).toBeTruthy();
  });
  it('allows a student to withdraw a still-pending proposal', () => {
    const screen = render(<SessionProvider><ProposalHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Alex')); fireEvent.press(screen.getByText('Submit Proposal')); fireEvent.press(screen.getByText('Withdraw Proposal'));
    expect(screen.getByText('Proposal: withdrawn')).toBeTruthy(); expect(screen.getByText('Booking: none')).toBeTruthy();
  });
});
