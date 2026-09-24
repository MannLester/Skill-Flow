import { render } from '@testing-library/react-native';

import VerificationScreen from '@/app/verification';

let mockVerificationStatus: 'pending' | 'verified' = 'pending';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn() } }));
jest.mock('@/context/session.remote', () => ({
  useSession: () => ({
    currentAccount: { id: 'student-demo', role: 'student', name: 'Demo Student' },
    ensureDemoVerificationCheck: jest.fn().mockResolvedValue({ ok: true }),
    submitVerification: jest.fn(),
    verifications: [{ studentId: 'student-demo', status: mockVerificationStatus, school: 'Demo School', studentNumberMasked: 'DEMO-****-1234', program: 'Design', gradeLevel: 'Grade 12' }],
  }),
}));

describe('automatic demo verification screen', () => {
  it('shows an animated checking state without student approval controls', () => {
    mockVerificationStatus = 'pending';
    const screen = render(<VerificationScreen />);
    expect(screen.getByText('Checking Demo Submission')).toBeTruthy();
    expect(screen.getByLabelText('Checking demo submission')).toBeTruthy();
    expect(screen.getByText(/not the authenticity of a student ID/i)).toBeTruthy();
    expect(screen.queryByText('Simulate Approval')).toBeNull();
    expect(screen.queryByText('Simulate Rejection')).toBeNull();
  });

  it('labels the completed result as demo approval', () => {
    mockVerificationStatus = 'verified';
    const screen = render(<VerificationScreen />);
    expect(screen.getByText('Demo Approved')).toBeTruthy();
    expect(screen.getByText(/No school or identity verification was performed/i)).toBeTruthy();
  });
});
