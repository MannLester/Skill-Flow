import { formatPeso, notifications, services } from '@/data/fixtures';

describe('normalized demo copy', () => {
  it('uses peso formatting consistently', () => {
    expect(formatPeso(1500)).toBe('₱1,500');
    expect(notifications.some((item) => item.detail.includes('P1,500'))).toBe(false);
    expect(services.every((service) => service.price > 0)).toBe(true);
  });
});
