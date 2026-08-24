import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

import { ProjectAction, SessionProvider, useSession } from '@/context/session';
import { calculateCareerReadiness } from '@/domain/career-readiness';

function ReadinessHarness() {
  const { actOnProject, addCompletedProjectToPortfolio, bookings, createBooking, getCareerReadiness, loginAsRole } = useSession();
  const project = bookings[0];
  const act = (action: ProjectAction, payload?: { rating?: number; comment?: string }) => project && actOnProject(project.id, action, payload);
  return <View>
    <Text>Score: {getCareerReadiness('student-alex').score}</Text>
    <Pressable onPress={() => loginAsRole('client')}><Text>Use Mark</Text></Pressable><Pressable onPress={() => loginAsRole('student')}><Text>Use Alex</Text></Pressable>
    <Pressable onPress={() => createBooking({ serviceId: 'logo', studentId: 'student-alex', title: 'Readiness Project', description: 'A completed project used to verify readiness scoring.', deliveryDays: 3, budget: 1200 })}><Text>Create</Text></Pressable>
    <Pressable onPress={() => act('accept')}><Text>Accept</Text></Pressable><Pressable onPress={() => act('fund')}><Text>Fund</Text></Pressable><Pressable onPress={() => act('start')}><Text>Start</Text></Pressable><Pressable onPress={() => project && actOnProject(project.id, 'submit', { note: 'Final files delivered.' })}><Text>Submit</Text></Pressable><Pressable onPress={() => act('approve')}><Text>Approve</Text></Pressable><Pressable onPress={() => act('review', { rating: 5, comment: 'Excellent work.' })}><Text>Review</Text></Pressable><Pressable onPress={() => project && addCompletedProjectToPortfolio(project.id)}><Text>Add to Portfolio</Text></Pressable>
  </View>;
}

describe('Career Readiness Score', () => {
  it('updates from completion, review, and portfolio evidence', () => {
    const screen = render(<SessionProvider><ReadinessHarness /></SessionProvider>);
    expect(screen.getByText('Score: 40')).toBeTruthy();
    fireEvent.press(screen.getByText('Use Mark')); fireEvent.press(screen.getByText('Create')); fireEvent.press(screen.getByText('Use Alex')); fireEvent.press(screen.getByText('Accept')); fireEvent.press(screen.getByText('Use Mark')); fireEvent.press(screen.getByText('Fund')); fireEvent.press(screen.getByText('Use Alex')); fireEvent.press(screen.getByText('Start')); fireEvent.press(screen.getByText('Submit')); fireEvent.press(screen.getByText('Use Mark')); fireEvent.press(screen.getByText('Approve'));
    expect(screen.getByText('Score: 45')).toBeTruthy();
    fireEvent.press(screen.getByText('Review')); expect(screen.getByText('Score: 60')).toBeTruthy();
    fireEvent.press(screen.getByText('Use Alex')); fireEvent.press(screen.getByText('Add to Portfolio')); expect(screen.getByText('Score: 65')).toBeTruthy();
  });

  it('caps every category and the total at 100', () => {
    const many = Array.from({ length: 8 }, (_, index) => index);
    const result = calculateCareerReadiness('student', {
      profiles: [{ accountId: 'student', bio: 'Bio', location: 'City', school: 'School', program: 'Program', gradeLevel: 'Grade 12', graduationYear: 2027, skills: ['Design'] }],
      verifications: [{ studentId: 'student', status: 'verified', school: 'School', studentNumberMasked: '****', program: 'Program', gradeLevel: 'Grade 12' }],
      portfolioItems: many.map((index) => ({ id: `portfolio-${index}`, studentId: 'student', title: 'Work', description: 'Evidence', category: 'Design', createdAt: '2026-01-01' })),
      bookings: many.map((index) => ({ id: `booking-${index}`, source: 'proposal', clientId: 'client', studentId: 'student', title: 'Project', description: 'Done', deliveryDays: 1, budget: 1, status: 'reviewed', createdAt: '2026-01-01', updatedAt: '2026-01-01' })),
      reviews: many.map((index) => ({ id: `review-${index}`, projectId: `booking-${index}`, clientId: 'client', studentId: 'student', rating: 5, comment: 'Great', createdAt: '2026-01-01' })),
      certifications: many.map((index) => ({ id: `cert-${index}`, studentId: 'student', name: 'Course', issuer: 'Academy', year: 2026, createdAt: '2026-01-01' })),
    });
    expect(result.score).toBe(100); expect(result.level).toBe('Career Ready'); expect(result.categories.every((item) => item.score <= item.maximum)).toBe(true);
  });
});
