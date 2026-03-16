import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageCheck, Truck, ClipboardList, XCircle } from 'lucide-react';
import { shopService } from '../services/api';
import '../styles/global.css';

const Orders = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updateInfo, setUpdateInfo] = useState(null);
    const [updateError, setUpdateError] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await shopService.listOrders(statusFilter ? { status: statusFilter } : {});
            setOrders(res.data || []);
        } catch (err) {
            setOrders([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [statusFilter]);

    const handleCancelOrder = async (orderId) => {
        await shopService.cancelOrder(orderId);
        fetchOrders();
    };

    const handleAddToPantry = async (orderId) => {
        try {
            const res = await shopService.confirmAddToPantry(orderId, true);
            setUpdateInfo({
                orderId,
                applied: res.data?.applied || [],
                skipped: res.data?.skipped || [],
            });
            setUpdateError('');
            sessionStorage.setItem('pantry_refresh', Date.now().toString());
            window.dispatchEvent(new Event('pantry_refresh'));
            fetchOrders();
        } catch (err) {
            setUpdateInfo(null);
            setUpdateError(err.response?.data?.error || 'Failed to update pantry.');
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Orders</h1>
                    <p style={styles.subtitle}>Track delivery and add items to your pantry.</p>
                </div>
                <div style={styles.headerActions}>
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
                    </select>
                    <button style={styles.refreshBtn} onClick={fetchOrders}>
                        Refresh
                    </button>
                </div>
            </div>
            {updateError && <div style={styles.errorBanner}>{updateError}</div>}

            {loading ? (
                <div style={styles.loading}>Loading orders...</div>
            ) : orders.length === 0 ? (
                <div style={styles.empty}>
                    <ClipboardList size={48} />
                    <p>No orders yet.</p>
                    <button style={styles.primaryBtn} onClick={() => navigate('/customer/shop')}>
                        Shop Now
                    </button>
                </div>
            ) : (
                <div style={styles.grid}>
                    {orders.map((order, index) => (
                        <div
                            key={order.id}
                            style={{ ...styles.card, animationDelay: `${index * 0.05}s` }}
                            className="fade-up hover-float"
                        >
                            <div style={styles.cardHeader}>
                                <div>
                                    <h3>Order #{order.id}</h3>
                                    <p style={styles.cardMeta}>{order.status}</p>
                                </div>
                                <strong>${Number(order.total_amount).toFixed(2)}</strong>
                            </div>

                            <div style={styles.items}>
                                {(order.items || []).slice(0, 3).map((item) => (
                                    <div key={item.id} style={styles.itemRow}>
                                        <span>{item.product?.name}</span>
                                        <span>x{item.quantity}</span>
                                    </div>
                                ))}
                                {(order.items || []).length > 3 && (
                                    <div style={styles.more}>+{order.items.length - 3} more</div>
                                )}
                            </div>

                            <div style={styles.actions}>
                                {(order.status === 'PLACED' || order.status === 'CONFIRMED') && (
                                    <button style={styles.cancelBtn} onClick={() => handleCancelOrder(order.id)}>
                                        <XCircle size={16} /> Cancel Order
                                    </button>
                                )}
                                {order.status === 'DELIVERED' && order.needs_pantry_confirm && (
                                    <button style={styles.actionBtn} onClick={() => handleAddToPantry(order.id)}>
                                        <PackageCheck size={16} /> Add To Pantry
                                    </button>
                                )}
                                {order.status === 'COMPLETED' && (
                                    <div style={styles.completed}>Completed</div>
                                )}
                            </div>
                            {updateInfo && updateInfo.orderId === order.id && (
                                <div style={styles.pantryResult}>
                                    <strong>Pantry update</strong>
                                    <div style={styles.pantryLine}>
                                        Applied: {updateInfo.applied.length > 0
                                            ? updateInfo.applied.map((a) => `${a.ingredient} (+${a.added} ${a.unit})`).join(', ')
                                            : 'None'}
                                    </div>
                                    <div style={styles.pantryLine}>
                                        Skipped: {updateInfo.skipped.length > 0
                                            ? updateInfo.skipped.map((s) => `${s.product || s.ingredient || 'Item'} (${s.reason})`).join(', ')
                                            : 'None'}
                                    </div>
                                    <button style={styles.linkBtn} onClick={() => navigate('/customer/inventory')}>
                                        View Pantry
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const styles = {
    page: { maxWidth: '1100px', margin: '0 auto', padding: '2rem' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' },
    headerActions: { display: 'flex', alignItems: 'center', gap: '0.8rem' },
    title: { fontSize: '2.2rem', color: 'var(--color-text)' },
    subtitle: { color: 'var(--color-text-light)' },
    refreshBtn: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', padding: '8px 14px', borderRadius: '999px', cursor: 'pointer' },
    filterSelect: { padding: '8px 12px', borderRadius: '999px', border: '1px solid var(--color-border)', background: '#fff' },
    errorBanner: { background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '10px 14px', borderRadius: '10px', marginBottom: '1rem', border: '1px solid rgba(239,68,68,0.2)' },
    loading: { textAlign: 'center', color: 'var(--color-text-light)', padding: '3rem' },
    empty: { textAlign: 'center', padding: '3rem', background: 'var(--color-surface)', borderRadius: '16px', border: '1px dashed var(--color-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' },
    primaryBtn: { background: 'var(--color-primary)', color: '#ffffff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' },
    card: { background: 'var(--color-surface)', borderRadius: '16px', padding: '1.2rem', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' },
    cardMeta: { color: 'var(--color-text-light)' },
    items: { display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' },
    itemRow: { display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-light)' },
    more: { color: 'var(--color-text-light)', fontSize: '0.85rem' },
    actions: { display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' },
    actionBtn: { background: 'var(--color-primary)', color: '#ffffff', border: 'none', padding: '8px 12px', borderRadius: '10px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' },
    cancelBtn: { background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '8px 12px', borderRadius: '10px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' },
    completed: { color: 'var(--color-text)', fontWeight: '700' },
    pantryResult: { marginTop: '1rem', background: 'var(--color-surface-2)', borderRadius: '12px', padding: '0.8rem', border: '1px solid var(--color-border)' },
    pantryLine: { color: 'var(--color-text-light)', fontSize: '0.85rem', marginTop: '0.4rem' },
    linkBtn: { marginTop: '0.6rem', background: 'transparent', border: '1px solid var(--color-border)', padding: '6px 10px', borderRadius: '999px', cursor: 'pointer', color: 'var(--color-text)' },
};

export default Orders;
