import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, X, Minus, Plus, CreditCard, ArrowLeft } from 'lucide-react';
import { shopService, accountService } from '../services/api';
import { formatCurrency } from '../utils/currency';
import '../styles/global.css';

const Cart = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [checkingOut, setCheckingOut] = useState(false);
    const [profileComplete, setProfileComplete] = useState(true);

    useEffect(() => {
        fetchCart();
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await accountService.getProfile();
            setProfileComplete(Boolean(res.data?.profile_completed));
        } catch (err) {
            setProfileComplete(true);
        }
    };

    const fetchCart = async () => {
        setLoading(true);
        try {
            const res = await shopService.getCart();
            if (res.data?.items) {
                setCartItems(res.data.items);
            } else {
                setCartItems([]);
            }
        } catch (err) {
            console.error('Failed to fetch cart', err);
        } finally {
            setLoading(false);
        }
    };

    const updateQuantity = async (itemId, newQty) => {
        try {
            await shopService.updateCartItem(itemId, newQty);
            await fetchCart();
        } catch (err) {
            alert('Failed to update quantity.');
        }
    };

    const handleCheckout = async () => {
        if (!profileComplete) {
            alert('Please complete your profile (address & location) before checkout.');
            return;
        }
        if (!confirm('Proceed to checkout?')) return;

        setCheckingOut(true);
        try {
            const res = await shopService.checkout();
            const order = res.data;
            if (order?.id) {
                sessionStorage.setItem('last_order', JSON.stringify(order));
                navigate(`/customer/payment/${order.id}`);
            } else {
                navigate('/customer/orders');
            }
        } catch (err) {
            const msg = err.response?.data?.error || 'Checkout failed';
            alert(`Checkout failed: ${msg}`);
        } finally {
            setCheckingOut(false);
        }
    };

    const calculateTotal = () =>
        cartItems.reduce((total, item) => total + parseFloat(item.product.price || 0) * item.quantity, 0);

    const searchParams = new URLSearchParams(location.search);
    const fromRestockBill = searchParams.get('source') === 'restock';
    const lowStockCount = Number(searchParams.get('low_stock') || 0);
    const matchedCount = Number(searchParams.get('matched') || 0);
    const unmatchedCount = Number(searchParams.get('unmatched') || 0);

    const getRestockBannerText = () => {
        if (matchedCount > 0 && unmatchedCount > 0) {
            return `${matchedCount} of ${lowStockCount || matchedCount + unmatchedCount} low-stock pantry items were added to the cart. ${unmatchedCount} item${unmatchedCount === 1 ? '' : 's'} currently have no matching in-stock shop product.`;
        }
        if (matchedCount > 0) {
            return `${matchedCount} low-stock pantry item${matchedCount === 1 ? '' : 's'} ${matchedCount === 1 ? 'was' : 'were'} loaded into the cart. You can review quantities here and continue to checkout.`;
        }
        return 'Your low-stock pantry bill has been loaded into the cart. You can review quantities here and continue to checkout.';
    };

    if (loading && cartItems.length === 0) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading cart...</div>;
    }

    return (
        <div style={styles.page}>
            <button style={styles.backBtn} onClick={() => navigate('/customer/shop')}>
                <ArrowLeft size={18} /> Back to Shop
            </button>

            <h1 style={styles.title}>Your Cart</h1>

            {fromRestockBill && (
                <div style={styles.restockBanner}>
                    {getRestockBannerText()}
                </div>
            )}

            {cartItems.length === 0 ? (
                <div style={styles.emptyState}>
                    <ShoppingBag size={48} color="#ccc" />
                    <p>Your cart is empty.</p>
                    <button style={styles.primaryBtn} onClick={() => navigate('/customer/shop')}>
                        Start Shopping
                    </button>
                </div>
            ) : (
                <div style={styles.content}>
                    <div>
                        {!profileComplete && (
                            <div style={styles.alert}>Complete your profile (address and location) to checkout.</div>
                        )}
                        <div style={styles.itemsList}>
                            {cartItems.map((item) => (
                                <div key={item.id} style={styles.itemRow}>
                                    <div style={styles.itemImage}>
                                        <ShoppingBag size={24} color="#888" />
                                    </div>

                                    <div style={styles.itemDetails}>
                                        <h3 style={styles.itemName}>{item.product.name}</h3>
                                        <p style={styles.itemMeta}>
                                            {formatCurrency(item.product.price)} / {item.product.unit}
                                        </p>
                                    </div>

                                    <div style={styles.quantityControls}>
                                        <button style={styles.qtyBtn} onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                                            <Minus size={14} />
                                        </button>
                                        <span style={styles.qtyText}>{item.quantity}</span>
                                        <button style={styles.qtyBtn} onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                                            <Plus size={14} />
                                        </button>
                                    </div>

                                    <div style={styles.itemTotal}>
                                        {formatCurrency(item.quantity * parseFloat(item.product.price || 0))}
                                    </div>

                                    <button style={styles.removeBtn} onClick={() => updateQuantity(item.id, 0)}>
                                        <X size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={styles.summary}>
                        <h3 style={styles.summaryTitle}>Order Summary</h3>
                        <div style={styles.summaryRow}>
                            <span>Subtotal</span>
                            <span>{formatCurrency(calculateTotal())}</span>
                        </div>
                        <div style={styles.summaryRow}>
                            <span>Tax</span>
                            <span>{formatCurrency(0)}</span>
                        </div>
                        <div style={styles.summaryTotal}>
                            <span>Total</span>
                            <span>{formatCurrency(calculateTotal())}</span>
                        </div>

                        <button
                            style={{ ...styles.checkoutBtn, opacity: profileComplete ? 1 : 0.6 }}
                            onClick={handleCheckout}
                            disabled={checkingOut || !profileComplete}
                        >
                            {checkingOut ? 'Processing...' : <>Checkout <CreditCard size={18} /></>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    page: { maxWidth: '1000px', margin: '0 auto', padding: '2rem' },
    title: { fontSize: '2.5rem', marginBottom: '1.5rem', color: 'var(--color-text)' },
    backBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-light)', marginBottom: '1rem' },
    restockBanner: { background: 'linear-gradient(135deg, rgba(225,29,46,0.1), rgba(251,191,36,0.12))', color: 'var(--color-text)', border: '1px solid rgba(225,29,46,0.16)', padding: '12px 16px', borderRadius: '14px', marginBottom: '1.5rem', fontWeight: '600' },
    emptyState: { textAlign: 'center', padding: '4rem', background: 'var(--color-surface)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', border: '1px solid var(--color-border)' },
    content: { display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' },
    alert: { background: 'rgba(225,29,46,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(225,29,46,0.2)', padding: '12px 16px', borderRadius: '12px', marginBottom: '1rem', fontWeight: '600' },
    itemsList: { display: 'flex', flexDirection: 'column', gap: '1rem' },
    itemRow: { display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-surface)', padding: '1rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' },
    itemImage: { width: '60px', height: '60px', background: 'var(--color-surface-2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    itemDetails: { flex: 1, minWidth: 0 },
    itemName: { margin: 0, fontSize: '1.05rem' },
    itemMeta: { color: 'var(--color-text-light)', marginTop: '0.2rem' },
    quantityControls: { display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface-2)', padding: '4px', borderRadius: '8px' },
    qtyBtn: { width: '24px', height: '24px', borderRadius: '6px', border: 'none', background: 'var(--color-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    qtyText: { fontWeight: '600', width: '20px', textAlign: 'center' },
    itemTotal: { fontWeight: 'bold', width: '80px', textAlign: 'right' },
    removeBtn: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px' },
    summary: { background: 'var(--color-surface)', padding: '2rem', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', height: 'fit-content', border: '1px solid var(--color-border)' },
    summaryTitle: { marginBottom: '1rem' },
    summaryRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' },
    summaryTotal: { display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', fontSize: '1.2rem', fontWeight: 'bold' },
    checkoutBtn: { width: '100%', padding: '16px', background: 'var(--color-primary)', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
    primaryBtn: { padding: '12px 24px', background: 'var(--color-primary)', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' },
};

export default Cart;
