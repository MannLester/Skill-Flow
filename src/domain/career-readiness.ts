import type { Certification, PortfolioItem, ProjectBooking, ProjectReview, StudentVerification, UserProfile } from '@/context/session';

export type ReadinessCategoryKey = 'profile' | 'verification' | 'portfolio' | 'projects' | 'ratings' | 'certifications';

export type CareerReadinessCategory = {
  key: ReadinessCategoryKey;
  label: string;
  score: number;
  maximum: number;
  detail: string;
  nextStep: string;
};

export type CareerReadinessBreakdown = {
  studentId: string;
  score: number;
  maximum: 100;
  level: 'Getting Started' | 'Building' | 'Project Ready' | 'Career Ready';
  categories: CareerReadinessCategory[];
};

type ReadinessData = {
  profiles: UserProfile[];
  verifications: StudentVerification[];
  portfolioItems: PortfolioItem[];
  bookings: ProjectBooking[];
  reviews: ProjectReview[];
  certifications: Certification[];
};

export function calculateCareerReadiness(studentId: string, data: ReadinessData): CareerReadinessBreakdown {
  const profile = data.profiles.find((item) => item.accountId === studentId);
  const profileChecks = [
    Boolean(profile?.bio.trim()),
    Boolean(profile?.location.trim()),
    Boolean(profile?.school?.trim() && profile?.program?.trim()),
    Boolean(profile?.gradeLevel?.trim() && profile?.graduationYear),
    Boolean(profile?.skills.length),
  ];
  const profileComplete = profileChecks.filter(Boolean).length;
  const verified = data.verifications.find((item) => item.studentId === studentId)?.status === 'verified';
  const portfolioCount = data.portfolioItems.filter((item) => item.studentId === studentId).length;
  const completedCount = data.bookings.filter((item) => item.studentId === studentId && ['completed', 'reviewed'].includes(item.status)).length;
  const studentReviews = data.reviews.filter((item) => item.studentId === studentId);
  const averageRating = studentReviews.length ? studentReviews.reduce((total, item) => total + item.rating, 0) / studentReviews.length : 0;
  const certificationCount = data.certifications.filter((item) => item.studentId === studentId).length;

  const categories: CareerReadinessCategory[] = [
    { key: 'profile', label: 'Profile completeness', score: profileComplete * 3, maximum: 15, detail: `${profileComplete}/5 profile checkpoints`, nextStep: profileComplete === 5 ? 'Profile is complete.' : 'Add missing biography, location, education, grade, or skills.' },
    { key: 'verification', label: 'Student verification', score: verified ? 15 : 0, maximum: 15, detail: verified ? 'Simulated verification complete' : 'Verification not complete', nextStep: verified ? 'Student status is verified.' : 'Complete the simulated student verification.' },
    { key: 'portfolio', label: 'Portfolio evidence', score: Math.min(portfolioCount * 5, 20), maximum: 20, detail: `${portfolioCount}/4 portfolio items`, nextStep: portfolioCount >= 4 ? 'Portfolio evidence is complete.' : 'Add portfolio work or a completed client project.' },
    { key: 'projects', label: 'Completed projects', score: Math.min(completedCount * 5, 25), maximum: 25, detail: `${completedCount}/5 completed projects`, nextStep: completedCount >= 5 ? 'Completed-project milestone reached.' : 'Complete another funded client project.' },
    { key: 'ratings', label: 'Client ratings', score: Math.round((averageRating / 5) * 15), maximum: 15, detail: studentReviews.length ? `${averageRating.toFixed(1)}/5 average from ${studentReviews.length} review${studentReviews.length === 1 ? '' : 's'}` : 'No client reviews yet', nextStep: studentReviews.length ? 'Maintain strong outcomes and client feedback.' : 'Complete a project and receive a client review.' },
    { key: 'certifications', label: 'Certifications', score: Math.min(certificationCount * 5, 10), maximum: 10, detail: `${certificationCount}/2 certifications`, nextStep: certificationCount >= 2 ? 'Certification milestone reached.' : 'Add another relevant certification.' },
  ];
  const score = categories.reduce((total, category) => total + category.score, 0);
  const level = score >= 80 ? 'Career Ready' : score >= 60 ? 'Project Ready' : score >= 30 ? 'Building' : 'Getting Started';
  return { studentId, score, maximum: 100, level, categories };
}
