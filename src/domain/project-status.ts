import type { ProjectBooking, ProjectStatus } from '@/context/session';

const INACTIVE_PROJECT_STATUSES: readonly ProjectStatus[] = ['declined', 'cancelled', 'completed', 'reviewed'];

export function countActiveProjects(bookings: readonly Pick<ProjectBooking, 'status'>[]) {
  return bookings.filter((booking) => !INACTIVE_PROJECT_STATUSES.includes(booking.status)).length;
}
