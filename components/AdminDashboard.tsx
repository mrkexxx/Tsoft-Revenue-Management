import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Order, Package, DailyDebt, DebtStatus, ActivationStatus, PaymentStatus, Role, AdminLog } from '../types';
import * as api from '../services/api';
import AgentManagementModal from './AgentManagementModal';
import DebtDetailModal from './DebtDetailModal';
import RevenueChart from './RevenueChart';
import { formatCurrency, exportToJSON, exportToCSV } from '../utils';
import { format, isAfter, isBefore, subMonths, isWithinInterval, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, formatISO } from 'date-fns';
import { vi } from 'date-fns/locale';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
    // Main data state
    const [orders, setOrders] = useState<Order[]>([]);
    const [agents, setAgents] = useState<User[]>([]);
    const [packages, setPackages] = useState<Package[]>([]);
    const [dailyDebts, setDailyDebts] = useState<DailyDebt[]>([]);
    const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'agents', 'debt', 'logs'
    
    // Modal states
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [agentToEdit, setAgentToEdit] = useState<User | null>(null);
    const [isDebtDetailModalOpen, setIsDebtDetailModalOpen] = useState(false);
    const [selectedDebt, setSelectedDebt] = useState<DailyDebt | null>(null);
    const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
    const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
    const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);


    // Filter states for orders tab
    const [orderAgentFilter, setOrderAgentFilter] = useState('all');
    const [startDateFilter, setStartDateFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('');
    const [orderEmailFilter, setOrderEmailFilter] = useState('');
    
    // Filter states for debt tab
    const [debtAgentFilter, setDebtAgentFilter] = useState('all');
    const [debtStatusFilter, setDebtStatusFilter] = useState('all');
    
    const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'year'>('week');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [ordersData, usersData, packagesData, debtsData, logsData] = await Promise.all([
                api.getOrders(user),
                api.getUsers(),
                api.getPackages(),
                api.getDailyDebts(user),
                api.getAdminLogs(),
            ]);
            setOrders(ordersData);
            setAgents(usersData.filter(u => u.role === Role.Agent));
            setPackages(packagesData);
            setDailyDebts(debtsData);
            setAdminLogs(logsData);
        } catch (error) {
            console.error("Failed to fetch admin data", error);
            alert("Không thể tải dữ liệu. Vui lòng thử lại.");
        } finally {
            setIsLoading(false);
        }
    };
  
    useEffect(() => {
        fetchData();
    }, [user]);

    // --- Memos for calculations and filtering ---
    const globalStats = useMemo(() => {
        const totalGrossRevenue = orders.reduce((sum, order) => sum + order.price, 0);
        const totalOrders = orders.length;

        const totalNetRevenue = orders.reduce((sum, order) => {
            if (order.actual_revenue != null) {
                return sum + order.actual_revenue;
            }
            const agent = agents.find(a => a.id === order.agentId);
            const discount = agent?.discountPercentage || 0;
            return sum + (order.price * (1 - discount / 100));
        }, 0);

        // Revenue comparison
        const now = new Date();
        const startOfTodayDate = startOfDay(now);
        const endOfTodayDate = endOfDay(now);
        
        const startOfThisWeekDate = startOfWeek(now, { weekStartsOn: 1 });
        const endOfThisWeekDate = endOfWeek(now, { weekStartsOn: 1 });
        
        const todayRevenue = orders
            .filter(o => isWithinInterval(parseISO(o.sold_at), { start: startOfTodayDate, end: endOfTodayDate }))
            .reduce((sum, o) => sum + o.price, 0);

        const thisWeekRevenue = orders
            .filter(o => isWithinInterval(parseISO(o.sold_at), { start: startOfThisWeekDate, end: endOfThisWeekDate }))
            .reduce((sum, o) => sum + o.price, 0);

        return {
            totalGrossRevenue,
            totalNetRevenue,
            totalOrders,
            todayRevenue,
            thisWeekRevenue
        };
    }, [orders, agents]);

    const chartData = useMemo(() => {
        const data = [];
        const now = new Date();

        if (chartPeriod === 'week') {
            for (let i = 6; i >= 0; i--) {
                const date = startOfDay(now);
                date.setDate(date.getDate() - i);
                const dateStr = format(date, 'dd/MM');
                
                const dailyOrders = orders.filter(o => format(parseISO(o.sold_at), 'dd/MM') === dateStr);
                const dailyGross = dailyOrders.reduce((sum, o) => sum + o.price, 0);
                const dailyNet = dailyOrders.reduce((sum, order) => {
                    if (order.actual_revenue != null) {
                        return sum + order.actual_revenue;
                    }
                    const agent = agents.find(a => a.id === order.agentId);
                    const discount = agent?.discountPercentage || 0;
                    return sum + (order.price * (1 - discount / 100));
                }, 0);
                
                data.push({
                    date: dateStr,
                    revenue: dailyGross,
                    netRevenue: dailyNet
                });
            }
        } else if (chartPeriod === 'month') {
            for (let i = 29; i >= 0; i--) {
                const date = startOfDay(now);
                date.setDate(date.getDate() - i);
                const dateStr = format(date, 'dd/MM');
                
                const dailyOrders = orders.filter(o => format(parseISO(o.sold_at), 'dd/MM') === dateStr);
                const dailyGross = dailyOrders.reduce((sum, o) => sum + o.price, 0);
                const dailyNet = dailyOrders.reduce((sum, order) => {
                    if (order.actual_revenue != null) {
                        return sum + order.actual_revenue;
                    }
                    const agent = agents.find(a => a.id === order.agentId);
                    const discount = agent?.discountPercentage || 0;
                    return sum + (order.price * (1 - discount / 100));
                }, 0);
                
                data.push({
                    date: dateStr,
                    revenue: dailyGross,
                    netRevenue: dailyNet
                });
            }
        } else if (chartPeriod === 'year') {
            for (let i = 11; i >= 0; i--) {
                const date = subMonths(now, i);
                const monthStr = format(date, 'MM/yyyy');
                
                const monthlyOrders = orders.filter(o => format(parseISO(o.sold_at), 'MM/yyyy') === monthStr);
                const monthlyGross = monthlyOrders.reduce((sum, o) => sum + o.price, 0);
                const monthlyNet = monthlyOrders.reduce((sum, order) => {
                    if (order.actual_revenue != null) {
                        return sum + order.actual_revenue;
                    }
                    const agent = agents.find(a => a.id === order.agentId);
                    const discount = agent?.discountPercentage || 0;
                    return sum + (order.price * (1 - discount / 100));
                }, 0);
                
                data.push({
                    date: monthStr,
                    revenue: monthlyGross,
                    netRevenue: monthlyNet
                });
            }
        }

        return data;
    }, [orders, agents, chartPeriod]);

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const agentMatch = orderAgentFilter === 'all' || order.agentId === parseInt(orderAgentFilter, 10);
            const emailMatch = !orderEmailFilter || order.account_email?.toLowerCase().includes(orderEmailFilter.toLowerCase());
            
            const dateMatch = (() => {
                if (!startDateFilter && !endDateFilter) return true;
                const orderDate = startOfDay(parseISO(order.sold_at));
                if (startDateFilter && isBefore(orderDate, startOfDay(parseISO(startDateFilter)))) {
                    return false;
                }
                if (endDateFilter && isAfter(orderDate, startOfDay(parseISO(endDateFilter)))) {
                    return false;
                }
                return true;
            })();

            return agentMatch && dateMatch && emailMatch;
        });
    }, [orders, orderAgentFilter, startDateFilter, endDateFilter, orderEmailFilter]);
        
    const filteredDebts = useMemo(() => {
        return dailyDebts.filter(debt => {
            const agentMatch = debtAgentFilter === 'all' || debt.agentId === parseInt(debtAgentFilter, 10);
            const statusMatch = debtStatusFilter === 'all' || debt.status === debtStatusFilter;
            return agentMatch && statusMatch;
        });
    }, [dailyDebts, debtAgentFilter, debtStatusFilter]);

    // --- Helper functions ---
    const getAgentName = (agentId: number) => agents.find(a => a.id === agentId)?.name || 'N/A';
    const getPackageName = (packageId: number) => packages.find(p => p.id === packageId)?.name || 'N/A';

    // --- Event Handlers ---
    const handleOpenAgentModal = (agent: User | null) => {
        setAgentToEdit(agent);
        setIsAgentModalOpen(true);
    };

    const handleSaveAgent = () => {
        setIsAgentModalOpen(false);
        setAgentToEdit(null);
        fetchData(); // Refresh all data, including logs
    };
    
    const handleDebtStatusChange = async (debtId: string, newStatus: DebtStatus) => {
        try {
            await api.updateDebtStatus(debtId, newStatus);
            const debt = dailyDebts.find(d => d.id === debtId);
            await api.logAction(user.id, user.name, `Cập nhật đối soát cho ${getAgentName(debt?.agentId || 0)} ngày ${format(parseISO(debt?.date || ''), 'dd/MM/yyyy')} thành '${newStatus}'.`);
            await fetchData(); 
        } catch (error) {
            console.error("Failed to update debt status", error);
            alert("Cập nhật trạng thái công nợ thất bại.");
        }
    };
    
    const handleOpenDebtDetailModal = (debt: DailyDebt) => {
        setSelectedDebt(debt);
        setIsDebtDetailModalOpen(true);
    }
    
    const handleClearOrderFilters = () => {
        setOrderAgentFilter('all');
        setStartDateFilter('');
        setEndDateFilter('');
        setOrderEmailFilter('');
    };
    
    const handleAddOrder = async (newOrderData: Omit<Order, 'id'>) => {
        // Check for duplicate email on the same day
        const today = new Date();
        const isDuplicate = orders.some(order => {
            if (!order.account_email) return false;
            const orderDate = parseISO(order.sold_at);
            return order.account_email.toLowerCase() === newOrderData.account_email?.toLowerCase() && 
                   orderDate.getDate() === today.getDate() &&
                   orderDate.getMonth() === today.getMonth() &&
                   orderDate.getFullYear() === today.getFullYear();
        });

        if (isDuplicate) {
            alert('Đơn hàng với email này đã tồn tại trong ngày hôm nay. Không thể thêm mới.');
            return;
        }

        try {
            const newOrder = await api.addOrder(newOrderData);
            await api.logAction(user.id, user.name, `Tạo mới đơn hàng #${newOrder.id} (${formatCurrency(newOrder.price)}) cho đại lý '${getAgentName(newOrder.agentId)}'.`);
            await fetchData();
            setIsAddOrderModalOpen(false);
        } catch (error) {
            console.error('Failed to add order:', error);
            alert('Không thể thêm đơn hàng. Vui lòng thử lại.');
        }
    };
    
    const handleOpenEditModal = (order: Order) => {
        setOrderToEdit(order);
        setIsEditOrderModalOpen(true);
    };

    const handleUpdateOrder = async (updatedOrder: Order) => {
        try {
            await api.updateOrder(updatedOrder);
            await api.logAction(user.id, user.name, `Cập nhật đơn hàng #${updatedOrder.id}.`);
            await fetchData();
            setIsEditOrderModalOpen(false);
            setOrderToEdit(null);
        } catch (error) {
            console.error('Failed to update order:', error);
            alert('Không thể cập nhật đơn hàng.');
        }
    };
    
    const handleToggleActivation = async (order: Order) => {
        const newStatus = order.status === ActivationStatus.Activated ? ActivationStatus.NotActivated : ActivationStatus.Activated;
        try {
            await api.updateOrder({ ...order, status: newStatus });
            await api.logAction(user.id, user.name, `Cập nhật trạng thái đơn hàng #${order.id} thành '${newStatus}'.`);
            await fetchData();
        } catch (error) {
            console.error('Failed to update order status:', error);
            alert('Không thể cập nhật trạng thái đơn hàng.');
        }
    };
    
    const handleDeleteOrder = async (orderId: number) => {
        if (window.confirm("Bạn có chắc chắn muốn xoá đơn hàng này không?")) {
            try {
                await api.deleteOrder(orderId);
                await api.logAction(user.id, user.name, `Xoá đơn hàng #${orderId}.`);
                await fetchData();
                setIsEditOrderModalOpen(false);
                setOrderToEdit(null);
            } catch (error) {
                console.error('Failed to delete order:', error);
                alert('Không thể xoá đơn hàng.');
            }
        }
    };

    // --- Import/Export Handlers ---
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') {
                    throw new Error("File could not be read.");
                }
                const data = JSON.parse(text);
                if (window.confirm("Bạn có chắc muốn import dữ liệu không? Hành động này sẽ ghi đè toàn bộ dữ liệu hiện tại.")) {
                    await api.loadStateFromBackup(data);
                    await api.logAction(user.id, user.name, "Import dữ liệu mới từ file backup.");
                    alert("Dữ liệu đã được import thành công!");
                    await fetchData();
                }
            } catch (error) {
                console.error("Failed to import data:", error);
                alert("Import dữ liệu thất bại. File có thể bị lỗi hoặc không đúng định dạng.");
            } finally {
                if(fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        reader.readAsText(file);
    };

    const handleExportData = async () => {
        try {
            const appState = await api.getAppStateForBackup();
            const date = new Date().toISOString().split('T')[0];
            exportToJSON(appState, `tsoft-backup-${date}`);
        } catch (error) {
            console.error("Failed to export data:", error);
            alert("Export dữ liệu thất bại.");
        }
    };
    
    // --- Render Functions ---
    if (isLoading) {
        return <div className="flex items-center justify-center h-screen text-xl">Đang tải dữ liệu...</div>;
    }
    
    const handleExportOrders = () => {
        const dataToExport = filteredOrders.map((order, index) => {
            const agent = agents.find(a => a.id === order.agentId);
            const discount = agent?.discountPercentage || 0;
            const calculatedNetRevenue = order.price * (1 - discount / 100);
            const actualRevenue = order.actual_revenue ?? calculatedNetRevenue;
            
            return {
                stt: index + 1,
                account: `${order.account_name}\n${order.account_email || ''}`,
                package: getPackageName(order.packageId),
                price: order.price,
                netRevenue: actualRevenue,
                notes: order.notes || '',
                agent: getAgentName(order.agentId),
                sold_at: format(parseISO(order.sold_at), 'dd/MM/yyyy'),
                status: order.status === ActivationStatus.Activated ? 'Approved' : 'Not Approved',
                paymentStatus: order.paymentStatus
            };
        });

        const headers = {
            stt: 'STT',
            account: 'Tài khoản',
            package: 'Gói',
            price: 'Giá',
            netRevenue: 'Số tiền thực thu',
            notes: 'Ghi chú',
            agent: 'Đại lý',
            sold_at: 'Ngày bán',
            status: 'Tình trạng approve',
            paymentStatus: 'Thanh toán'
        };

        exportToCSV(dataToExport, headers, `tsoft_all_orders_${format(new Date(), 'yyyyMMdd_HHmmss')}`);
    };

    const renderOrdersTab = () => {
        const filteredGrossRevenue = filteredOrders.reduce((sum, order) => sum + order.price, 0);
        const filteredNetRevenue = filteredOrders.reduce((sum, order) => {
            if (order.actual_revenue != null) {
                return sum + order.actual_revenue;
            }
            const agent = agents.find(a => a.id === order.agentId);
            const discount = agent?.discountPercentage || 0;
            return sum + (order.price * (1 - discount / 100));
        }, 0);
        const filteredDebt = filteredOrders.reduce((sum, order) => {
            if (order.paymentStatus === PaymentStatus.Unpaid) {
                if (order.actual_revenue != null) {
                    return sum + order.actual_revenue;
                }
                const agent = agents.find(a => a.id === order.agentId);
                const discount = agent?.discountPercentage || 0;
                return sum + (order.price * (1 - discount / 100));
            }
            return sum;
        }, 0);

        return (
        <div className="p-6 overflow-x-auto bg-slate-800 rounded-lg shadow-lg">
             <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-slate-100">Tất cả Đơn hàng ({filteredOrders.length})</h2>
                <div className="flex gap-4">
                    <button onClick={handleExportOrders} className="px-5 py-2 text-lg font-semibold text-white transition-colors duration-200 bg-green-600 rounded-md hover:bg-green-700">Xuất Excel</button>
                    <button onClick={() => setIsAddOrderModalOpen(true)} className="px-5 py-2 text-lg font-semibold text-white transition-colors duration-200 rounded-md bg-primary hover:bg-primary-focus">+ Thêm đơn hàng</button>
                </div>
             </div>
             
             {/* FILTERS */}
             <div className="grid grid-cols-1 gap-4 p-4 mb-6 md:grid-cols-2 lg:grid-cols-5 bg-slate-700/50 rounded-lg">
                <input 
                    type="text" 
                    placeholder="Tìm theo email khách hàng..." 
                    value={orderEmailFilter} 
                    onChange={e => setOrderEmailFilter(e.target.value)} 
                    className="w-full px-4 py-2 text-lg bg-slate-700 text-white border border-slate-600 rounded-md focus:ring-primary-focus focus:border-primary-focus"
                />
                <select value={orderAgentFilter} onChange={e => setOrderAgentFilter(e.target.value)} className="px-4 py-2 text-lg bg-slate-700 text-white border border-slate-600 rounded-md appearance-none focus:ring-primary-focus focus:border-primary-focus">
                    <option value="all">Lọc theo đại lý</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <div className="flex items-center gap-2">
                    <label htmlFor="startDate" className="text-slate-400">Từ:</label>
                    <input id="startDate" type="date" value={startDateFilter} onChange={e => setStartDateFilter(e.target.value)} className="w-full px-4 py-2 text-lg bg-slate-700 text-white border border-slate-600 rounded-md focus:ring-primary-focus focus:border-primary-focus"/>
                </div>
                <div className="flex items-center gap-2">
                     <label htmlFor="endDate" className="text-slate-400">Đến:</label>
                    <input id="endDate" type="date" value={endDateFilter} onChange={e => setEndDateFilter(e.target.value)} className="w-full px-4 py-2 text-lg bg-slate-700 text-white border border-slate-600 rounded-md focus:ring-primary-focus focus:border-primary-focus"/>
                </div>
                 <button onClick={handleClearOrderFilters} className="px-4 py-2 text-lg font-semibold text-white bg-slate-600 rounded-md hover:bg-slate-500">Xoá bộ lọc</button>
             </div>

             {/* FILTER SUMMARY */}
             <div className="flex gap-8 mb-6 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                 <div>
                     <p className="text-sm text-slate-400 uppercase tracking-wider">Tổng doanh thu (Gross)</p>
                     <p className="text-2xl font-bold text-primary">{formatCurrency(filteredGrossRevenue)}</p>
                 </div>
                 <div>
                     <p className="text-sm text-slate-400 uppercase tracking-wider">Tổng số tiền thực thu (Net)</p>
                     <p className="text-2xl font-bold text-green-400">{formatCurrency(filteredNetRevenue)}</p>
                 </div>
                 <div>
                     <p className="text-sm text-slate-400 uppercase tracking-wider">Công nợ</p>
                     <p className="text-2xl font-bold text-red-400">{formatCurrency(filteredDebt)}</p>
                 </div>
             </div>

            <table className="w-full text-left table-auto">
                <thead>
                    <tr className="border-b border-slate-700">
                        <th className="p-3 text-lg font-semibold tracking-wide">STT</th>
                        <th className="p-3 text-lg font-semibold tracking-wide">Tài khoản</th>
                        <th className="p-3 text-lg font-semibold tracking-wide">Gói</th>
                        <th className="p-3 text-lg font-semibold tracking-wide">Giá</th>
                        <th className="p-3 text-lg font-semibold tracking-wide">Số tiền thực thu</th>
                        <th className="p-3 text-lg font-semibold tracking-wide">Ghi chú</th>
                        <th className="p-3 text-lg font-semibold tracking-wide">Đại lý</th>
                        <th className="p-3 text-lg font-semibold tracking-wide">Ngày bán</th>
                        <th className="p-3 text-lg font-semibold tracking-wide">Tình trạng approve</th>
                        <th className="p-3 text-lg font-semibold tracking-wide">Thanh toán</th>
                        <th className="p-3 text-lg font-semibold tracking-wide">Hành động</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredOrders.map((order, index) => {
                        const agent = agents.find(a => a.id === order.agentId);
                        const discount = agent?.discountPercentage || 0;
                        const calculatedNetRevenue = order.price * (1 - discount / 100);
                        const actualRevenue = order.actual_revenue ?? calculatedNetRevenue;
                        return (
                            <tr key={order.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                <td className="p-3 text-lg">{index + 1}</td>
                                <td className="p-3"><p className="font-bold text-lg">{order.account_name}</p><p className="text-sm text-slate-400">{order.account_email}</p></td>
                                <td className="p-3 text-lg">{getPackageName(order.packageId)}</td>
                                <td className="p-3 text-lg">{formatCurrency(order.price)}</td>
                                <td className="p-3 text-lg font-semibold text-yellow-400">{formatCurrency(actualRevenue)}</td>
                                <td className="p-3 text-lg text-slate-400 max-w-xs truncate" title={order.notes}>{order.notes}</td>
                                <td className="p-3 text-lg">{getAgentName(order.agentId)}</td>
                                <td className="p-3 text-lg">{format(parseISO(order.sold_at), 'dd/MM/yyyy')}</td>
                                <td className="p-3">
                                    <button 
                                        onClick={() => handleToggleActivation(order)}
                                        className={`px-2 py-1 text-sm font-semibold rounded-full cursor-pointer transition-colors ${order.status === ActivationStatus.Activated ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'}`}
                                    >
                                        {order.status === ActivationStatus.Activated ? 'Approved' : 'Not Approved'}
                                    </button>
                                </td>
                                <td className="p-3"><span className={`px-2 py-1 text-sm font-semibold rounded-full ${order.paymentStatus === PaymentStatus.Paid ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>{order.paymentStatus}</span></td>
                                <td className="p-3">
                                    <div className="flex gap-2">
                                        {order.status === ActivationStatus.NotActivated && (
                                            <button onClick={() => handleToggleActivation(order)} className="px-4 py-1 font-bold text-white bg-green-600 rounded-md hover:bg-green-700">Approve</button>
                                        )}
                                        <button onClick={() => handleOpenEditModal(order)} className="px-4 py-1 font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700">Sửa</button>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            {filteredOrders.length === 0 && <p className="mt-4 text-center text-slate-400">Không có đơn hàng nào khớp.</p>}
        </div>
    )};
    
    const renderAgentsTab = () => (
         <div className="p-6 bg-slate-800 rounded-lg shadow-lg">
             <div className="flex items-center justify-between mb-6">
                 <h2 className="text-3xl font-bold text-slate-100">Quản lý Đại lý ({agents.length})</h2>
                 <button onClick={() => handleOpenAgentModal(null)} className="px-5 py-2 text-lg font-semibold text-white transition-colors duration-200 rounded-md bg-primary hover:bg-primary-focus">+ Thêm Đại lý</button>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left table-auto">
                    <thead>
                        <tr className="border-b border-slate-700">
                            <th className="p-3 text-lg font-semibold tracking-wide">Tên</th>
                            <th className="p-3 text-lg font-semibold tracking-wide">Username</th>
                            <th className="p-3 text-lg font-semibold tracking-wide">Tổng Doanh thu</th>
                            <th className="p-3 text-lg font-semibold tracking-wide">Lợi nhuận phải trả</th>
                            <th className="p-3 text-lg font-semibold tracking-wide">Chiết khấu</th>
                            <th className="p-3 text-lg font-semibold tracking-wide">Trạng thái</th>
                            <th className="p-3 text-lg font-semibold tracking-wide">Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {agents.map(agent => {
                            const agentOrders = orders.filter(o => o.agentId === agent.id);
                            const totalGrossRevenue = agentOrders.reduce((sum, order) => sum + order.price, 0);
                            const commissionPayable = totalGrossRevenue * ((agent.discountPercentage || 0) / 100);
                            
                            return (
                                <tr key={agent.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                    <td className="p-3 text-lg font-bold">{agent.name}</td>
                                    <td className="p-3 text-lg text-slate-400">{agent.username}</td>
                                    <td className="p-3 text-lg text-primary">{formatCurrency(totalGrossRevenue)}</td>
                                    <td className="p-3 text-lg font-semibold text-green-400">{formatCurrency(commissionPayable)}</td>
                                    <td className="p-3 text-lg">{agent.discountPercentage || 0}%</td>
                                    <td className="p-3"><span className={`px-2 py-1 text-sm font-semibold rounded-full ${agent.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{agent.isActive ? 'Hoạt động' : 'Đã khoá'}</span></td>
                                    <td className="p-3"><button onClick={() => handleOpenAgentModal(agent)} className="px-4 py-1 font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700">Sửa</button></td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
         </div>
    );

    const renderDebtTab = () => (
        <div className="p-6 overflow-x-auto bg-slate-800 rounded-lg shadow-lg">
            <div className="flex flex-col items-start justify-between gap-4 mb-6 md:flex-row md:items-center">
                <h2 className="text-3xl font-bold text-slate-100">Đối soát Công nợ ({filteredDebts.length})</h2>
                <div className="flex flex-col items-stretch w-full gap-4 md:w-auto md:flex-row">
                    <select value={debtAgentFilter} onChange={e => setDebtAgentFilter(e.target.value)} className="px-4 py-2 text-lg bg-slate-700 text-white border border-slate-600 rounded-md appearance-none focus:ring-primary-focus focus:border-primary-focus">
                        <option value="all">Tất cả đại lý</option>
                        {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                     <select value={debtStatusFilter} onChange={e => setDebtStatusFilter(e.target.value)} className="px-4 py-2 text-lg bg-slate-700 text-white border border-slate-600 rounded-md appearance-none focus:ring-primary-focus focus:border-primary-focus">
                        <option value="all">Mọi trạng thái</option>
                        <option value={DebtStatus.Paid}>{DebtStatus.Paid}</option>
                        <option value={DebtStatus.Unpaid}>{DebtStatus.Unpaid}</option>
                    </select>
                </div>
            </div>
            <table className="w-full text-left table-auto">
                <thead>
                    <tr className="border-b border-slate-700"><th className="p-3 text-lg font-semibold tracking-wide">Ngày</th><th className="p-3 text-lg font-semibold tracking-wide">Đại lý</th><th className="p-3 text-lg font-semibold tracking-wide">Doanh thu Gross</th><th className="p-3 text-lg font-semibold tracking-wide">Phải thu Net</th><th className="p-3 text-lg font-semibold tracking-wide">Trạng thái</th><th className="p-3 text-lg font-semibold tracking-wide">Hành động</th></tr>
                </thead>
                <tbody>
                    {filteredDebts.map(debt => (
                        <tr key={debt.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                            <td className="p-3 text-lg">{format(parseISO(debt.date), 'dd/MM/yyyy')}</td>
                            <td className="p-3 text-lg font-bold cursor-pointer hover:text-primary" onClick={() => handleOpenDebtDetailModal(debt)}>{getAgentName(debt.agentId)}</td>
                            <td className="p-3 text-lg">{formatCurrency(debt.totalGrossRevenue)}</td>
                            <td className="p-3 text-lg font-semibold text-yellow-400">{formatCurrency(debt.totalNetRevenue)}</td>
                            <td className="p-3">
                                <span className={`px-3 py-1 text-sm font-bold rounded-full ${debt.status === DebtStatus.Paid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {debt.status}
                                </span>
                            </td>
                            <td className="p-3">
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handleDebtStatusChange(debt.id, debt.status === DebtStatus.Paid ? DebtStatus.Unpaid : DebtStatus.Paid)}
                                        className={`px-4 py-1 font-bold text-white rounded-md ${debt.status === DebtStatus.Paid ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}
                                    >
                                        {debt.status === DebtStatus.Paid ? 'Hoàn tác' : 'Xác nhận TT'}
                                    </button>
                                    <button onClick={() => handleOpenDebtDetailModal(debt)} className="px-4 py-1 font-bold text-white bg-gray-600 rounded-md hover:bg-gray-500">Chi tiết</button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {filteredDebts.length === 0 && <p className="mt-4 text-center text-slate-400">Không có dữ liệu công nợ nào khớp.</p>}
        </div>
    );
    
    const renderLogsTab = () => (
         <div className="p-6 overflow-x-auto bg-slate-800 rounded-lg shadow-lg">
            <h2 className="mb-6 text-3xl font-bold text-slate-100">Nhật ký Admin ({adminLogs.length})</h2>
            <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-left table-auto">
                    <thead>
                        <tr className="border-b border-slate-700">
                            <th className="sticky top-0 p-3 text-lg font-semibold tracking-wide bg-slate-800">Thời gian</th>
                            <th className="sticky top-0 p-3 text-lg font-semibold tracking-wide bg-slate-800">Admin</th>
                            <th className="sticky top-0 p-3 text-lg font-semibold tracking-wide bg-slate-800">Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {adminLogs.map(log => (
                            <tr key={log.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                <td className="p-3 text-lg text-slate-400 whitespace-nowrap">{format(parseISO(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}</td>
                                <td className="p-3 text-lg font-bold">{log.adminName}</td>
                                <td className="p-3 text-lg">{log.description}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             {adminLogs.length === 0 && <p className="mt-4 text-center text-slate-400">Chưa có nhật ký nào được ghi lại.</p>}
        </div>
    );

    const activeTabClasses = "px-6 py-3 text-lg font-semibold text-white bg-slate-700 rounded-t-lg";
    const inactiveTabClasses = "px-6 py-3 text-lg font-semibold text-slate-400 hover:text-white";

    const renderRevenueSummary = () => {
        const { todayRevenue, thisWeekRevenue } = globalStats;

        return (
            <div className="flex flex-col gap-2">
                <div className="text-sm text-slate-400">
                    <p>Hôm nay: <span className="text-2xl font-bold text-green-400">{formatCurrency(todayRevenue)}</span></p>
                    <p className="mt-2">Tuần này: <span className="text-2xl font-bold text-blue-400">{formatCurrency(thisWeekRevenue)}</span></p>
                </div>
            </div>
        )
    };


    return (
        <div className="container p-4 mx-auto md:p-8">
            <header className="flex flex-col items-start justify-between gap-4 mb-8 md:flex-row md:items-center">
                <div className="flex flex-col gap-1">
                     <h1 className="text-5xl font-extrabold text-white">Admin Dashboard</h1>
                     <p className="text-xl text-slate-400 capitalize">{format(new Date(), "EEEE, 'ngày' dd 'tháng' MM 'năm' yyyy", { locale: vi })}</p>
                </div>
                 <div className="flex items-center gap-4">
                     <button onClick={handleExportData} className="px-4 py-2 text-lg font-semibold text-white transition-colors duration-200 bg-blue-600 rounded-lg shadow-md hover:bg-blue-700">Export Dữ liệu</button>
                     <button onClick={handleImportClick} className="px-4 py-2 text-lg font-semibold text-white transition-colors duration-200 bg-green-600 rounded-lg shadow-md hover:bg-green-700">Import Dữ liệu</button>
                     <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".json" />
                     <p className="text-xl text-slate-400">Chào, {user.name}!</p>
                    <button onClick={onLogout} className="px-6 py-3 text-lg font-semibold text-white transition-colors duration-200 bg-red-600 rounded-lg shadow-md hover:bg-red-700">Đăng xuất</button>
                 </div>
            </header>

            {/* Global Stats */}
            <div className="p-6 mb-8 rounded-lg bg-slate-800 shadow-lg">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                    <div className="p-6 rounded-lg bg-slate-700">
                        <h4 className="text-lg text-slate-400">Tổng Doanh thu (Gross)</h4>
                        <p className="text-5xl font-bold text-primary">{formatCurrency(globalStats.totalGrossRevenue)}</p>
                    </div>
                     <div className="p-6 rounded-lg bg-slate-700">
                        <h4 className="text-lg text-slate-400">Lợi nhuận thu về (Net)</h4>
                        <p className="text-5xl font-bold text-green-400">{formatCurrency(globalStats.totalNetRevenue)}</p>
                    </div>
                    <div className="p-6 rounded-lg bg-slate-700">
                        <h4 className="text-lg text-slate-400">Tổng số đơn hàng</h4>
                        <p className="text-5xl font-bold text-blue-400">{globalStats.totalOrders}</p>
                    </div>
                    <div className="p-6 rounded-lg bg-slate-700">
                        <h4 className="text-lg text-slate-400">Doanh thu gần đây</h4>
                        {renderRevenueSummary()}
                    </div>
                </div>
            </div>

            <div className="mb-8 p-6 bg-slate-800 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-100">
                        {chartPeriod === 'week' ? 'Biểu đồ doanh số 7 ngày gần nhất' : 
                         chartPeriod === 'month' ? 'Biểu đồ doanh số 30 ngày gần nhất' : 
                         'Biểu đồ doanh số 12 tháng gần nhất'}
                    </h3>
                    <select 
                        value={chartPeriod} 
                        onChange={e => setChartPeriod(e.target.value as 'week' | 'month' | 'year')}
                        className="px-4 py-2 text-lg bg-slate-700 text-white border border-slate-600 rounded-md appearance-none focus:ring-primary-focus focus:border-primary-focus"
                    >
                        <option value="week">Theo tuần</option>
                        <option value="month">Theo tháng</option>
                        <option value="year">Theo năm</option>
                    </select>
                </div>
                <RevenueChart data={chartData} title="" />
            </div>

            <div className="flex mb-0 border-b-2 border-slate-700">
                <button onClick={() => setActiveTab('orders')} className={activeTab === 'orders' ? activeTabClasses : inactiveTabClasses}>Đơn hàng</button>
                <button onClick={() => setActiveTab('agents')} className={activeTab === 'agents' ? activeTabClasses : inactiveTabClasses}>Đại lý</button>
                <button onClick={() => setActiveTab('debt')} className={activeTab === 'debt' ? activeTabClasses : inactiveTabClasses}>Đối soát</button>
                <button onClick={() => setActiveTab('logs')} className={activeTab === 'logs' ? activeTabClasses : inactiveTabClasses}>Nhật ký Admin</button>
            </div>

            <div className="pt-8">
                {activeTab === 'orders' && renderOrdersTab()}
                {activeTab === 'agents' && renderAgentsTab()}
                {activeTab === 'debt' && renderDebtTab()}
                {activeTab === 'logs' && renderLogsTab()}
            </div>
            
            {/* Modals */}
            <AgentManagementModal isOpen={isAgentModalOpen} onClose={() => setIsAgentModalOpen(false)} onSave={handleSaveAgent} agentToEdit={agentToEdit} adminUser={user} />
            {isAddOrderModalOpen && <AddOrderModal agents={agents} packages={packages} onClose={() => setIsAddOrderModalOpen(false)} onSave={handleAddOrder} />}
            {isEditOrderModalOpen && orderToEdit && (
                <EditOrderModal 
                    order={orderToEdit}
                    agents={agents}
                    packages={packages}
                    onClose={() => setIsEditOrderModalOpen(false)}
                    onUpdate={handleUpdateOrder}
                    onDelete={handleDeleteOrder}
                />
            )}
            {selectedDebt && (
                <DebtDetailModal 
                    isOpen={isDebtDetailModalOpen} 
                    onClose={() => setIsDebtDetailModalOpen(false)} 
                    debt={selectedDebt}
                    agent={agents.find(a => a.id === selectedDebt.agentId) || null}
                    orders={orders.filter(o => o.agentId === selectedDebt.agentId && format(startOfDay(parseISO(o.sold_at)), 'yyyy-MM-dd') === selectedDebt.date)}
                    packages={packages}
                />
            )}
        </div>
    );
};

// --- Add Order Modal Component ---
interface AddOrderModalProps {
    agents: User[];
    packages: Package[];
    onClose: () => void;
    onSave: (orderData: Omit<Order, 'id'>) => void;
}

const AddOrderModal: React.FC<AddOrderModalProps> = ({ agents, packages, onClose, onSave }) => {
    const [agentId, setAgentId] = useState<number | ''>('');
    const [packageId, setPackageId] = useState<number | ''>('');
    const [accountEmail, setAccountEmail] = useState('');
    const [price, setPrice] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [soldAt, setSoldAt] = useState(() => format(new Date(), 'yyyy-MM-dd'));
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const selectedPackage = packages.find(p => p.id === packageId);
        if (selectedPackage) {
            setPrice(selectedPackage.price);
        }
    }, [packageId, packages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!agentId || !packageId || !accountEmail) {
            alert('Vui lòng điền đầy đủ thông tin bắt buộc.');
            return;
        }
        setIsSubmitting(true);
        onSave({
            account_name: accountEmail.split('@')[0], // Use part of email as name since it's required by type
            account_email: accountEmail,
            packageId: Number(packageId),
            price: Number(price),
            agentId: Number(agentId),
            status: ActivationStatus.NotActivated, // Default
            paymentStatus: PaymentStatus.Unpaid, // Default
            notes: notes,
            sold_at: soldAt ? formatISO(startOfDay(parseISO(soldAt))) : formatISO(new Date()),
        });
        // The parent will handle closing and error display
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={onClose}>
            <div className="w-full max-w-lg p-8 space-y-6 bg-slate-800 rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-4xl font-bold text-center text-white">Thêm đơn hàng mới</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <select value={agentId} onChange={e => setAgentId(Number(e.target.value))} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md appearance-none focus:ring-primary-focus focus:border-primary-focus md:col-span-2">
                            <option value="" disabled>-- Chọn đại lý --</option>
                            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <input type="email" placeholder="Email khách hàng" value={accountEmail} onChange={e => setAccountEmail(e.target.value)} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md md:col-span-2" />
                        <select value={packageId} onChange={e => setPackageId(Number(e.target.value))} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md appearance-none">
                            <option value="" disabled>-- Chọn gói --</option>
                            {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                         <input type="date" value={soldAt} onChange={e => setSoldAt(e.target.value)} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md" />
                        <input type="number" placeholder="Giá bán" value={price} onChange={e => setPrice(Number(e.target.value))} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md md:col-span-2" />
                    </div>
                    <textarea placeholder="Ghi chú" value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md" />
                    <div className="flex justify-end gap-4 !mt-8">
                        <button type="button" onClick={onClose} disabled={isSubmitting} className="px-6 py-3 text-lg font-semibold text-white bg-slate-600 rounded-md hover:bg-slate-500">Huỷ</button>
                        <button type="submit" disabled={isSubmitting} className="px-6 py-3 text-lg font-semibold text-white bg-primary rounded-md hover:bg-primary-focus">
                            {isSubmitting ? 'Đang lưu...' : 'Lưu'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Edit Order Modal Component ---
interface EditOrderModalProps {
    order: Order;
    agents: User[];
    packages: Package[];
    onClose: () => void;
    onUpdate: (orderData: Order) => void;
    onDelete: (orderId: number) => Promise<void>;
}

const EditOrderModal: React.FC<EditOrderModalProps> = ({ order, agents, packages, onClose, onUpdate, onDelete }) => {
    const [formData, setFormData] = useState<Order>(() => {
        const agent = agents.find(a => a.id === order.agentId);
        const discount = agent?.discountPercentage || 0;
        const calculatedNetRevenue = order.price * (1 - discount / 100);
        return {
            ...order,
            actual_revenue: order.actual_revenue ?? calculatedNetRevenue,
        };
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    useEffect(() => {
        const selectedPackage = packages.find(p => p.id === formData.packageId);
        if (selectedPackage && formData.price !== selectedPackage.price) {
            setFormData(prev => ({...prev, price: selectedPackage.price}));
        }
    }, [formData.packageId, packages]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: ['agentId', 'packageId', 'price', 'actual_revenue'].includes(name) ? Number(value) : value }));
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = startOfDay(parseISO(e.target.value));
        setFormData(prev => ({ ...prev, sold_at: formatISO(newDate) }));
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        onUpdate(formData);
        // Parent handles closing
    };
    
    const handleDelete = async () => {
        if (order.paymentStatus === PaymentStatus.Paid) {
            alert('Không thể xoá đơn hàng đã thanh toán.');
            return;
        }
        setIsSubmitting(true);
        await onDelete(order.id);
        setIsSubmitting(false);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={onClose}>
            <div className="w-full max-w-2xl p-8 space-y-4 bg-slate-800 rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-4xl font-bold text-center text-white">Chỉnh sửa Đơn hàng</h2>
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                         <div>
                            <label className="block mb-1 text-slate-400">Đại lý</label>
                            <select name="agentId" value={formData.agentId} onChange={handleInputChange} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md appearance-none focus:ring-primary-focus focus:border-primary-focus">
                                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1 text-slate-400">Gói</label>
                            <select name="packageId" value={formData.packageId} onChange={handleInputChange} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md appearance-none">
                                {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1 text-slate-400">Tên khách hàng</label>
                            <input type="text" name="account_name" value={formData.account_name} onChange={handleInputChange} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md" />
                        </div>
                        <div>
                             <label className="block mb-1 text-slate-400">Email khách hàng</label>
                            <input type="email" name="account_email" value={formData.account_email} onChange={handleInputChange} className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md" />
                        </div>
                         <div>
                            <label className="block mb-1 text-slate-400">Giá bán</label>
                            <input type="number" name="price" value={formData.price} onChange={handleInputChange} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md" />
                        </div>
                         <div>
                             <label className="block mb-1 text-slate-400">Ngày bán</label>
                            <input type="date" name="sold_at" value={format(parseISO(formData.sold_at), 'yyyy-MM-dd')} onChange={handleDateChange} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md" />
                        </div>
                        <div>
                            <label className="block mb-1 text-slate-400">Số tiền thực thu</label>
                            <input type="number" name="actual_revenue" value={formData.actual_revenue || ''} onChange={handleInputChange} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md" />
                        </div>
                        <div>
                            <label className="block mb-1 text-slate-400">Tình trạng approve</label>
                            <select name="status" value={formData.status} onChange={handleInputChange} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md appearance-none">
                                <option value={ActivationStatus.Activated}>Approved</option>
                                <option value={ActivationStatus.NotActivated}>Not Approved</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                             <label className="block mb-1 text-slate-400">Trạng thái thanh toán</label>
                            <select name="paymentStatus" value={formData.paymentStatus} onChange={handleInputChange} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md appearance-none">
                                <option value={PaymentStatus.Paid}>{PaymentStatus.Paid}</option>
                                <option value={PaymentStatus.Unpaid}>{PaymentStatus.Unpaid}</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                             <label className="block mb-1 text-slate-400">Ghi chú</label>
                            <textarea name="notes" placeholder="Ghi chú" value={formData.notes || ''} onChange={handleInputChange} className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md" />
                        </div>
                    </div>
                    <div className="flex justify-between gap-4 !mt-8">
                        {order.paymentStatus !== PaymentStatus.Paid ? (
                            <button type="button" onClick={handleDelete} disabled={isSubmitting} className="px-6 py-3 text-lg font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">Xoá</button>
                        ) : (
                            <div title="Không thể xoá đơn đã thanh toán">
                                <button type="button" disabled className="px-6 py-3 text-lg font-semibold text-white bg-red-600/50 rounded-md cursor-not-allowed">Xoá</button>
                            </div>
                        )}
                        <div className="flex gap-4">
                            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-6 py-3 text-lg font-semibold text-white bg-slate-600 rounded-md hover:bg-slate-500">Huỷ</button>
                            <button type="submit" disabled={isSubmitting} className="px-6 py-3 text-lg font-semibold text-white bg-primary rounded-md hover:bg-primary-focus">
                                {isSubmitting ? 'Đang lưu...' : 'Lưu'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};


export default AdminDashboard;