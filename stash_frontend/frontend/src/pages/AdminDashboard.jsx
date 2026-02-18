import React, { useEffect, useState } from 'react';
import { Users, Store, Activity, Truck, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { adminService } from '../services/api';

const AdminDashboard = () => {
    const [orders, setOrders] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [users, setUsers] = useState([]);

    const fetchAdminData = async () => {
        setLoading(true);
        setError('');
        try {
            const [summaryRes, ordersRes, usersRes] = await Promise.all([
                adminService.getSummary(),
                adminService.listOrders(statusFilter ? { status: statusFilter } : {}),
                adminService.listUsers(),
            ]);
            setSummary(summaryRes.data);
            setOrders(ordersRes.data || []);
            setUsers(usersRes.data || []);
        } catch (err) {
            console.error(err);
            setError('Failed to load admin data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdminData();
    }, [statusFilter]);

    const handleUpdateStatus = async (orderId, status) => {
        setLoading(true);
        try {
            await adminService.updateOrderStatus(orderId, status);
            await fetchAdminData();
        } catch (err) {
            console.error(err);
            alert('Failed to update status');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <h1 style={styles.title}>System Admin</h1>
                <div style={styles.badgeWarning}>
                    <AlertTriangle size={16} /> Backend Connected (Actions Enabled)
                </div>
            </header>

            {error && <div style={styles.errorBanner}>{error}</div>}

            <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                    <div style={styles.statIcon}><Users size={24} /></div>
                    <div>
                        <h3>Total Users</h3>
                        <p style={styles.statValue}>{summary?.total_users ?? '-'}</p>
                    </div>
                </div>
                <div style={styles.statCard}>
                    <div style={styles.statIcon}><Store size={24} /></div>
                    <div>
                        <h3>Active Shops</h3>
                        <p style={styles.statValue}>{summary?.shop_owners ?? '-'}</p>
                    </div>
                </div>
                <div style={styles.statCard}>
                    <div style={styles.statIcon}><Activity size={24} /></div>
                    <div>
                        <h3>System Status</h3>
                        <p style={styles.statValue}>{summary ? 'Online' : '-'}</p>
                    </div>
                </div>
            </div>

            <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Order Monitoring</h2>
                <div style={styles.filterRow}>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={styles.filterSelect}
                    >
                        <option value="">All Status</option>
                        <option value="PLACED">Placed</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="OUT_FOR_DELIVERY">Out for delivery</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                        <option value="REFUNDED">Refunded</option>
                    </select>
                </div>
                <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Order ID</th>
                                <th style={styles.th}>Customer</th>
                                <th style={styles.th}>Date</th>
                                <th style={styles.th}>Total</th>
                                <th style={styles.th}>Status</th>
                                <th style={styles.th}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.id}>
                                    <td style={styles.td}>#{order.id}</td>
                                    <td style={styles.td}>{order.user_email || order.user?.email || '--'}</td>
                                    <td style={styles.td}>{order.created_at?.slice(0, 10) || '--'}</td>
                                    <td style={styles.td}>${Number(order.total_amount || 0).toFixed(2)}</td>
                                    <td style={styles.td}>
                                        <span style={{
                                            ...styles.badge,
                                            background: order.status === 'DELIVERED' ? 'rgba(17,17,17,0.08)' : 'rgba(225,29,46,0.12)',
                                            color: order.status === 'DELIVERED' ? 'var(--color-text)' : 'var(--color-primary)',
                                        }}>
                                            {order.status === 'DELIVERED' ? <CheckCircle size={14} /> : <Clock size={14} />}
                                            {order.status}
                                        </span>
                                    </td>
                                    <td style={styles.td}>
                                        <div style={styles.rowActions}>
                                            <select
                                                style={styles.rowSelect}
                                                defaultValue={order.status}
                                                onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                                                disabled={loading}
                                            >
                                                <option value="PLACED">Placed</option>
                                                <option value="CONFIRMED">Confirmed</option>
                                                <option value="OUT_FOR_DELIVERY">Out for delivery</option>
                                                <option value="DELIVERED">Delivered</option>
                                                <option value="COMPLETED">Completed</option>
                                                <option value="CANCELLED">Cancelled</option>
                                                <option value="REFUNDED">Refunded</option>
                                            </select>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section style={styles.section}>
                <h2 style={styles.sectionTitle}>User Management</h2>
                <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Name</th>
                                <th style={styles.th}>Email</th>
                                <th style={styles.th}>Role</th>
                                <th style={styles.th}>Location</th>
                                <th style={styles.th}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td style={styles.td}>{u.name || '--'}</td>
                                    <td style={styles.td}>{u.email}</td>
                                    <td style={styles.td}>{u.role}</td>
                                    <td style={styles.td}>{u.location || '--'}</td>
                                    <td style={styles.td}>{u.is_active ? 'Active' : 'Inactive'}</td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td style={styles.td} colSpan={5}>No users found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

// Reusing styles
const styles = {
    page: { padding: '2rem', maxWidth: '1200px', margin: '0 auto' },
    header: { marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: '2rem', color: 'var(--color-text)' },
    badgeWarning: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(225,29,46,0.12)', color: 'var(--color-accent)', borderRadius: '50px', fontSize: '0.9rem', fontWeight: '500', border: '1px solid rgba(225,29,46,0.2)' },
    errorBanner: { background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '10px 14px', borderRadius: '10px', marginBottom: '1rem', border: '1px solid rgba(239,68,68,0.2)' },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '3rem',
    },
    statCard: {
        background: 'var(--color-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)',
        display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--color-border)'
    },
    statIcon: {
        background: 'rgba(225,29,46,0.12)', padding: '1rem', borderRadius: '50%', color: 'var(--color-primary)',
    },
    statValue: { fontSize: '1.5rem', fontWeight: 'bold' },
    tableWrapper: {
        overflowX: 'auto', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)'
    },
    filterRow: { display: 'flex', justifyContent: 'flex-end', marginBottom: '0.8rem' },
    filterSelect: { padding: '8px 12px', borderRadius: '999px', border: '1px solid var(--color-border)', background: '#fff' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '600px' },
    th: {
        textAlign: 'left', padding: '1rem', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-light)', fontSize: '0.9rem',
    },
    td: { padding: '1rem', borderBottom: '1px solid var(--color-border)' },
    badge: {
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '4px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '500',
    },
    btnSm: {
        fontSize: '0.85rem', padding: '8px 14px', background: 'var(--color-primary)', color: '#fff', borderRadius: '999px', border: 'none', cursor: 'pointer',
    }
    ,
    rowActions: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
    rowSelect: { padding: '6px 10px', borderRadius: '999px', border: '1px solid var(--color-border)', background: '#fff', fontSize: '0.85rem' },
};

export default AdminDashboard;
