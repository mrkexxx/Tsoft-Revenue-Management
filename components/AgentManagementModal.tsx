import React, { useState, useEffect } from 'react';
import { User } from '../types';
import * as api from '../services/api';

interface AgentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  agentToEdit: User | null;
  adminUser: User;
}

const AgentManagementModal: React.FC<AgentManagementModalProps> = ({ isOpen, onClose, onSave, agentToEdit, adminUser }) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [discount, setDiscount] = useState(25);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const isEditMode = agentToEdit !== null;

  useEffect(() => {
    if (agentToEdit) {
      setName(agentToEdit.name);
      setUsername(agentToEdit.username);
      setDiscount(agentToEdit.discountPercentage || 0);
      setIsActive(agentToEdit.isActive || false);
      setPassword(''); // Don't pre-fill password for security
    } else {
      // Reset for new agent
      setName('');
      setUsername('');
      setPassword('');
      setDiscount(25); // Default discount
      setIsActive(true);
    }
    setError('');
  }, [agentToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username) {
        setError('Tên và Tên đăng nhập là bắt buộc.');
        return;
    }
    if (!isEditMode && !password) {
        setError('Mật khẩu là bắt buộc khi tạo mới.');
        return;
    }

    setIsSaving(true);
    setError('');

    try {
        if (isEditMode) {
            const updatedData: User = {
                ...agentToEdit,
                name,
                username,
                discountPercentage: discount,
                isActive,
            };
            // Only include password if it was changed
            if (password) {
                updatedData.password = password;
            }
            await api.updateAgent(updatedData);
            await api.logAction(adminUser.id, adminUser.name, `Cập nhật đại lý '${updatedData.name}'.`);
        } else {
            const newData: Omit<User, 'id' | 'role'> = {
                name,
                username,
                password,
                discountPercentage: discount,
                isActive,
            };
            const createdAgent = await api.createAgent(newData);
            await api.logAction(adminUser.id, adminUser.name, `Tạo mới đại lý '${createdAgent.name}'.`);

        }
        onSave();
    } catch (err) {
        setError('Đã xảy ra lỗi. Vui lòng thử lại.');
        console.error(err);
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!agentToEdit || !window.confirm(`Bạn có chắc chắn muốn xoá đại lý "${agentToEdit.name}" không? Hành động này không thể hoàn tác.`)) {
        return;
    }
    setIsSaving(true);
    try {
        await api.deleteAgent(agentToEdit.id);
        await api.logAction(adminUser.id, adminUser.name, `Xoá đại lý '${agentToEdit.name}'.`);
        onSave();
    } catch (err) {
        setError('Không thể xoá đại lý. Vui lòng thử lại.');
        console.error(err);
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={onClose}>
      <div className="w-full max-w-lg p-8 space-y-6 bg-slate-800 rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-4xl font-bold text-center text-white">{isEditMode ? 'Chỉnh sửa Đại lý' : 'Thêm mới Đại lý'}</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
            <input type="text" placeholder="Tên Đại lý" value={name} onChange={e => setName(e.target.value)} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md focus:ring-primary-focus focus:border-primary-focus" />
            <input type="text" placeholder="Tên đăng nhập" value={username} onChange={e => setUsername(e.target.value)} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md focus:ring-primary-focus focus:border-primary-focus" />
            <input type="password" placeholder={isEditMode ? "Nhập mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu"} value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md focus:ring-primary-focus focus:border-primary-focus" />
            <div className="flex items-center gap-4">
                <label htmlFor="discount" className="text-lg text-slate-300">Chiết khấu (%):</label>
                <input id="discount" type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} required className="w-full px-4 py-3 text-lg bg-slate-700 text-white border border-slate-600 rounded-md focus:ring-primary-focus focus:border-primary-focus" />
            </div>
             <div className="flex items-center justify-between p-4 bg-slate-700 rounded-md">
                <label className="text-lg text-slate-300">Trạng thái tài khoản</label>
                <div className="flex items-center gap-4">
                    <button type="button" onClick={() => setIsActive(true)} className={`px-4 py-2 text-sm font-bold rounded-md ${isActive ? 'bg-green-500 text-white' : 'bg-slate-600 text-slate-300'}`}>Hoạt động</button>
                    <button type="button" onClick={() => setIsActive(false)} className={`px-4 py-2 text-sm font-bold rounded-md ${!isActive ? 'bg-red-500 text-white' : 'bg-slate-600 text-slate-300'}`}>Khoá</button>
                </div>
            </div>

            {error && <p className="text-sm text-center text-red-400">{error}</p>}
            
            <div className="flex flex-col gap-4 !mt-8">
                <div className="flex justify-end w-full gap-4">
                    {isEditMode && <button type="button" onClick={handleDelete} disabled={isSaving} className="px-6 py-3 text-lg font-semibold text-white transition-colors duration-200 bg-red-600 rounded-md hover:bg-red-700 disabled:bg-slate-500">Xoá</button>}
                    <button type="button" onClick={onClose} disabled={isSaving} className="px-6 py-3 text-lg font-semibold text-white transition-colors duration-200 bg-slate-600 rounded-md hover:bg-slate-500">Huỷ</button>
                    <button type="submit" disabled={isSaving} className="px-6 py-3 text-lg font-semibold text-white transition-colors duration-200 rounded-md bg-primary hover:bg-primary-focus disabled:bg-slate-500">
                        {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </div>
            </div>
        </form>
      </div>
    </div>
  );
};

export default AgentManagementModal;