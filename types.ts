// Fix: Removed circular dependency on 'Role' by defining it here.
export enum Role {
  Admin = 'ADMIN',
  Agent = 'AGENT',
}

export enum ActivationStatus {
  Activated = 'ĐÃ KÍCH HOẠT',
  NotActivated = 'CHƯA KÍCH HOẠT',
}

export enum PaymentStatus {
  Paid = 'ĐÃ THANH TOÁN',
  Unpaid = 'CHƯA THANH TOÁN',
}

export enum DebtStatus {
    Paid = 'Đã thanh toán',
    Unpaid = 'Chưa thanh toán',
}

export interface User {
  id: number;
  username: string;
  password?: string;
  name: string;
  role: Role;
  isActive: boolean;
  discountPercentage?: number;
}

export interface Package {
  id: number;
  name: string;
  price: number;
}

export interface Order {
  id: number;
  account_name: string;
  account_email: string;
  packageId: number;
  price: number;
  actual_revenue?: number;
  status: ActivationStatus;
  paymentStatus: PaymentStatus;
  agentId: number;
  sold_at: string; // ISO string
  notes?: string;
}

export interface DailyDebt {
    id: string; // "agentId_date"
    agentId: number;
    date: string; // "yyyy-MM-dd"
    totalGrossRevenue: number;
    totalNetRevenue: number;
    status: DebtStatus;
}

export interface AdminLog {
  id: number;
  timestamp: string; // ISO string
  adminId: number;
  adminName: string;
  description: string;
}

// Fix: Added missing ChartData interface for RevenueChart component.
export interface ChartData {
  date: string;
  revenue: number;
  netRevenue?: number;
}

export interface AppDataBackup {
  users: User[];
  orders: Order[];
  daily_debts: Record<string, DebtStatus>;
  admin_logs: AdminLog[];
}