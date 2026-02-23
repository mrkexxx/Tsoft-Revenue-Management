import React from 'react';
import { User, Role } from '../types';
import AdminDashboard from './AdminDashboard';
import AgentDashboard from './AgentDashboard';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  return (
    <div>
      {user.role === Role.Admin ? (
        <AdminDashboard user={user} onLogout={onLogout} />
      ) : (
        <AgentDashboard user={user} onLogout={onLogout} />
      )}
    </div>
  );
};

export default Dashboard;
