import React, { useState } from 'react';
import { Users, Store, Activity, Truck, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { adminService } from '../services/api';

const AdminDashboard = () => {
    // Mock data for listing (since backend has no list-orders endpoint)
    // In a real scenario with full backend control, we'd fetch this from /api/shop/orders/
    const [orders, setOrders] = useState([
        { id: 1, displayId: 'ORD-7829', customer: 'Alice', status: 'PLACED', total: 45.50, date: '2023-10-25' },
        { id: 2, displayId: 'ORD-7830', customer: 'Bob', status: 'DELIVERED', total: 22.00, date: '2023-10-24' },
        { id: 3, displayId: 'ORD-7831', customer: 'Charlie', status: 'PLACED', total: 115.00, date: '2023-10-25' },
    ]);
    const [loading, setLoading] = useState(false);

    const handleMarkDelivered = async (orderId, internalId) => {
        setLoading(true);
        try {
            // Call real backend API
            // Note: This will fail if the simulated ID (1, 2, 3) doesn't exist in the real backend DB.
            // For demonstration, we assume valid IDs or just show the UI update on success/mock.

            // In a fully integrated flow: 
            // 1. Customer places order -> gets real ID.
            // 2. Admin sees real ID.
            // 3. Admin clicks delivered -> calls API with real ID.

            // Tying it together: We'll try to call the API. If it fails (404), we'll alert but still update UI for the demo.
            try {
                await adminService.markDelivered(internalId);
                alert('Order status updated in backend!');
            } catch (err) {
                console.warn("Backend update failed (likely due to mock ID):", err);
                alert('Backend update failed (Mock ID used?), but updating UI for demo.');
            }

            setOrders(orders.map(o =>
                o.id === internalId ? { ...o, status: 'DELIVERED' } : o
            ));

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

            <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                    <div style={styles.statIcon}><Users size={24} /></div>
                    <div>
                        <h3>Total Users</h3>
                        <p style={styles.statValue}>1,205</p>
                    </div>
                </div>
                <div style={styles.statCard}>
                    <div style={styles.statIcon}><Store size={24} /></div>
                    <div>
                        <h3>Active Shops</h3>
                        <p style={styles.statValue}>84</p>
                    </div>
                </div>
                <div style={styles.statCard}>
                    <div style={styles.statIcon}><Activity size={24} /></div>
                    <div>
                        <h3>System Status</h3>
                        <p style={styles.statValue}>Online</p>
                    </div>
                </div>
            </div>

            <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Order Monitoring</h2>
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
                                    <td style={styles.td}>{order.displayId}</td>
                                    <td style={styles.td}>{order.customer}</td>
                                    <td style={styles.td}>{order.date}</td>
                                    <td style={styles.td}>${order.total.toFixed(2)}</td>
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
                                        {order.status !== 'DELIVERED' && (
                                            <button
                                                style={styles.btnSm}
                                                onClick={() => handleMarkDelivered(order.displayId, order.id)}
                                                disabled={loading}
                                            >
                                                Mark Delivered
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
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
};

export default AdminDashboard;
