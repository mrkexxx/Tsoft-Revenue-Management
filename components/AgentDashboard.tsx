import React, { useState, useEffect, useMemo } from 'react';
import { User, Order, Package, ActivationStatus, PaymentStatus } from '../types';
import * as api from '../services/api';
import { formatCurrency, exportToCSV } from '../utils';
// Fix: Import 'formatISO' to generate an ISO string for the current date.
import { format, isThisMonth, formatISO, parseISO } from 'date-fns';

interface AgentDashboardProps {
  user: User;
  onLogout: () => void;
}

const AgentDashboard: React.FC<AgentDashboardProps> = ({ user, onLogout }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Filters
  const [packageFilter, setPackageFilter] = useState('all');
  const [activationFilter, setActivationFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  // Form state
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState<number | ''>('');
  
  const fetchAgentData = async () => {
    try {
      const [ordersData, packagesData] = await Promise.all([
        api.getOrders(user),
        api.getPackages(),
      ]);
      setOrders(ordersData);
      setPackages(packagesData);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } 
  };
  
  useEffect(() => {
    const initialLoad = async () => {
      setIsLoading(true);
      await fetchAgentData();
      setIsLoading(false);
    }
    initialLoad();
  }, [user]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Fix: Ensure packageFilter is parsed as an integer for comparison with number type order.packageId.
      const packageMatch = packageFilter === 'all' || order.packageId === parseInt(packageFilter, 10);
      const activationMatch = activationFilter === 'all' || order.status === activationFilter;
      const paymentMatch = paymentFilter === 'all' || order.paymentStatus === paymentFilter;
      return packageMatch && activationMatch && paymentMatch;
    });
  }, [orders, packageFilter, activationFilter, paymentFilter]);

  const agentCommission = user.discountPercentage || 0;

  const stats = useMemo(() => {
    const monthlyOrders = orders.filter(o => isThisMonth(parseISO(o.sold_at)));

    const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + order.price, 0);

    const monthlyCommissionReceived = monthlyOrders
        .filter(o => o.paymentStatus === PaymentStatus.Paid)
        .reduce((sum, order) => sum + order.price, 0) * (agentCommission / 100);

    return { monthlyRevenue, monthlyCommissionReceived };
  }, [orders, agentCommission]);
  
  const resetForm = () => {
    setAccountName('');
    setAccountEmail('');
    setSelectedPackageId('');
    setShowForm(false);
    setIsSubmitting(false);
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackageId || !accountName) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }
    setIsSubmitting(true);
    
    const selectedPackage = packages.find(p => p.id === selectedPackageId);
    if (!selectedPackage) return;

    const finalPrice = selectedPackage.price;

    // Fix: Changed type to Omit<Order, 'id'> and added the required 'sold_at' property.
    const newOrderData: Omit<Order, 'id'> = {
      account_name: accountName,
      account_email: accountEmail,
      packageId: selectedPackageId,
      price: finalPrice,
      status: ActivationStatus.NotActivated, // Default status
      paymentStatus: PaymentStatus.Unpaid, // Default status
      agentId: user.id,
      sold_at: formatISO(new Date()),
    };

    try {
      await api.addOrder(newOrderData);
      await fetchAgentData(); // Refresh data
      resetForm();
    } catch (error) {
      console.error('Failed to add order:', error);
      alert('Không thể thêm đơn hàng. Vui lòng thử lại.');
      setIsSubmitting(false);
    }
  };
  
  const handleExport = () => {
    const discount = user.discountPercentage || 0;
    const dataToExport = filteredOrders.map(o => ({
      id: o.id, 
      account_name: o.account_name, 
      account_email: o.account_email,
      packageName: packages.find(p => p.id === o.packageId)?.name || 'N/A',
      price: o.price, 
      netRevenue: o.price * (1 - discount / 100),
      status: o.status, 
      paymentStatus: o.paymentStatus,
      sold_at: format(parseISO(o.sold_at), 'dd/MM/yyyy HH:mm'),
    }));
    const headers = { id: 'ID', account_name: 'Tên tài khoản', account_email: 'Email', packageName: 'Gói', price: 'Giá', netRevenue: 'Phải thu', status: 'Trạng thái', paymentStatus: 'Thanh toán', sold_at: 'Ngày bán' };
    exportToCSV(dataToExport, headers, `tsoft_revenue_${user.username}_orders`);
  };

  const getPackageName = (packageId: number) => packages.find(p => p.id === packageId)?.name || 'N/A';

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-xl">Đang tải dữ liệu...</div>;
  }
  
  return (
    <div className="container p-4 mx-auto md:p-8">
      <header className="flex flex-col items-start justify-between gap-4 mb-8 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
            <div className="p-2 rounded-md bg-slate-700">
              <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
                <h1 className="text-5xl font-extrabold text-white">Chào mừng, {user.name}!</h1>
                <p className="text-xl text-slate-400">Đây là trang tổng quan bán hàng của bạn.</p>
            </div>
        </div>
        <button onClick={onLogout} className="px-6 py-3 text-lg font-semibold text-white transition-colors duration-200 bg-red-600 rounded-lg shadow-md hover:bg-red-700">Đăng xuất</button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-2">
        <div className="p-6 rounded-lg bg-slate-800 shadow-lg">
            <h4 className="text-lg text-slate-400">Doanh thu Tháng này</h4>
            <p className="text-5xl font-bold text-primary">{formatCurrency(stats.monthlyRevenue)}</p>
        </div>
        <div className="p-6 rounded-lg bg-slate-800 shadow-lg">
            <h4 className="text-lg text-slate-400">Hoa hồng Tháng này (đã nhận)</h4>
            <p className="text-5xl font-bold text-green-400">{formatCurrency(stats.monthlyCommissionReceived)}</p>
        </div>
      </div>
      
      {/* Add Order Form Toggle */}
      <div className="mb-8">
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="w-full px-6 py-4 text-xl font-bold text-white rounded-lg shadow-lg bg-primary hover:bg-primary-focus">
            + Thêm đơn hàng mới
          </button>
        )}
        
        {showForm && (
          <form onSubmit={handleAddOrder} className="p-8 space-y-6 bg-slate-800 rounded-lg shadow-lg">
             <h2 className="text-3xl font-bold text-slate-100">Tạo đơn hàng mới</h2>
             <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <input type="text" placeholder="Tên tài khoản khách hàng" value={accountName} onChange={e => setAccountName(e.target.value)} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md focus:ring-primary-focus focus:border-primary-focus" />
                <input type="email" placeholder="Email khách hàng (nếu có)" value={accountEmail} onChange={e => setAccountEmail(e.target.value)} className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md focus:ring-primary-focus focus:border-primary-focus" />
                <select value={selectedPackageId} onChange={e => setSelectedPackageId(Number(e.target.value))} required className="w-full px-4 py-3 text-lg md:col-span-2 bg-slate-700 text-white border border-slate-600 rounded-md appearance-none focus:ring-primary-focus focus:border-primary-focus">
                  <option value="" disabled>-- Chọn gói --</option>
                  {packages.map(p => <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.price)})</option>)}
                </select>
             </div>
             <div className="flex justify-end gap-4 pt-2">
               <button type="button" onClick={resetForm} disabled={isSubmitting} className="px-6 py-3 text-lg font-semibold text-white transition-colors duration-200 bg-slate-600 rounded-md hover:bg-slate-500">Huỷ</button>
               <button type="submit" disabled={isSubmitting} className="px-6 py-3 text-lg font-semibold text-white transition-colors duration-200 rounded-md bg-primary hover:bg-primary-focus disabled:bg-slate-500 disabled:cursor-not-allowed">
                 {isSubmitting ? 'Đang lưu...' : 'Lưu đơn hàng'}
               </button>
             </div>
          </form>
        )}
      </div>

      {/* Orders Table */}
      <div className="p-6 mt-12 overflow-x-auto bg-slate-800 rounded-lg shadow-lg">
        <div className="flex flex-col items-start justify-between gap-4 mb-6 md:flex-row md:items-center">
            <h2 className="text-3xl font-bold text-slate-100">Lịch sử đơn hàng</h2>
            <div className="flex flex-col items-stretch w-full gap-4 md:w-auto md:flex-row">
              <select value={packageFilter} onChange={e => setPackageFilter(e.target.value)} className="px-4 py-2 text-lg bg-slate-700 text-white border border-slate-600 rounded-md appearance-none focus:ring-primary-focus focus:border-primary-focus">
                  <option value="all">Tất cả gói</option>
                  {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={activationFilter} onChange={e => setActivationFilter(e.target.value)} className="px-4 py-2 text-lg bg-slate-700 text-white border border-slate-600 rounded-md appearance-none focus:ring-primary-focus focus:border-primary-focus">
                  <option value="all">Mọi trạng thái</option>
                  <option value={ActivationStatus.Activated}>{ActivationStatus.Activated}</option>
                  <option value={ActivationStatus.NotActivated}>{ActivationStatus.NotActivated}</option>
              </select>
              <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="px-4 py-2 text-lg bg-slate-700 text-white border border-slate-600 rounded-md appearance-none focus:ring-primary-focus focus:border-primary-focus">
                  <option value="all">Mọi thanh toán</option>
                  <option value={PaymentStatus.Paid}>{PaymentStatus.Paid}</option>
                  <option value={PaymentStatus.Unpaid}>{PaymentStatus.Unpaid}</option>
              </select>
              <button onClick={handleExport} className="px-5 py-2 text-lg font-semibold text-white transition-colors duration-200 rounded-md bg-primary hover:bg-primary-focus">Xuất CSV</button>
            </div>
        </div>
        <table className="w-full text-left table-auto">
          <thead>
            <tr className="border-b border-slate-700"><th className="p-3 text-lg font-semibold tracking-wide">Tài khoản</th><th className="p-3 text-lg font-semibold tracking-wide">Gói</th><th className="p-3 text-lg font-semibold tracking-wide">Giá</th><th className="p-3 text-lg font-semibold tracking-wide">Phải thu</th><th className="p-3 text-lg font-semibold tracking-wide">Ngày bán</th><th className="p-3 text-lg font-semibold tracking-wide">Trạng thái</th><th className="p-3 text-lg font-semibold tracking-wide">Thanh toán</th></tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => {
              const netRevenue = order.price * (1 - (user.discountPercentage || 0) / 100);
              return (
              <tr key={order.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                <td className="p-3"><p className="font-bold text-lg">{order.account_name}</p><p className="text-sm text-slate-400">{order.account_email}</p></td>
                <td className="p-3 text-lg">{getPackageName(order.packageId)}</td>
                <td className="p-3 text-lg">{formatCurrency(order.price)}</td>
                <td className="p-3 text-lg font-semibold text-yellow-400">{formatCurrency(netRevenue)}</td>
                <td className="p-3 text-lg">{format(parseISO(order.sold_at), 'dd/MM/yyyy')}</td>
                <td className="p-3"><span className={`px-2 py-1 text-sm font-semibold rounded-full ${order.status === ActivationStatus.Activated ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{order.status}</span></td>
                <td className="p-3"><span className={`px-2 py-1 text-sm font-semibold rounded-full ${order.paymentStatus === PaymentStatus.Paid ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>{order.paymentStatus}</span></td>
              </tr>
            )})}
          </tbody>
        </table>
        {filteredOrders.length === 0 && <p className="mt-4 text-center text-slate-400">Không có đơn hàng nào khớp với bộ lọc.</p>}
      </div>
    </div>
  );
};

export default AgentDashboard;