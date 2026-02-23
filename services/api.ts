import { USERS, PACKAGES, MOCK_ORDERS } from '../constants';
import { User, Order, Role, PaymentStatus, DailyDebt, DebtStatus, AppDataBackup, AdminLog } from '../types';
import { format, formatISO, parseISO, startOfDay } from 'date-fns';

// In a real app, these would be API calls. We're simulating with a delay.
const SIMULATED_DELAY = 200;

// Use a mutable in-memory store to reflect changes during the session
export let users_db: User[] = JSON.parse(JSON.stringify(USERS));
export let orders_db: Order[] = JSON.parse(JSON.stringify(MOCK_ORDERS));
export let admin_logs_db: AdminLog[] = [];
// In-memory store for debt statuses. Key is `agentId_date`, value is the status.
export let daily_debts_db: Record<string, DebtStatus> = {};


let nextOrderId = orders_db.length > 0 ? Math.max(...orders_db.map(o => o.id)) + 1 : 1;
let nextUserId = users_db.length > 0 ? Math.max(...users_db.map(u => u.id)) + 1 : 1;
let nextLogId = 1;


export const login = (username: string, password: string): { success: boolean; user?: User; message?: string } => {
  // Use the mutable db for login check
  const user = users_db.find(u => u.username === username && u.password === password);
  if (user) {
    if (user.isActive) {
      // Don't send password to frontend
      const { password, ...userWithoutPassword } = user;
      return { success: true, user: userWithoutPassword };
    }
    return { success: false, message: 'Tài khoản đã bị vô hiệu hoá.' };
  }
  return { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
};

export const getOrders = async (user: User): Promise<Order[]> => {
  await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
  if (user.role === Role.Admin) {
    return [...orders_db].sort((a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime());
  }
  return [...orders_db].filter(o => o.agentId === user.id).sort((a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime());
};

export const getPackages = async () => {
  await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
  return PACKAGES;
};

export const getUsers = async (): Promise<User[]> => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
    // Exclude passwords from the user list returned to the client
    return users_db.map(({ password, ...user }) => user);
};

export const addOrder = async (orderData: Omit<Order, 'id'>): Promise<Order> => {
  await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
  const newOrder: Order = {
    ...orderData,
    id: nextOrderId++,
    sold_at: orderData.sold_at || formatISO(new Date()),
  };
  orders_db.push(newOrder);
  return newOrder;
};

export const updateOrder = async (updatedOrder: Order): Promise<Order> => {
  await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
  const index = orders_db.findIndex(o => o.id === updatedOrder.id);
  if (index !== -1) {
    orders_db[index] = updatedOrder;
    return updatedOrder;
  }
  throw new Error('Order not found');
};

export const deleteOrder = async (orderId: number): Promise<{ success: boolean }> => {
  await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
  const initialLength = orders_db.length;
  orders_db = orders_db.filter(o => o.id !== orderId);
  if (orders_db.length < initialLength) {
    return { success: true };
  }
  throw new Error('Order not found');
};

// --- Agent Management APIs ---

export const createAgent = async (agentData: Omit<User, 'id' | 'role'>): Promise<User> => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
    const newUser: User = {
        ...agentData,
        id: nextUserId++,
        role: Role.Agent,
    };
    users_db.push(newUser);
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
};

export const updateAgent = async (updatedAgent: User): Promise<User> => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
    const index = users_db.findIndex(u => u.id === updatedAgent.id);
    if (index !== -1) {
        // Ensure we merge correctly and don't lose the password if it's not being changed
        const existingUser = users_db[index];
        users_db[index] = { ...existingUser, ...updatedAgent };
        const { password, ...userWithoutPassword } = users_db[index];
        return userWithoutPassword;
    }
    throw new Error('User not found');
};

export const deleteAgent = async (agentId: number): Promise<{ success: boolean }> => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
    const initialLength = users_db.length;
    users_db = users_db.filter(u => u.id !== agentId);
    if (users_db.length < initialLength) {
        // Also delete orders associated with this agent for data consistency in this mock setup
        orders_db = orders_db.filter(o => o.agentId !== agentId);
        return { success: true };
    }
    throw new Error('User not found');
};


// --- Debt Management APIs ---

export const getDailyDebts = async (user: User): Promise<DailyDebt[]> => {
  if (user.role !== Role.Admin) return [];
  await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));

  const groupedByAgentAndDay: Record<string, Order[]> = orders_db.reduce((acc: Record<string, Order[]>, order) => {
    const day = format(startOfDay(parseISO(order.sold_at)), 'yyyy-MM-dd');
    const key = `${order.agentId}_${day}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(order);
    return acc;
  }, {});
  
  const agents = users_db.filter(u => u.role === Role.Agent);
  const dailyDebts: DailyDebt[] = Object.entries(groupedByAgentAndDay).map(([key, dailyOrders]) => {
    const [agentIdStr, date] = key.split('_');
    const agentId = parseInt(agentIdStr, 10);
    const agent = agents.find(a => a.id === agentId);
    const discount = agent?.discountPercentage || 0;

    const totalGrossRevenue = dailyOrders.reduce((sum, o) => sum + o.price, 0);
    const totalNetRevenue = totalGrossRevenue * (1 - discount / 100);
    
    return {
      id: key,
      agentId,
      date,
      totalGrossRevenue,
      totalNetRevenue,
      status: daily_debts_db[key] || DebtStatus.Unpaid,
    };
  });

  return dailyDebts.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const updateDebtStatus = async (debtId: string, status: DebtStatus): Promise<{ success: boolean }> => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
    daily_debts_db[debtId] = status;

    // --- NEW: Sync order payment status ---
    const [agentIdStr, date] = debtId.split('_');
    const agentId = parseInt(agentIdStr, 10);
    const newPaymentStatus = status === DebtStatus.Paid ? PaymentStatus.Paid : PaymentStatus.Unpaid;

    orders_db = orders_db.map(order => {
        const orderDate = format(startOfDay(parseISO(order.sold_at)), 'yyyy-MM-dd');
        if (order.agentId === agentId && orderDate === date) {
            return { ...order, paymentStatus: newPaymentStatus };
        }
        return order;
    });
    // ------------------------------------

    return { success: true };
};

// --- Admin Logging APIs ---

export const getAdminLogs = async (): Promise<AdminLog[]> => {
  await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
  return [...admin_logs_db].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const logAction = async (adminId: number, adminName: string, description: string): Promise<AdminLog> => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY / 4)); // Make logging faster
    const newLog: AdminLog = {
        id: nextLogId++,
        timestamp: formatISO(new Date()),
        adminId,
        adminName,
        description,
    };
    admin_logs_db.push(newLog);
    return newLog;
};


// --- Import/Export APIs ---

export const getAppStateForBackup = async (): Promise<AppDataBackup> => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
    return {
        users: users_db,
        orders: orders_db,
        daily_debts: daily_debts_db,
        admin_logs: admin_logs_db,
    };
};

export const loadStateFromBackup = async (data: AppDataBackup): Promise<{ success: boolean }> => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
    // Basic validation
    if (!data.users || !data.orders || data.daily_debts === undefined || !data.admin_logs) {
        throw new Error("Invalid backup file format.");
    }
    
    users_db = data.users;
    orders_db = data.orders;
    daily_debts_db = data.daily_debts;
    admin_logs_db = data.admin_logs;

    // Reset ID counters to prevent conflicts
    nextOrderId = orders_db.length > 0 ? Math.max(...orders_db.map(o => o.id)) + 1 : 1;
    nextUserId = users_db.length > 0 ? Math.max(...users_db.map(u => u.id)) + 1 : 1;
    nextLogId = admin_logs_db.length > 0 ? Math.max(...admin_logs_db.map(l => l.id)) + 1 : 1;

    return { success: true };
};