import { Role, ActivationStatus, PaymentStatus, Package, Order, User } from './types';
import { formatISO, subDays } from 'date-fns';

// In a real app, this would be in a secure backend
export const USERS: User[] = [
  { id: 1, username: 'admin', password: '1', name: 'Admin Tifo', role: Role.Admin, isActive: true },
  { id: 2, username: 'thuytien', password: 'password', name: 'Thuỷ Tiên', role: Role.Agent, discountPercentage: 25, isActive: true },
];

export const PACKAGES: Package[] = [
  { id: 1, name: 'Gói 1 tháng', price: 400000 },
  { id: 2, name: 'Gói 3 tháng', price: 800000 },
  { id: 3, name: 'Gói 6 tháng', price: 1200000 },
  { id: 4, name: 'Gói 1 năm', price: 1200000 },
];

export const MOCK_ORDERS: Order[] = [
  { id: 1, account_name: 'Khách hàng Mẫu', account_email: 'customer@example.com', packageId: 4, price: 1200000, status: ActivationStatus.Activated, paymentStatus: PaymentStatus.Paid, agentId: 2, sold_at: formatISO(subDays(new Date(), 5)), notes: 'Khách VIP, ưu tiên hỗ trợ.' },
];