import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';

import { SessionProvider, useSession } from '@/context/session';

function ProposalHarness() {
  const { bookings, currentAccount, decideProposal, loginAsRole, projectPosts, proposals, registerAccount, submitProposal, withdrawProposal } = useSession();
  const [result, setResult] = useState('none');
  const post = projectPosts.find((item) => item.id === 'post-mark-mobile-ui');
  const ownProposal = proposals.find((item) => item.projectPostId === post?.id && item.studentId === currentAccount?.id);
  const submitted = proposals.find((item) => item.projectPostId === post?.id && item.status === 'submitted');
  const show = (value: { ok: boolean; message?: string }) => setResult(value.ok ? 'ok' : value.message ?? 'failed');
  return <View>
    <Text>Account: {currentAccount?.name ?? 'none'}</Text><Text>Result: {result}</Text><Text>Post: {post?.status ?? 'missing'}</Text><Text>Proposal: {ownProposal?.status ?? proposals[0]?.status ?? 'none'}</Text><Text>Proposal count: {proposals.length}</Text><Text>Booking: {bookings[0] ? `${bookings[0].source}/${bookings[0].status}` : 'none'}</Text>
    <Pressable onPress={() => registerAccount({ name: 'Unverified Student', email: 'unverified@demo.test', password: 'secret1', role: 'student' })}><Text>Register Unverified</Text></Pressable>
    <Pressable onPress={() => loginAsRole('student')}><Text>Use Alex</Text></Pressable>
    <Pressable onPress={() => loginAsRole('client')}><Text>Use Mark</Text></Pressable>
    <Pressable onPress={() => post && show(submitProposal(post.id, { coverLetter: 'I can create the five mobile screens and prototype.', amount: 1800, deliveryDays: 5 }))}><Text>Submit Proposal</Text></Pressable>
    <Pressable onPress={() => submitted && show(decideProposal(submitted.id, true))}><Text>Accept Proposal</Text></Pressable>
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
  it('allows a student to withdraw a still-pending proposal', () => {
    const screen = render(<SessionProvider><ProposalHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Alex')); fireEvent.press(screen.getByText('Submit Proposal')); fireEvent.press(screen.getByText('Withdraw Proposal'));
    expect(screen.getByText('Proposal: withdrawn')).toBeTruthy(); expect(screen.getByText('Booking: none')).toBeTruthy();
  });
});
