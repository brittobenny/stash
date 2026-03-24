import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PackageCheck, ClipboardList, XCircle, MessageSquare, Star } from 'lucide-react';
import { shopService } from '../services/api';
import { formatCurrency } from '../utils/currency';
import '../styles/global.css';

const Orders = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updateInfo, setUpdateInfo] = useState(null);
    const [updateError, setUpdateError] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showFeedback, setShowFeedback] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [feedbackForm, setFeedbackForm] = useState({ rating: 5, title: '', message: '' });
    const [feedbackError, setFeedbackError] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [feedbackLoading, setFeedbackLoading] = useState(false);

    const feedbackMode = new URLSearchParams(location.search).get('feedback') === '1';



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

    const normalizeOrders = (list = []) =>
        [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const deliveredStatuses = new Set(['DELIVERED', 'COMPLETED']);
    const visibleOrders = feedbackMode
        ? normalizeOrders(orders.filter((order) => deliveredStatuses.has(order.status)))
        : normalizeOrders(orders);

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

    const openFeedback = (order) => {
        setSelectedOrder(order);
        setFeedbackForm({ rating: 5, title: '', message: '' });
        setFeedbackError('');
        setFeedbackMessage('');
        setShowFeedback(true);
    };

    const submitFeedback = async () => {
        if (!selectedOrder) return;
        if (!feedbackForm.message.trim()) {
            setFeedbackError('Please share your feedback.');
            return;
        }
        setFeedbackLoading(true);
        setFeedbackError('');
        try {
            await shopService.createFeedback({
                order_id: selectedOrder.id,
                rating: Number(feedbackForm.rating || 5),
                title: feedbackForm.title,
                message: feedbackForm.message,
            });
            setFeedbackMessage('Thanks! Your feedback has been submitted.');
            setTimeout(() => setShowFeedback(false), 900);
        } catch (err) {
            setFeedbackError('Failed to submit feedback.');
        } finally {
            setFeedbackLoading(false);
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
            {feedbackMode && (
                <div style={styles.infoBanner}>
                    Select a recent delivered order below and click "Leave Feedback".
                </div>
            )}

            {loading ? (
                <div style={styles.loading}>Loading orders...</div>
            ) : visibleOrders.length === 0 ? (
                <div style={styles.empty}>
                    <ClipboardList size={48} />
                    <p>{feedbackMode ? 'No delivered orders to review yet.' : 'No orders yet.'}</p>
                    <button style={styles.primaryBtn} onClick={() => navigate('/customer/shop')}>
                        Shop Now
                    </button>
                </div>
            ) : (
                <div style={styles.grid}>
                    {visibleOrders.map((order, index) => {
                        const firstItem = (order.items || [])[0];
                        const shopName = firstItem?.product?.owner || 'Shop';
                        const shopLocation = firstItem?.product?.owner_location;
                        const createdDate = order.created_at
                            ? new Date(order.created_at).toLocaleDateString()
                            : 'Unknown date';
                        return (
                        <div
                            key={order.id}
                            style={{ ...styles.card, animationDelay: `${index * 0.05}s` }}
                            className="fade-up hover-float"
                        >
                            <div style={styles.cardHeader}>
                                <div>
                                    <h3>Order #{order.id}</h3>
                                    <p style={styles.cardMeta}>{order.status}</p>
                                    <p style={styles.cardMeta}>Placed: {createdDate}</p>
                                    <p style={styles.cardMeta}>
                                        Shop: {shopName}{shopLocation ? ` - ${shopLocation}` : ''}
                                    </p>
                                </div>
                                <strong>{formatCurrency(order.total_amount)}</strong>
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
                                {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
                                    <button style={styles.feedbackBtn} onClick={() => openFeedback(order)}>
                                        <MessageSquare size={16} /> Leave Feedback
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
                        );
                    })}
                </div>
            )}

            {showFeedback && selectedOrder && (
                <div className="fixed inset-0 flex items-center justify-center z-[200] p-4 bg-black/40 backdrop-blur-sm transition-all duration-300">
                    <div className="w-full max-w-xl bg-white/90 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] transform transition-all duration-300 scale-100 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4 shrink-0">
                            <div>
                                <h3 className="text-2xl font-bold font-['Playfair_Display'] text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-red-400">
                                    Rate Order #{selectedOrder.id}
                                </h3>
                                <p className="text-gray-500 mt-1 text-sm font-medium">Tell us about your culinary experience</p>
                            </div>
                            <button
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors duration-200"
                                onClick={() => setShowFeedback(false)}
                            >
                                <XCircle size={24} className="stroke-[1.5]" />
                            </button>
                        </div>
                        
                        <div className="overflow-y-auto pr-2 custom-scrollbar">
                            {feedbackError && (
                                <div className="mb-6 p-4 rounded-xl bg-red-50/80 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-2 animate-pulse">
                                    <XCircle size={18} /> {feedbackError}
                                </div>
                            )}
                            {feedbackMessage && (
                                <div className="mb-6 p-4 rounded-xl bg-green-50/80 border border-green-100 text-green-700 text-sm font-medium flex items-center gap-2">
                                    <PackageCheck size={18} /> {feedbackMessage}
                                </div>
                            )}

                            <div className="mb-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Order Items</h4>
                                <div className="flex flex-col gap-2">
                                    {(selectedOrder.items || []).map((item) => (
                                        <div key={item.id} className="flex justify-between text-sm font-medium text-gray-700">
                                            <span className="flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                                {item.product?.name}
                                            </span>
                                            <span className="text-gray-500 bg-white px-2 py-0.5 rounded-md border border-gray-100 shadow-sm">x{item.quantity}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-6 pb-2">
                                <div className="flex flex-col gap-3">
                                    <label className="text-sm font-bold text-gray-700">Experience Rating</label>
                                    <div className="flex gap-2 sm:gap-4">
                                        {[1, 2, 3, 4, 5].map((value) => (
                                            <button
                                                key={value}
                                                type="button"
                                                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 ${
                                                    value <= feedbackForm.rating 
                                                        ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30' 
                                                        : 'bg-white text-gray-300 border border-gray-200 hover:border-red-300 hover:text-red-300'
                                                }`}
                                                onClick={() => setFeedbackForm((prev) => ({ ...prev, rating: value }))}
                                                aria-label={`${value} star`}
                                            >
                                                <Star size={24} className={value <= feedbackForm.rating ? 'fill-white' : 'fill-transparent'} />
                                            </button>
                                        ))}
                                    </div>
                                    <span className="text-xs text-gray-400 font-medium tracking-wide">
                                        {feedbackForm.rating === 5 ? 'Excellent!' : feedbackForm.rating === 4 ? 'Good!' : feedbackForm.rating === 3 ? 'Okay' : feedbackForm.rating === 2 ? 'Poor' : 'Terrible'} - Tap a star to rate
                                    </span>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-gray-700">Highlights</label>
                                    <input
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all placeholder:text-gray-400 placeholder:font-normal"
                                        value={feedbackForm.title}
                                        onChange={(e) => setFeedbackForm((prev) => ({ ...prev, title: e.target.value }))}
                                        placeholder="e.g., Amazing packaging, delicious food!"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-gray-700">Detailed Review</label>
                                    <textarea
                                        rows="4"
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all placeholder:text-gray-400 placeholder:font-normal resize-none"
                                        value={feedbackForm.message}
                                        onChange={(e) => setFeedbackForm((prev) => ({ ...prev, message: e.target.value }))}
                                        placeholder="Share details about the quality, flavor, and delivery experience..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-100 shrink-0">
                            <button 
                                className="px-6 py-3 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                onClick={() => setShowFeedback(false)}
                            >
                                Cancel
                            </button>
                            <button 
                                className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                onClick={submitFeedback} 
                                disabled={feedbackLoading}
                            >
                                {feedbackLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Submitting...</span>
                                    </>
                                ) : (
                                    <>
                                        <MessageSquare size={18} />
                                        <span>Submit Review</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
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
    infoBanner: { background: 'rgba(59,130,246,0.12)', color: '#1d4ed8', padding: '10px 14px', borderRadius: '10px', marginBottom: '1rem', border: '1px solid rgba(59,130,246,0.2)' },
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
    feedbackBtn: { background: 'rgba(59,130,246,0.12)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.2)', padding: '8px 12px', borderRadius: '10px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' },
    completed: { color: 'var(--color-text)', fontWeight: '700' },
    pantryResult: { marginTop: '1rem', background: 'var(--color-surface-2)', borderRadius: '12px', padding: '0.8rem', border: '1px solid var(--color-border)' },
    pantryLine: { color: 'var(--color-text-light)', fontSize: '0.85rem', marginTop: '0.4rem' },
    linkBtn: { marginTop: '0.6rem', background: 'transparent', border: '1px solid var(--color-border)', padding: '6px 10px', borderRadius: '999px', cursor: 'pointer', color: 'var(--color-text)' },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
    modalCard: { width: 'min(700px, 92%)', background: '#fff', borderRadius: '16px', padding: '1.4rem', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' },
    modalSub: { color: 'var(--color-text-light)' },
    modalClose: { background: 'rgba(15,23,42,0.08)', borderRadius: '10px', padding: '6px 10px' },
    modalItems: { display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' },
    modalItemRow: { display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-light)' },
    modalForm: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' },
    ratingBlock: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
    ratingLabel: { fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)' },
    ratingRow: { display: 'flex', gap: '0.35rem' },
    ratingStar: {
        width: '32px',
        height: '32px',
        borderRadius: '10px',
        border: '1px solid rgba(17,24,39,0.1)',
        background: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: '#cbd5f5'
    },
    ratingStarActive: {
        background: 'rgba(225, 29, 46, 0.12)',
        borderColor: 'rgba(225, 29, 46, 0.35)',
        color: 'var(--color-primary)'
    },
    ratingHint: { fontSize: '0.8rem', color: 'var(--color-text-light)' },
    modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' },
    successBanner: { background: 'rgba(34,197,94,0.12)', color: '#15803d', padding: '10px 14px', borderRadius: '10px', marginBottom: '1rem', border: '1px solid rgba(34,197,94,0.2)' },
};

export default Orders;
