import React, { useEffect, useState } from 'react';
import { Users, Store, Activity, AlertTriangle } from 'lucide-react';
import { adminService } from '../services/api';
import '../styles/global.css';
import '../styles/admin.css';

const AdminDashboard = () => {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchAdminData = async () => {
        setLoading(true);
        setError('');
        try {
            const summaryRes = await adminService.getSummary();
            setSummary(summaryRes.data);
        } catch (err) {
            console.error(err);
            setError('Failed to load admin data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdminData();
    }, []);

    return (
        <div className="admin-page">
            <header className="admin-header">
                <h1 className="admin-title">System Admin</h1>
                <div className="admin-badge">
                    <AlertTriangle size={16} /> Backend Connected
                </div>
            </header>

            {error && <div className="admin-error">{error}</div>}

            <div className="admin-grid">
                <div className="admin-card">
                    <Users size={24} />
                    <div>
                        <h3>Total Users</h3>
                        <strong>{summary?.total_users ?? '-'}</strong>
                    </div>
                </div>
                <div className="admin-card">
                    <Store size={24} />
                    <div>
                        <h3>Active Shops</h3>
                        <strong>{summary?.shop_owners ?? '-'}</strong>
                    </div>
                </div>
                <div className="admin-card">
                    <Activity size={24} />
                    <div>
                        <h3>System Status</h3>
                        <strong>{summary ? 'Online' : '-'}</strong>
                    </div>
                </div>
                <div className="admin-card">
                    <Users size={24} />
                    <div>
                        <h3>Admins</h3>
                        <strong>{summary?.admins ?? '-'}</strong>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
