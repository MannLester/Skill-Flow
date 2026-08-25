import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

import { SessionProvider, useSession } from '@/context/session';
import ProjectPostDetailsScreen from '@/app/project-posts/[postId]';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ postId: 'post-mark-mobile-ui' }),
}));

const mockRouter = jest.requireMock('expo-router').router as { push: jest.Mock };

const validationMessage = 'Add a cover letter, valid amount, and delivery time.';
const verificationMessage = 'Complete simulated student verification before submitting a proposal.';

function TestControls() {
  const { loginAsRole, registerAccount, simulateVerificationReview, submitVerification } = useSession();
  return (
    <View>
      <Pressable onPress={() => loginAsRole('student')}><Text>Use Alex</Text></Pressable>
      <Pressable onPress={() => registerAccount({ name: 'Unverified Student', email: 'unverified@demo.test', password: 'secret1', role: 'student' })}><Text>Register Unverified</Text></Pressable>
      <Pressable onPress={() => submitVerification({ school: 'Demo School', studentNumber: '123456', program: 'Arts', gradeLevel: 'Grade 12', graduationYear: 2028, sampleDocumentName: 'demo-id.png' })}><Text>Submit Verification</Text></Pressable>
      <Pressable onPress={() => simulateVerificationReview(true)}><Text>Approve Verification</Text></Pressable>
    </View>
  );
}

function renderDetail() {
  const view = render(<SessionProvider><TestControls /><ProjectPostDetailsScreen /></SessionProvider>);
  fireEvent.press(view.getByText('Use Alex'));
  return view;
}

describe('project proposal validation feedback', () => {
  beforeEach(() => mockRouter.push.mockClear());

  it.each([
    ['cover letter', 'Proposal cover letter', ''],
    ['amount', 'Proposed amount', 'not-a-number'],
    ['delivery time', 'Delivery days', '0'],
  ])('shows the store validation message and does not create a proposal for an invalid %s', (_field, label, value) => {
    const view = renderDetail();
    fireEvent.changeText(view.getByLabelText(label), value);
    fireEvent.press(view.getByText('Submit Proposal'));

    expect(view.getByText(validationMessage)).toBeTruthy();
    expect(view.queryByText('submitted')).toBeNull();
    view.unmount();
  });

  it('announces verification failures and provides a route to the simulated recovery flow', () => {
    const view = render(<SessionProvider><TestControls /><ProjectPostDetailsScreen /></SessionProvider>);
    fireEvent.press(view.getByText('Register Unverified'));
    fireEvent.press(view.getByText('Submit Proposal'));

    const alerts = view.UNSAFE_getAllByType(View).filter((node) => node.props.accessibilityRole === 'alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].props.accessibilityLiveRegion).toBe('polite');
    expect(view.getByText(verificationMessage)).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Open Student Verification' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/verification');
  });

  it('clears a verification message when the simulated recovery state becomes verified', () => {
    const view = render(<SessionProvider><TestControls /><ProjectPostDetailsScreen /></SessionProvider>);
    fireEvent.press(view.getByText('Register Unverified'));
    fireEvent.press(view.getByText('Submit Verification'));
    fireEvent.press(view.getByText('Submit Proposal'));
    expect(view.getByText(verificationMessage)).toBeTruthy();

    fireEvent.press(view.getByText('Approve Verification'));
    expect(view.queryByText(verificationMessage)).toBeNull();
  });

  it('clears stale feedback when a field changes and after a valid submission', () => {
    const view = renderDetail();
    fireEvent.press(view.getByText('Submit Proposal'));
    expect(view.getByText(validationMessage)).toBeTruthy();

    fireEvent.changeText(view.getByLabelText('Proposal cover letter'), 'I can create the five mobile screens and prototype.');
    expect(view.queryByText(validationMessage)).toBeNull();
    fireEvent.press(view.getByText('Submit Proposal'));

    expect(view.queryByText(validationMessage)).toBeNull();
    expect(view.getByText('submitted')).toBeTruthy();
    expect(view.getByText('₱2,000 · 5 days')).toBeTruthy();
  });
});
