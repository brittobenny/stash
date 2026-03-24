import React, { useEffect, useState } from 'react';
import { MessageSquare, RefreshCcw, Star, PackageCheck, Truck, User } from 'lucide-react';
import { shopOwnerService } from '../services/api';
import '../styles/global.css';

const ShopOwnerFeedback = () => {
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(null);
    const [orderDetail, setOrderDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await shopOwnerService.getFeedback();
            setFeedback(res.data || []);
            if (!selected && res.data?.length) {
                handleSelect(res.data[0]);
            }
        } catch (err) {
            setError('Failed to load feedback.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleSelect = async (item) => {
        setSelected(item);
        setOrderDetail(null);
        setDetailError('');
        if (!item?.order) return;
        setDetailLoading(true);
        try {
            const res = await shopOwnerService.getOrderDetail(item.order);
            setOrderDetail(res.data || null);
        } catch (err) {
            setDetailError('Failed to load order details.');
        } finally {
            setDetailLoading(false);
        }
    };

    const renderStars = (rating = 0) => {
        const value = Math.max(0, Math.min(5, Number(rating)));
        return (
            <div style={styles.stars}>
                {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} size={14} style={i <= value ? styles.starActive : styles.starMuted} />
                ))}
            </div>
        );
    };

    return (
        <div style={styles.page}>
            <section style={styles.header}>
                <div>
                    <h1 style={styles.title}>Feedback</h1>
                    <p style={styles.subtitle}>What customers are saying about your shop.</p>
                </div>
                <div style={styles.reportBadge}>
                    <MessageSquare size={14} /> Latest feedback
                </div>
                <button style={styles.refreshBtn} onClick={load} disabled={loading}>
                    <RefreshCcw size={14} /> {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </section>
            {error && <div style={styles.error}>{error}</div>}
            <div style={styles.layout}>
                <div style={styles.listPane}>
                    <div style={styles.feedbackGrid}>
                        {feedback.map((item, index) => (
                            <button
                                key={item.id || index}
                                type="button"
                                style={{
                                    ...styles.feedbackCard,
                                    ...(selected?.id === item.id ? styles.feedbackCardActive : {}),
                                }}
                                onClick={() => handleSelect(item)}
                            >
                                <div style={styles.feedbackHeader}>
                                    <strong>{item.user_name || 'Customer'}</strong>
                                    <span style={styles.feedbackTag}>{item.status || 'OPEN'}</span>
                                </div>
                                <div style={styles.feedbackMeta}>
                                    {renderStars(item.rating)} <span>{item.rating || 0}/5</span>
                                </div>
                                {item.title && <div style={styles.feedbackTitle}>{item.title}</div>}
                                <p style={styles.feedbackMessage}>{item.message}</p>
                                <div style={styles.feedbackFooter}>
                                    <span>Order #{item.order || 'N/A'}</span>
                                    <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</span>
                                </div>
                            </button>
                        ))}
                        {feedback.length === 0 && (
                            <div style={styles.empty}>No feedback yet.</div>
                        )}
                    </div>
                </div>

                <div style={styles.detailPane}>
                    {!selected ? (
                        <div style={styles.detailEmpty}>Select feedback to view details.</div>
                    ) : (
                        <div style={styles.detailCard}>
                            <div style={styles.detailHeader}>
                                <div>
                                    <h3>Feedback details</h3>
                                    <p>Order #{selected.order || 'N/A'}</p>
                                </div>
                                <span style={styles.feedbackTag}>{selected.status || 'OPEN'}</span>
                            </div>
                            <div style={styles.detailSection}>
                                <div style={styles.detailRow}>
                                    <User size={16} /> {selected.user_name || 'Customer'}
                                </div>
                                <div style={styles.detailRow}>
                                    {renderStars(selected.rating)} <span>{selected.rating || 0}/5</span>
                                </div>
                                {selected.title && <div style={styles.detailTitle}>{selected.title}</div>}
                                <p style={styles.detailMessage}>{selected.message}</p>
                            </div>

                            <div style={styles.detailSection}>
                                <div style={styles.detailSectionTitle}>
                                    <PackageCheck size={16} /> Order details
                                </div>
                                {detailLoading ? (
                                    <div style={styles.detailLoading}>Loading order...</div>
                                ) : detailError ? (
                                    <div style={styles.error}>{detailError}</div>
                                ) : orderDetail ? (
                                    <>
                                        <div style={styles.detailRow}>
                                            <Truck size={16} /> Status: {orderDetail.status}
                                        </div>
                                        <div style={styles.detailRow}>Total: ₹{orderDetail.total_amount}</div>
                                        <div style={styles.detailRow}>Delivery address: {orderDetail.user_address || '—'}</div>
                                        <div style={styles.detailRow}>Phone: {orderDetail.user_phone || '—'}</div>
                                        <div style={styles.detailItems}>
                                            {(orderDetail.items || []).map((item) => (
                                                <div key={item.id} style={styles.detailItemRow}>
                                                    <span>{item.product?.name}</span>
                                                    <span>x{item.quantity}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div style={styles.detailEmpty}>No order details available.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
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
    reportBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '999px', background: 'rgba(225,29,46,0.12)', color: 'var(--color-accent)', border: '1px solid rgba(225,29,46,0.2)' },
    refreshBtn: { background: 'transparent', border: '1px solid var(--color-border)', padding: '8px 12px', borderRadius: '999px', cursor: 'pointer' },
    error: { background: 'rgba(239,68,68,0.12)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px', borderRadius: '12px', marginBottom: '1rem', fontWeight: 600 },
    layout: { display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1.1fr)', gap: '1.6rem' },
    listPane: { minWidth: 0 },
    detailPane: { minWidth: 0 },
    feedbackGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' },
    feedbackCard: { background: '#fff', borderRadius: '18px', border: '1px solid var(--color-border)', padding: '1.2rem', boxShadow: 'var(--shadow-sm)', color: 'var(--color-text-light)', textAlign: 'left', cursor: 'pointer' },
    feedbackCardActive: { borderColor: 'rgba(225,29,46,0.35)', boxShadow: '0 18px 30px rgba(225,29,46,0.12)' },
    feedbackHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', color: 'var(--color-text)' },
    feedbackTag: { background: 'rgba(17,17,17,0.08)', padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem' },
    feedbackMeta: { fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' },
    feedbackTitle: { fontWeight: 700, marginBottom: '0.4rem', color: 'var(--color-text)' },
    feedbackMessage: { margin: '0 0 0.6rem', color: 'var(--color-text-light)', lineHeight: 1.5 },
    feedbackFooter: { display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-light)' },
    stars: { display: 'flex', gap: '4px' },
    starActive: { color: 'var(--color-primary)' },
    starMuted: { color: 'rgba(148, 163, 184, 0.8)' },
    detailCard: { background: '#fff', borderRadius: '22px', border: '1px solid var(--color-border)', padding: '1.4rem', boxShadow: 'var(--shadow-sm)' },
    detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
    detailSection: { padding: '0.8rem 0', borderTop: '1px dashed rgba(210, 190, 160, 0.3)' },
    detailSectionTitle: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.6rem' },
    detailRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-light)', marginBottom: '0.4rem' },
    detailTitle: { fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.3rem' },
    detailMessage: { color: 'var(--color-text-light)', lineHeight: 1.6 },
    detailItems: { marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' },
    detailItemRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-text-light)' },
    detailLoading: { color: 'var(--color-text-light)' },
    detailEmpty: { textAlign: 'center', padding: '2rem', color: 'var(--color-text-light)', background: '#fff', borderRadius: '18px', border: '1px dashed rgba(210, 190, 160, 0.4)' },
    empty: { gridColumn: '1/-1', padding: '1rem', textAlign: 'center', color: 'var(--color-text-light)' },
};

export default ShopOwnerFeedback;
