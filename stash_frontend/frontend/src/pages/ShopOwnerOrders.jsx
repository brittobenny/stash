import React, { useEffect, useState } from 'react';
import { ShoppingBag, Truck, CheckCircle, PackageCheck, Eye, Box } from 'lucide-react';
import { Link } from 'react-router-dom';
import { shopOwnerService } from '../services/api';
import { formatCurrency } from '../utils/currency';
import '../styles/global.css';

const ShopOwnerOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await shopOwnerService.listOrders(
                statusFilter ? { status: statusFilter } : {}
            );
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

    const updateStatus = async (orderId, status) => {
        await shopOwnerService.updateOrderStatus(orderId, status);
        fetchOrders();
    };

    return (
        <div style={styles.page}>
            <section style={styles.header}>
                <div>
                    <h1 style={styles.title}>Orders</h1>
                    <p style={styles.subtitle}>Track fulfillment and keep delivery on time.</p>
                </div>
                <div style={styles.filters}>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={styles.select}
                    >
                        <option value="">All Status</option>
                        <option value="PLACED">Placed</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="PACKED">Packed</option>
                        <option value="OUT_FOR_DELIVERY">Out for delivery</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                        <option value="REFUNDED">Refunded</option>
                    </select>
                </div>
            </section>
            {loading ? (
                <div style={styles.loading}>Loading orders...</div>
            ) : (
                <div style={styles.ordersGrid}>
                    {orders.map((order) => (
                        <div key={order.id} style={styles.orderCard}>
                            <div style={styles.orderHeader}>
                                <div>
                                    <h4>Order #{order.id}</h4>
                                    <span style={styles.orderSub}>{order.user_email || '--'}</span>
                                </div>
                                <span style={styles.orderStatus}>{order.status}</span>
                            </div>
                            <div style={styles.orderMeta}>
                                <div><ShoppingBag size={16} /> {formatCurrency(order.total_amount)}</div>
                                <div><Truck size={16} /> {order.created_at?.slice(0, 10) || '--'}</div>
                            </div>
                            <div style={styles.orderActions}>
                                <Link to={`/shop-owner/orders/${order.id}`} style={styles.viewBtn}>
                                    <Eye size={16} /> View
                                </Link>
                                {order.status === 'PLACED' && (
                                    <button style={styles.orderBtn} onClick={() => updateStatus(order.id, 'CONFIRMED')}>
                                        <PackageCheck size={16} /> Confirm
                                    </button>
                                )}
                                {order.status === 'CONFIRMED' && (
                                    <button style={styles.orderBtn} onClick={() => updateStatus(order.id, 'PACKED')}>
                                        <Box size={16} /> Pack
                                    </button>
                                )}
                                {order.status === 'PACKED' && (
                                    <button style={styles.orderBtn} onClick={() => updateStatus(order.id, 'OUT_FOR_DELIVERY')}>
                                        <Truck size={16} /> Dispatch
                                    </button>
                                )}
                                {order.status === 'OUT_FOR_DELIVERY' && (
                                    <button style={styles.orderBtn} onClick={() => updateStatus(order.id, 'DELIVERED')}>
                                        <CheckCircle size={16} /> Delivered
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {orders.length === 0 && (
                        <div style={styles.empty}>No orders to show.</div>
                    )}
                </div>
            )}
        </div>
    );
};

const styles = {
    page: {
        background: 'linear-gradient(180deg, #f9f5f0 0%, #ffffff 40%, #fdf9f6 100%)',
        padding: '2.5rem 2.5rem 4rem',
        minHeight: '100vh',
    },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' },
    title: { fontSize: '2.2rem', color: 'var(--color-text)' },
    subtitle: { color: 'var(--color-text-light)' },
    filters: { display: 'flex', gap: '0.6rem' },
    select: { padding: '8px 12px', borderRadius: '999px', border: '1px solid var(--color-border)', background: '#fff' },
    loading: { color: 'var(--color-text-light)', padding: '2rem' },
    ordersGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem' },
    orderCard: { background: '#fff', borderRadius: '18px', border: '1px solid var(--color-border)', padding: '1.2rem', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '1rem' },
    orderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    orderSub: { color: 'var(--color-text-light)', fontSize: '0.85rem' },
    orderStatus: { background: 'rgba(225,29,46,0.12)', color: 'var(--color-accent)', padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem' },
    orderMeta: { display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-light)', fontSize: '0.85rem' },
    orderActions: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' },
    orderBtn: { background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' },
    viewBtn: { background: 'transparent', border: '1px solid var(--color-border)', padding: '10px 14px', borderRadius: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: 'var(--color-text)' },
    empty: { gridColumn: '1/-1', textAlign: 'center', color: 'var(--color-text-light)' },
};

export default ShopOwnerOrders;
