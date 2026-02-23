import { User, Order, Role, PaymentStatus, DailyDebt, DebtStatus, AppDataBackup, AdminLog, Package } from '../types';
import { format, formatISO, parseISO, startOfDay } from 'date-fns';
import { supabase } from './supabase';

export const login = async (username: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .eq('password', password)
    .single();

  if (error || !data) {
    return { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }

  const user = data as User;
  if (user.isActive) {
    const { password, ...userWithoutPassword } = user;
    return { success: true, user: userWithoutPassword as User };
  }
  return { success: false, message: 'Tài khoản đã bị vô hiệu hoá.' };
};

export const getOrders = async (user: User): Promise<Order[]> => {
  let query = supabase.from('orders').select('*').order('sold_at', { ascending: true });
  
  if (user.role !== Role.Admin) {
    query = query.eq('agentId', user.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Order[];
};

export const getPackages = async (): Promise<Package[]> => {
  const { data, error } = await supabase.from('packages').select('*');
  if (error) throw error;
  return data as Package[];
};

export const getUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) throw error;
  return data.map(({ password, ...user }) => user as User);
};

export const addOrder = async (orderData: Omit<Order, 'id'>): Promise<Order> => {
  const newOrderData = {
    ...orderData,
    sold_at: orderData.sold_at || formatISO(new Date()),
  };

  const { data, error } = await supabase
    .from('orders')
    .insert([newOrderData])
    .select()
    .single();

  if (error) throw error;
  return data as Order;
};

export const updateOrder = async (updatedOrder: Order): Promise<Order> => {
  const { data, error } = await supabase
    .from('orders')
    .update(updatedOrder)
    .eq('id', updatedOrder.id)
    .select()
    .single();

  if (error) throw error;
  return data as Order;
};

export const deleteOrder = async (orderId: number): Promise<{ success: boolean }> => {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId);

  if (error) throw error;
  return { success: true };
};

// --- Agent Management APIs ---

export const createAgent = async (agentData: Omit<User, 'id' | 'role'>): Promise<User> => {
  const newUserData = {
    ...agentData,
    role: Role.Agent,
  };

  const { data, error } = await supabase
    .from('users')
    .insert([newUserData])
    .select()
    .single();

  if (error) throw error;
  const { password, ...userWithoutPassword } = data as User;
  return userWithoutPassword as User;
};

export const updateAgent = async (updatedAgent: User): Promise<User> => {
  const { data, error } = await supabase
    .from('users')
    .update(updatedAgent)
    .eq('id', updatedAgent.id)
    .select()
    .single();

  if (error) throw error;
  const { password, ...userWithoutPassword } = data as User;
  return userWithoutPassword as User;
};

export const deleteAgent = async (agentId: number): Promise<{ success: boolean }> => {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', agentId);

  if (error) throw error;
  
  // Also delete orders associated with this agent for data consistency
  await supabase.from('orders').delete().eq('agentId', agentId);
  
  return { success: true };
};

// --- Debt Management APIs ---

export const getDailyDebts = async (user: User): Promise<DailyDebt[]> => {
  if (user.role !== Role.Admin) return [];

  const [ordersRes, usersRes, debtsRes] = await Promise.all([
    supabase.from('orders').select('*'),
    supabase.from('users').select('*').eq('role', Role.Agent),
    supabase.from('daily_debts').select('*')
  ]);

  if (ordersRes.error) throw ordersRes.error;
  if (usersRes.error) throw usersRes.error;
  if (debtsRes.error) throw debtsRes.error;

  const orders = ordersRes.data as Order[];
  const agents = usersRes.data as User[];
  const dailyDebtsDb = (debtsRes.data as { id: string, status: DebtStatus }[]).reduce((acc, curr) => {
    acc[curr.id] = curr.status;
    return acc;
  }, {} as Record<string, DebtStatus>);

  const groupedByAgentAndDay: Record<string, Order[]> = orders.reduce((acc: Record<string, Order[]>, order) => {
    const day = format(startOfDay(parseISO(order.sold_at)), 'yyyy-MM-dd');
    const key = `${order.agentId}_${day}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(order);
    return acc;
  }, {});
  
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
      status: dailyDebtsDb[key] || DebtStatus.Unpaid,
    };
  });

  return dailyDebts.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const updateDebtStatus = async (debtId: string, status: DebtStatus): Promise<{ success: boolean }> => {
  // Upsert the daily debt status
  const { error: debtError } = await supabase
    .from('daily_debts')
    .upsert({ id: debtId, status });

  if (debtError) throw debtError;

  // Sync order payment status
  const [agentIdStr, date] = debtId.split('_');
  const agentId = parseInt(agentIdStr, 10);
  const newPaymentStatus = status === DebtStatus.Paid ? PaymentStatus.Paid : PaymentStatus.Unpaid;

  // We need to fetch orders for this agent and date to update them
  const { data: orders, error: fetchError } = await supabase
    .from('orders')
    .select('*')
    .eq('agentId', agentId);

  if (fetchError) throw fetchError;

  const ordersToUpdate = (orders as Order[]).filter(order => {
    const orderDate = format(startOfDay(parseISO(order.sold_at)), 'yyyy-MM-dd');
    return orderDate === date;
  });

  if (ordersToUpdate.length > 0) {
    const updates = ordersToUpdate.map(order => ({
      ...order,
      paymentStatus: newPaymentStatus
    }));

    const { error: updateError } = await supabase
      .from('orders')
      .upsert(updates);

    if (updateError) throw updateError;
  }

  return { success: true };
};

// --- Admin Logging APIs ---

export const getAdminLogs = async (): Promise<AdminLog[]> => {
  const { data, error } = await supabase
    .from('admin_logs')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) throw error;
  return data as AdminLog[];
};

export const logAction = async (adminId: number, adminName: string, description: string): Promise<AdminLog> => {
  const newLogData = {
    timestamp: formatISO(new Date()),
    adminId,
    adminName,
    description,
  };

  const { data, error } = await supabase
    .from('admin_logs')
    .insert([newLogData])
    .select()
    .single();

  if (error) throw error;
  return data as AdminLog;
};

// --- Import/Export APIs ---

export const getAppStateForBackup = async (): Promise<AppDataBackup> => {
  const [usersRes, ordersRes, debtsRes, logsRes] = await Promise.all([
    supabase.from('users').select('*'),
    supabase.from('orders').select('*'),
    supabase.from('daily_debts').select('*'),
    supabase.from('admin_logs').select('*')
  ]);

  if (usersRes.error) throw usersRes.error;
  if (ordersRes.error) throw ordersRes.error;
  if (debtsRes.error) throw debtsRes.error;
  if (logsRes.error) throw logsRes.error;

  const daily_debts = (debtsRes.data as { id: string, status: DebtStatus }[]).reduce((acc, curr) => {
    acc[curr.id] = curr.status;
    return acc;
  }, {} as Record<string, DebtStatus>);

  return {
    users: usersRes.data as User[],
    orders: ordersRes.data as Order[],
    daily_debts,
    admin_logs: logsRes.data as AdminLog[],
  };
};

export const loadStateFromBackup = async (data: AppDataBackup): Promise<{ success: boolean }> => {
  if (!data.users || !data.orders || data.daily_debts === undefined || !data.admin_logs) {
    throw new Error("Invalid backup file format.");
  }
  
  // Clear existing data (in a real scenario, you might want to be careful with this)
  await Promise.all([
    supabase.from('users').delete().neq('id', 0),
    supabase.from('orders').delete().neq('id', 0),
    supabase.from('daily_debts').delete().neq('id', ''),
    supabase.from('admin_logs').delete().neq('id', 0)
  ]);

  // Insert new data
  if (data.users.length > 0) await supabase.from('users').insert(data.users);
  if (data.orders.length > 0) await supabase.from('orders').insert(data.orders);
  
  const debtEntries = Object.entries(data.daily_debts).map(([id, status]) => ({ id, status }));
  if (debtEntries.length > 0) await supabase.from('daily_debts').insert(debtEntries);
  
  if (data.admin_logs.length > 0) await supabase.from('admin_logs').insert(data.admin_logs);

  return { success: true };
};