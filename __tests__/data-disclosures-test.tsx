import { render } from '@testing-library/react-native';

import HelpScreen from '@/app/help';
import PrivacyPolicyScreen from '@/app/privacy-policy';
import SettingsScreen from '@/app/settings';
import TermsScreen from '@/app/terms';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() } }));
jest.mock('@/context/session.remote', () => ({
  useSession: () => ({
    logout: jest.fn(),
    preferences: { darkMode: true, language: 'English', notificationsEnabled: true },
    updatePreferences: jest.fn(),
  }),
}));

describe('cloud data-handling disclosures', () => {
  it('identifies cloud storage, Clerk processing, simulations, and available controls in the privacy notice', () => {
    const screen = render(<PrivacyPolicyScreen />);

    expect(screen.getByText(/demonstration records are stored in Convex Cloud/i)).toBeTruthy();
    expect(screen.getByText(/Clerk processes account registration and sign-in, email verification, OAuth when you choose it, session data, and delivery of password-recovery email codes/i)).toBeTruthy();
    expect(screen.getByText(/Student Verification and its review outcomes are simulations/i)).toBeTruthy();
    expect(screen.getByText(/does not perform real identity verification/i)).toBeTruthy();
    expect(screen.getByText(/AI Mentor sends prompts to a temporary OpenCode Zen model/i)).toBeTruthy();
    expect(screen.getByText(/deterministic simulated guidance when Zen is unavailable/i)).toBeTruthy();
    expect(screen.getByText(/Do not share personal, confidential, or client information/i)).toBeTruthy();
    expect(screen.getByText(/You can clear mentor conversation history/i)).toBeTruthy();
    expect(screen.getByText(/Cloud-development seed resets are operator-only/i)).toBeTruthy();
    expect(screen.getByText(/Do not enter real student IDs, financial credentials, confidential project files, or private client information/i)).toBeTruthy();
    expect(screen.queryByText(/stored locally on the device/i)).toBeNull();
    expect(screen.queryByText(/does not send account information to an email provider/i)).toBeNull();
  });

  it('states the same material cloud and simulation boundaries in the terms', () => {
    const screen = render(<TermsScreen />);

    expect(screen.getByText(/Authenticated application records are stored in Convex Cloud/i)).toBeTruthy();
    expect(screen.getByText(/Clerk processes registration, authentication, email verification, OAuth when chosen, session data, and password-recovery email delivery/i)).toBeTruthy();
    expect(screen.getByText(/balances, payment holds, releases, ratings, verification, and notifications are simulations/i)).toBeTruthy();
    expect(screen.getByText(/mentor may send prompts to a temporary OpenCode Zen model/i)).toBeTruthy();
    expect(screen.getByText(/deterministic simulated guidance when Zen is unavailable/i)).toBeTruthy();
    expect(screen.getByText(/Settings does not provide a general account-data deletion or demo-reset action/i)).toBeTruthy();
    expect(screen.getByText(/do not enter real student IDs, financial credentials, confidential project files, private client information/i)).toBeTruthy();
    expect(screen.queryByText(/stored locally on the device/i)).toBeNull();
  });

  it('corrects cloud storage, recovery, mentor, verification, and reset answers in Help', () => {
    const screen = render(<HelpScreen />);

    expect(screen.getByText('How do I test both roles?')).toBeTruthy();
    expect(screen.getByText(/one Student Designer account and one Client account in the Clerk development instance/i)).toBeTruthy();
    expect(screen.getByText(/Log out and sign in to the other account to switch roles/i)).toBeTruthy();
    expect(screen.getByText(/Authenticated application records, including shared project data, are stored in Convex Cloud/i)).toBeTruthy();
    expect(screen.getByText(/Clerk processes authentication, email verification, OAuth when chosen, session data, and delivery of password-recovery email codes/i)).toBeTruthy();
    expect(screen.getByText(/Never enter card or banking information/i)).toBeTruthy();
    expect(screen.getByText(/Never enter a real student ID/i)).toBeTruthy();
    expect(screen.getByText(/prompts are sent to a temporary OpenCode Zen model/i)).toBeTruthy();
    expect(screen.getByText(/deterministic simulated guidance when Zen is unavailable/i)).toBeTruthy();
    expect(screen.getByText(/There is no demo-reset action in Settings/i)).toBeTruthy();
    expect(screen.queryByText(/only on this device/i)).toBeNull();
    expect(screen.queryByText(/Use Reset Demo Data in Settings/i)).toBeNull();
    expect(screen.queryByText(/Alex Student Designer or Mark Client demo login/i)).toBeNull();
  });

  it('identifies the cloud-backed preference shown in Settings', () => {
    const screen = render(<SettingsScreen />);

    expect(screen.getByText(/This preference is stored in Convex Cloud and restored when you sign in again/i)).toBeTruthy();
    expect(screen.queryByText(/This local preference is preserved/i)).toBeNull();
  });
});
