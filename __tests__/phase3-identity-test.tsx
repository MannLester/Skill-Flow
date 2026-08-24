import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';

import { SessionProvider, ServiceInput, useSession } from '@/context/session';

const demoService: ServiceInput = { title: 'Demo Presentation Design', subtitle: 'Clear academic slides', category: 'Graphics & Design', description: 'I will create a clear presentation for your academic project.', price: 900, deliveryDays: 3, revisions: '2 revisions' };

function IdentityHarness() {
  const { addCertification, addPortfolioItem, currentAccount, portfolioItems, certifications, loginAsRole, profiles, registerAccount, saveService, services, simulateVerificationReview, submitVerification, updateProfile, verifications } = useSession();
  const [result, setResult] = useState('none');
  const verification = verifications.find((item) => item.studentId === currentAccount?.id);
  const ownServices = services.filter((item) => item.providerId === currentAccount?.id);
  const profile = profiles.find((item) => item.accountId === currentAccount?.id);
  const show = (value: { ok: boolean; message?: string }) => setResult(value.ok ? 'ok' : value.message ?? 'failed');
  return <View>
    <Text>Account: {currentAccount?.name ?? 'none'}</Text><Text>Verification: {verification?.status ?? 'none'}</Text><Text>Result: {result}</Text><Text>Own drafts: {ownServices.filter((item) => item.status === 'draft').length}</Text><Text>Own published: {ownServices.filter((item) => item.status === 'published').length}</Text><Text>Bio: {profile?.bio ?? ''}</Text><Text>Portfolio: {portfolioItems.filter((item) => item.studentId === currentAccount?.id).length}</Text><Text>Certifications: {certifications.filter((item) => item.studentId === currentAccount?.id).length}</Text>
    <Pressable onPress={() => registerAccount({ name: 'New Student', email: 'new@student.test', password: 'secret1', role: 'student' })}><Text>Register Student</Text></Pressable>
    <Pressable onPress={() => show(saveService(demoService, true))}><Text>Publish Service</Text></Pressable>
    <Pressable onPress={() => show(saveService(demoService, false))}><Text>Save Draft</Text></Pressable>
    <Pressable onPress={() => show(submitVerification({ school: 'Batangas State University TNEU', studentNumber: '2026-1234-5678', program: 'ICT', gradeLevel: 'Grade 12', graduationYear: 2027, sampleDocumentName: 'sample-student-id.png' }))}><Text>Submit Verification</Text></Pressable>
    <Pressable onPress={() => show(simulateVerificationReview(true))}><Text>Approve Verification</Text></Pressable>
    <Pressable onPress={() => loginAsRole('student')}><Text>Use Alex</Text></Pressable>
    <Pressable onPress={() => show(updateProfile({ name: 'Alex Designer', bio: 'Updated student bio.', location: 'Batangas City', school: 'Batangas State University TNEU', program: 'Arts and Design', gradeLevel: 'Grade 12', graduationYear: 2027, skills: ['Branding'] }))}><Text>Update Profile</Text></Pressable>
    <Pressable onPress={() => show(addPortfolioItem({ title: 'Poster Study', description: 'A sample poster project.', category: 'Poster Design' }))}><Text>Add Portfolio</Text></Pressable>
    <Pressable onPress={() => show(addCertification({ name: 'Design Basics', issuer: 'Demo Academy', year: 2026 }))}><Text>Add Certification</Text></Pressable>
  </View>;
}

describe('profiles, verification, portfolios, and services', () => {
  it('blocks publishing until the student completes simulated verification', () => {
    const screen = render(<SessionProvider><IdentityHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Register Student'));
    expect(screen.getByText('Verification: not_submitted')).toBeTruthy();
    fireEvent.press(screen.getByText('Publish Service'));
    expect(screen.getByText('Result: Student verification is required before publishing a service.')).toBeTruthy();
    fireEvent.press(screen.getByText('Save Draft'));
    expect(screen.getByText('Own drafts: 1')).toBeTruthy();
    fireEvent.press(screen.getByText('Submit Verification'));
    expect(screen.getByText('Verification: pending')).toBeTruthy();
    fireEvent.press(screen.getByText('Approve Verification'));
    expect(screen.getByText('Verification: verified')).toBeTruthy();
    fireEvent.press(screen.getByText('Publish Service'));
    expect(screen.getByText('Own published: 1')).toBeTruthy();
  });

  it('updates a student profile, portfolio, and certifications', () => {
    const screen = render(<SessionProvider><IdentityHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Alex'));
    fireEvent.press(screen.getByText('Update Profile'));
    expect(screen.getByText('Account: Alex Designer')).toBeTruthy();
    expect(screen.getByText('Bio: Updated student bio.')).toBeTruthy();
    fireEvent.press(screen.getByText('Add Portfolio'));
    expect(screen.getByText('Portfolio: 2')).toBeTruthy();
    fireEvent.press(screen.getByText('Add Certification'));
    expect(screen.getByText('Certifications: 2')).toBeTruthy();
  });
});
