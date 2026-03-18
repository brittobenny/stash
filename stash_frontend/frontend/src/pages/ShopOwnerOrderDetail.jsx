import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Package, RefreshCw, XCircle } from 'lucide-react';
import { shopOwnerService } from '../services/api';
import { formatCurrency } from '../utils/currency';
import '../styles/global.css';

const STATUS_FLOW = ['PLACED', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'];

const ShopOwnerOrderDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [reason, setReason] = useState('');

    const fetchOrder = async () => {
        setLoading(true);
        try {
            const res = await shopOwnerService.getOrderDetail(id);
            setOrder(res.data);
        } catch (err) {
            setOrder(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrder();
    }, [id]);

    const currentIndex = useMemo(
        () => STATUS_FLOW.indexOf(order?.status) ?? 0,
        [order]
    );

    const handleNextStatus = async () => {
        const next = STATUS_FLOW[currentIndex + 1];
        if (!next) return;
        await shopOwnerService.updateOrderStatus(order.id, next);
        fetchOrder();
    };

    const handleCancel = async () => {
        await shopOwnerService.cancelOrder(order.id, reason);
        setReason('');
        fetchOrder();
    };

    const handleRefund = async () => {
        await shopOwnerService.refundOrder(order.id, reason);
        setReason('');
        fetchOrder();
    };

    if (loading || !order) {
        return <div style={styles.loading}>Loading order...</div>;
    }

    return (
        <div style={styles.page}>
            <button style={styles.backBtn} onClick={() => navigate('/shop-owner/orders')}>
                <ArrowLeft size={16} /> Back to Orders
            </button>

            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Order #{order.id}</h1>
                    <p style={styles.subtitle}>Customer: {order.user_email || '--'}</p>
                </div>
                <span style={styles.statusPill}>{order.status}</span>
            </div>

            <section style={styles.infoGrid}>
                <div style={styles.infoCard}>
                    <h3>Delivery Details</h3>
                    <p>{order.user_address || 'No address provided'}</p>
                    <p style={styles.muted}>{order.user_location || 'Location not set'}</p>
                    <p style={styles.muted}>Phone: {order.user_phone || '--'}</p>
                </div>
                <div style={styles.infoCard}>
                    <h3>Payment</h3>
                    <p>Payment status: <strong>{order.payment_status}</strong></p>
                    <p>Total: {formatCurrency(order.total_amount)}</p>
                </div>
                <div style={styles.infoCard}>
                    <h3>Timeline</h3>
                    <p>Placed: {order.created_at?.slice(0, 10)}</p>
                    <p>Delivered: {order.delivered_at?.slice(0, 10) || '--'}</p>
                </div>
            </section>

            <section style={styles.flowCard}>
                <div style={styles.flowHeader}>
                    <h2>Status Flow</h2>
                    <button style={styles.refreshBtn} onClick={fetchOrder}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
                <div style={styles.flowRow}>
                    {STATUS_FLOW.map((status, idx) => (
                        <div key={status} style={styles.flowStep}>
                            <div style={idx <= currentIndex ? styles.flowDotActive : styles.flowDot} />
                            <span style={idx <= currentIndex ? styles.flowLabelActive : styles.flowLabel}>{status}</span>
                        </div>
                    ))}
                </div>
                {order.status !== 'DELIVERED' && order.status !== 'COMPLETED' && (
                    <button style={styles.primaryBtn} onClick={handleNextStatus}>
                        <CheckCircle size={16} /> Move to next stage
                    </button>
                )}
            </section>

            <section style={styles.itemsCard}>
                <h2>Items</h2>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Product</th>
                            <th style={styles.th}>Qty</th>
                            <th style={styles.th}>Price</th>
                            <th style={styles.th}>Pack</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((item) => (
                            <tr key={item.id}>
                                <td style={styles.td}>{item.product?.name}</td>
                                <td style={styles.td}>{item.quantity}</td>
                                <td style={styles.td}>{formatCurrency(item.price_each)}</td>
                                <td style={styles.td}>{item.pack_size} {item.pack_unit}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section style={styles.actionCard}>
                <h2>Refund / Cancellation</h2>
                <textarea
                    style={styles.textarea}
                    placeholder="Reason (optional)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                />
                <div style={styles.actionRow}>
                    {['PLACED', 'CONFIRMED', 'PACKED'].includes(order.status) && (
                        <button style={styles.dangerBtn} onClick={handleCancel}>
                            <XCircle size={16} /> Cancel Order
                        </button>
                    )}
                    {['DELIVERED', 'COMPLETED'].includes(order.status) && (
                        <button style={styles.dangerOutline} onClick={handleRefund}>
                            <Package size={16} /> Issue Refund
                        </button>
                    )}
                </div>
            </section>
        </div>
    );
};

const styles = {
    page: {
        background: 'linear-gradient(180deg, #f9f5f0 0%, #ffffff 40%, #fdf9f6 100%)',
        padding: '2.5rem 2.5rem 4rem',
        minHeight: '100vh',
    },
    loading: { padding: '3rem', color: 'var(--color-text-light)' },
    backBtn: { background: 'transparent', border: 'none', color: 'var(--color-text)', display: 'inline-flex', gap: '8px', alignItems: 'center', cursor: 'pointer', marginBottom: '1rem' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
    title: { fontSize: '2.2rem' },
    subtitle: { color: 'var(--color-text-light)' },
    statusPill: { background: 'rgba(225,29,46,0.12)', color: 'var(--color-accent)', padding: '6px 12px', borderRadius: '999px' },
    infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' },
    infoCard: { background: '#fff', borderRadius: '18px', border: '1px solid var(--color-border)', padding: '1rem', boxShadow: 'var(--shadow-sm)' },
    muted: { color: 'var(--color-text-light)' },
    flowCard: { background: '#fff', borderRadius: '18px', border: '1px solid var(--color-border)', padding: '1.4rem', marginBottom: '1.5rem', boxShadow: 'var(--shadow-sm)' },
    flowHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
    flowRow: { display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' },
    flowStep: { display: 'flex', alignItems: 'center', gap: '6px' },
    flowDot: { width: '12px', height: '12px', borderRadius: '50%', border: '2px solid var(--color-border)' },
    flowDotActive: { width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid var(--color-primary)' },
    flowLabel: { fontSize: '0.8rem', color: 'var(--color-text-light)' },
    flowLabelActive: { fontSize: '0.8rem', color: 'var(--color-text)' },
    primaryBtn: { background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' },
    refreshBtn: { background: 'transparent', border: '1px solid var(--color-border)', padding: '8px 12px', borderRadius: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' },
    itemsCard: { background: '#fff', borderRadius: '18px', border: '1px solid var(--color-border)', padding: '1.2rem', marginBottom: '1.5rem', boxShadow: 'var(--shadow-sm)' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-light)' },
    td: { padding: '8px', borderBottom: '1px solid var(--color-border)' },
    actionCard: { background: '#fff', borderRadius: '18px', border: '1px solid var(--color-border)', padding: '1.2rem', boxShadow: 'var(--shadow-sm)' },
    textarea: { width: '100%', minHeight: '90px', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '10px', marginTop: '0.6rem', marginBottom: '0.8rem' },
    actionRow: { display: 'flex', gap: '0.8rem', flexWrap: 'wrap' },
    dangerBtn: { background: '#ef4444', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' },
    dangerOutline: { background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' },
};

export default ShopOwnerOrderDetail;
