export type Service = {
  id: string; title: string; subtitle: string; provider: string; providerId: string; rating: number;
  reviews: number; price: number; category: string; description: string;
  deliveryDays: number; revisions: string; status: 'draft' | 'published' | 'archived';
  crop: { x: number; y: number; width: number; height: number };
};

export type NotificationItem = {
  id: string; title: string; detail: string; time: string;
  kind: 'project' | 'message' | 'payment' | 'complete'; unread?: boolean; mention?: boolean;
};

export const services: Service[] = [
  { id: 'logo', title: 'Logo Design', subtitle: 'Minimalist · Graphic Design', provider: 'Alex D.', providerId: 'student-alex', rating: 4.9, reviews: 32, price: 1500, category: 'Graphics & Design', description: 'I will create a modern and professional logo for your business.', deliveryDays: 3, revisions: 'Unlimited', status: 'published', crop: { x: 765, y: 350, width: 90, height: 91 } },
  { id: 'uiux', title: 'UI/UX Design', subtitle: 'Web & App Interface Design', provider: 'Jamie R.', providerId: 'student-jamie', rating: 4.8, reviews: 32, price: 1000, category: 'Web & App', description: 'I will design a clear and responsive interface for your website or mobile application.', deliveryDays: 5, revisions: '3 revisions', status: 'published', crop: { x: 765, y: 503, width: 90, height: 91 } },
  { id: 'poster', title: 'Poster Design', subtitle: 'Creative · Eye-catching', provider: 'Sam M.', providerId: 'student-sam', rating: 4.7, reviews: 47, price: 1000, category: 'Graphics & Design', description: 'I will create an eye-catching poster tailored to your event, campaign, or brand.', deliveryDays: 3, revisions: '2 revisions', status: 'published', crop: { x: 765, y: 654, width: 90, height: 91 } },
  { id: 'illustration', title: 'Illustration', subtitle: 'Custom illustration', provider: 'Elis G.', providerId: 'student-elis', rating: 4.9, reviews: 15, price: 1200, category: 'Graphics & Design', description: 'I will produce a custom digital illustration based on your brief.', deliveryDays: 5, revisions: '2 revisions', status: 'published', crop: { x: 765, y: 805, width: 90, height: 91 } },
];

export const notifications: NotificationItem[] = [
  { id: '1', title: 'New project posted', detail: 'Need a logo for my brand', time: '10:30 AM', kind: 'project', unread: true },
  { id: '2', title: 'Alex D. sent you a message', detail: "Let's discuss your project.", time: '10:28 AM', kind: 'message', unread: true, mention: true },
  { id: '3', title: 'Your proposal was viewed', detail: 'Mobile App UI Design', time: 'Yesterday', kind: 'project' },
  { id: '4', title: 'Payment received', detail: 'You received ₱1,500', time: 'Yesterday', kind: 'payment' },
  { id: '5', title: 'Project completed', detail: 'Logo Design for Coffee Shop', time: '2 days ago', kind: 'complete' },
];

export const formatPeso = (value: number) => `₱${value.toLocaleString('en-PH')}`;
