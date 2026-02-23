import React from 'react';
import { DailyDebt, Order, Package, User } from '../types';
import { formatCurrency } from '../utils';
// Fix: Import 'parseISO' from its submodule to resolve export error.
import { format, parseISO } from 'date-fns';

interface DebtDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  debt: DailyDebt;
  agent: User | null;
  orders: Order[];
  packages: Package[];
}

const DebtDetailModal: React.FC<DebtDetailModalProps> = ({ isOpen, onClose, debt, agent, orders, packages }) => {
  if (!isOpen) return null;

  const getPackageName = (packageId: number) => packages.find(p => p.id === packageId)?.name || 'N/A';
  const discountPercentage = agent?.discountPercentage || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={onClose}>
      <div className="w-full max-w-4xl p-8 space-y-6 bg-slate-800 rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-4 border-b border-slate-600">
            <div>
                <h2 className="text-4xl font-bold text-white">Chi tiết Đối soát</h2>
                <p className="text-xl text-slate-400">Đại lý: <span className="font-semibold text-primary">{agent?.name}</span> - Ngày: <span className="font-semibold text-primary">{format(parseISO(debt.date), 'dd/MM/yyyy')}</span></p>
            </div>
            <button onClick={onClose} className="p-2 text-3xl text-slate-400 hover:text-white">&times;</button>
        </div>

        <div className="grid grid-cols-1 gap-4 text-lg md:grid-cols-3">
            <div className="p-4 rounded-md bg-slate-700">
                <p className="text-slate-400">Doanh thu (Gross)</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(debt.totalGrossRevenue)}</p>
            </div>
            <div className="p-4 rounded-md bg-slate-700">
                <p className="text-slate-400">Chiết khấu ({discountPercentage}%)</p>
                <p className="text-2xl font-bold text-yellow-400">{formatCurrency(debt.totalGrossRevenue - debt.totalNetRevenue)}</p>
            </div>
            <div className="p-4 rounded-md bg-slate-700">
                <p className="text-slate-400">Phải thu (Net)</p>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(debt.totalNetRevenue)}</p>
            </div>
        </div>

        <div className="overflow-y-auto max-h-96">
            <h3 className="mb-4 text-2xl font-semibold text-slate-100">Danh sách đơn hàng</h3>
             <table className="w-full text-left table-auto">
                <thead>
                    <tr className="border-b border-slate-700 bg-slate-700/50">
                        <th className="p-3 font-semibold tracking-wide">Tài khoản</th>
                        <th className="p-3 font-semibold tracking-wide">Gói</th>
                        <th className="p-3 font-semibold tracking-wide">Giá bán</th>
                        <th className="p-3 font-semibold tracking-wide">Phải thu</th>
                        <th className="p-3 font-semibold tracking-wide">Thanh toán</th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map(order => {
                        const netRevenue = order.price * (1 - discountPercentage / 100);
                        return (
                             <tr key={order.id} className="border-b border-slate-700">
                                <td className="p-3">
                                    <p className="font-bold">{order.account_name}</p>
                                    <p className="text-sm text-slate-400">{order.account_email}</p>
                                </td>
                                <td className="p-3">{getPackageName(order.packageId)}</td>
                                <td className="p-3">{formatCurrency(order.price)}</td>
                                <td className="p-3 font-semibold text-yellow-400">{formatCurrency(netRevenue)}</td>
                                <td className="p-3">{order.paymentStatus}</td>
                            </tr>
                        )
                    })}
                </tbody>
             </table>
             {orders.length === 0 && <p className="mt-4 text-center text-slate-400">Không có đơn hàng nào trong ngày này.</p>}
        </div>
        
        <div className="flex justify-end pt-4">
            <button onClick={onClose} className="px-6 py-3 text-lg font-semibold text-white transition-colors duration-200 bg-slate-600 rounded-md hover:bg-slate-500">Đóng</button>
        </div>
      </div>
    </div>
  );
};

export default DebtDetailModal;
