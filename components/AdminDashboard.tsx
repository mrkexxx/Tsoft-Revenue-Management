import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Order, Package, DailyDebt, DebtStatus, ActivationStatus, PaymentStatus, Role, AdminLog } from '../types';
import * as api from '../services/api';
import AgentManagementModal from './AgentManagementModal';
import DebtDetailModal from './DebtDetailModal';
import { formatCurrency, exportToJSON } from '../utils';
import { format, isAfter, isBefore, startOfMonth, subMonths, isWithinInterval, getDate, setDate, parseISO, startOfDay, formatISO } from 'date-fns';

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
    
    // Filter states for debt tab
    const [debtAgentFilter, setDebtAgentFilter] = useState('all');
    const [debtStatusFilter, setDebtStatusFilter] = useState('all');
    
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
            if (order.actual_revenue !== undefined) {
                return sum + order.actual_revenue;
            }
            const agent = agents.find(a => a.id === order.agentId);
            const discount = agent?.discountPercentage || 0;
            return sum + (order.price * (1 - discount / 100));
        }, 0);

        // Revenue comparison
        const now = new Date();
        const startOfThisMonth = startOfMonth(now);
        const startOfLastMonth = startOfMonth(subMonths(now, 1));
        // Use the same day of the month for comparison
        const endOfLastMonthPeriod = setDate(startOfLastMonth, getDate(now));
        
        const thisMonthRevenue = orders
            .filter(o => isWithinInterval(parseISO(o.sold_at), { start: startOfThisMonth, end: now }))
            .reduce((sum, o) => sum + o.price, 0);

        const lastMonthRevenue = orders
            .filter(o => isWithinInterval(parseISO(o.sold_at), { start: startOfLastMonth, end: endOfLastMonthPeriod }))
            .reduce((sum, o) => sum + o.price, 0);

        let percentageChange = 0;
        let trend: 'increase' | 'decrease' | 'flat' | 'new' = 'flat';

        if (lastMonthRevenue > 0) {
            percentageChange = ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
            if (percentageChange > 0) trend = 'increase';
            else if (percentageChange < 0) trend = 'decrease';
        } else if (thisMonthRevenue > 0) {
            trend = 'new'; // No data last month to compare, but there is data now
            percentageChange = 100; // Represent as 100% increase from 0
        }

        return {
            totalGrossRevenue,
            totalNetRevenue,
            totalOrders,
            revenueComparison: {
                percentageChange,
                trend
            }
        };
    }, [orders, agents]);

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const agentMatch = orderAgentFilter === 'all' || order.agentId === parseInt(orderAgentFilter, 10);
            
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

            return agentMatch && dateMatch;
        });
    }, [orders, orderAgentFilter, startDateFilter, endDateFilter]);
        
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
    };
    
    const handleAddOrder = async (newOrderData: Omit<Order, 'id'>) => {
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
    
    const renderOrdersTab = () => (
        <div className="p-6 overflow-x-auto bg-slate-800 rounded-lg shadow-lg">
             <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-slate-100">Tất cả Đơn hàng ({filteredOrders.length})</h2>
                <button onClick={() => setIsAddOrderModalOpen(true)} className="px-5 py-2 text-lg font-semibold text-white transition-colors duration-200 rounded-md bg-primary hover:bg-primary-focus">+ Thêm đơn hàng</button>
             </div>
             
             {/* FILTERS */}
             <div className="grid grid-cols-1 gap-4 p-4 mb-6 md:grid-cols-2 lg:grid-cols-4 bg-slate-700/50 rounded-lg">
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
                        <th className="p-3 text-lg font-semibold tracking-wide">Trạng thái K.hoạt</th>
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
                                <td className="p-3"><span className={`px-2 py-1 text-sm font-semibold rounded-full ${order.status === ActivationStatus.Activated ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{order.status}</span></td>
                                <td className="p-3"><span className={`px-2 py-1 text-sm font-semibold rounded-full ${order.paymentStatus === PaymentStatus.Paid ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>{order.paymentStatus}</span></td>
                                <td className="p-3"><button onClick={() => handleOpenEditModal(order)} className="px-4 py-1 font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700">Sửa</button></td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            {filteredOrders.length === 0 && <p className="mt-4 text-center text-slate-400">Không có đơn hàng nào khớp.</p>}
        </div>
    );
    
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

    const renderComparison = () => {
        const { percentageChange, trend } = globalStats.revenueComparison;
        const isPositive = trend === 'increase' || trend === 'new';
        const color = isPositive ? 'text-green-400' : trend === 'decrease' ? 'text-red-400' : 'text-slate-400';
        const icon = isPositive ? '↑' : '↓';

        if (trend === 'new') {
             return <p className={`text-3xl font-bold ${color}`}>Có doanh thu</p>
        }
        if (trend === 'flat' && percentageChange === 0) {
            return <p className={`text-3xl font-bold ${color}`}>Không đổi</p>
        }

        return (
            <div className={`flex items-baseline gap-2 ${color}`}>
                <p className="text-4xl font-bold">{icon} {Math.abs(percentageChange).toFixed(1)}%</p>
            </div>
        )
    };


    return (
        <div className="container p-4 mx-auto md:p-8">
            <header className="flex flex-col items-start justify-between gap-4 mb-8 md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                     <h1 className="text-5xl font-extrabold text-white">Admin Dashboard</h1>
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
                        <h4 className="text-lg text-slate-400">So với tháng trước (cùng kỳ)</h4>
                        {renderComparison()}
                    </div>
                </div>
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
    const [accountName, setAccountName] = useState('');
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
        if (!agentId || !packageId || !accountName) {
            alert('Vui lòng điền đầy đủ thông tin bắt buộc.');
            return;
        }
        setIsSubmitting(true);
        onSave({
            account_name: accountName,
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
                        <input type="text" placeholder="Tên khách hàng" value={accountName} onChange={e => setAccountName(e.target.value)} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md" />
                        <input type="email" placeholder="Email khách hàng" value={accountEmail} onChange={e => setAccountEmail(e.target.value)} className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md" />
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
    onDelete: (orderId: number) => void;
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
    
    const handleDelete = () => {
        onDelete(order.id);
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
                            <label className="block mb-1 text-slate-400">Trạng thái kích hoạt</label>
                            <select name="status" value={formData.status} onChange={handleInputChange} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md appearance-none">
                                <option value={ActivationStatus.Activated}>{ActivationStatus.Activated}</option>
                                <option value={ActivationStatus.NotActivated}>{ActivationStatus.NotActivated}</option>
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
                        <button type="button" onClick={handleDelete} disabled={isSubmitting} className="px-6 py-3 text-lg font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">Xoá</button>
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