import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, X, Minus, Plus, CreditCard, ArrowLeft, CheckCircle } from 'lucide-react';
import { shopService } from '../services/api';
import '../styles/global.css';

const Cart = () => {
    const navigate = useNavigate();
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [checkingOut, setCheckingOut] = useState(false);

    useEffect(() => {
        fetchCart();
    }, []);

    const fetchCart = async () => {
        setLoading(true);
        try {
            const res = await shopService.getCart();
            // Backend returns: { id, user, items: [...] }
            if (res.data && res.data.items) {
                setCartItems(res.data.items);
            }
        } catch (err) {
            console.error("Failed to fetch cart", err);
        } finally {
            setLoading(false);
        }
    };

    const updateQuantity = async (itemId, newQty) => {
        // Optimistic update could happen here, but for safety waiting for API
        try {
            // Backend api: cart/item/<id>/ with { quantity: x }
            // Note: shopService might need update if it doesn't support specific item update easily, 
            // but looking at previous snippets, shop/urls has cart/item/<id>/
            // We need to implement update function in api.js if missing or use direct call.
            // Let's assume shopService.updateCartItem exists or I add it.
            // Checking api.js -> it's missing updateCartItem. I'll add it in next step. 
            // For now, I'll simulate or use addToCart logic if backend supports it ? No, backend cart_add adds to existing.

            // I will call a new service method `updateCartItem` which I will add momentarily.
            await shopService.updateCartItem(itemId, newQty);
            fetchCart();
        } catch (err) {
            alert('Failed to update quantity');
        }
    };

    const handleCheckout = async () => {
        if (!confirm('Proceed to checkout?')) return;
        setCheckingOut(true);
        try {
            const res = await shopService.checkout();
            const order = res.data;
            if (order?.id) {
                localStorage.setItem('last_order', JSON.stringify(order));
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

    const calculateTotal = () => {
        return cartItems.reduce((total, item) => {
            const price = parseFloat(item.product.price);
            return total + (price * item.quantity);
        }, 0);
    };

    if (loading && cartItems.length === 0) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading cart...</div>;

    return (
        <div style={styles.page}>
            <button style={styles.backBtn} onClick={() => navigate('/customer/shop')}>
                <ArrowLeft size={18} /> Back to Shop
            </button>

            <h1 style={styles.title}>Your Cart</h1>

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
                    <div style={styles.itemsList}>
                        {cartItems.map(item => (
                            <div key={item.id} style={styles.itemRow}>
                                {/* Image Placeholder */}
                                <div style={styles.itemImage}>
                                    <ShoppingBag size={24} color="#888" />
                                </div>

                                <div style={styles.itemDetails}>
                                    <h3>{item.product.name}</h3>
                                    <p style={{ color: 'var(--color-text-light)' }}>${item.product.price} / {item.product.unit}</p>
                                </div>

                                <div style={styles.quantityControls}>
                                    <button
                                        style={styles.qtyBtn}
                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <span style={{ fontWeight: '600', width: '20px', textAlign: 'center' }}>{item.quantity}</span>
                                    <button
                                        style={styles.qtyBtn}
                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>

                                <div style={styles.itemTotal}>
                                    ${(item.quantity * parseFloat(item.product.price)).toFixed(2)}
                                </div>

                                <button style={styles.removeBtn} onClick={() => updateQuantity(item.id, 0)}>
                                    <X size={18} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div style={styles.summary}>
                        <h3>Order Summary</h3>
                        <div style={styles.summaryRow}>
                            <span>Subtotal</span>
                            <span>${calculateTotal().toFixed(2)}</span>
                        </div>
                        <div style={styles.summaryRow}>
                            <span>Tax (0%)</span>
                            <span>$0.00</span>
                        </div>
                        <div style={{ ...styles.summaryRow, fontSize: '1.2rem', fontWeight: 'bold', marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                            <span>Total</span>
                            <span>${calculateTotal().toFixed(2)}</span>
                        </div>

                        <button style={styles.checkoutBtn} onClick={handleCheckout} disabled={checkingOut}>
                            {checkingOut ? 'Processing...' : (
                                <>Checkout <CreditCard size={18} /></>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    page: { maxWidth: '1000px', margin: '0 auto', padding: '2rem' },
    title: { fontSize: '2.5rem', marginBottom: '2rem', color: 'var(--color-text)' },
    backBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-light)', marginBottom: '1rem' },

    emptyState: { textAlign: 'center', padding: '4rem', background: 'var(--color-surface)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', border: '1px solid var(--color-border)' },

    content: { display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' },

    itemsList: { display: 'flex', flexDirection: 'column', gap: '1rem' },
    itemRow: { display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-surface)', padding: '1rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' },
    itemImage: { width: '60px', height: '60px', background: 'var(--color-surface-2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    itemDetails: { flex: 1 },

    quantityControls: { display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface-2)', padding: '4px', borderRadius: '8px' },
    qtyBtn: { width: '24px', height: '24px', borderRadius: '6px', border: 'none', background: 'var(--color-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },

    itemTotal: { fontWeight: 'bold', width: '80px', textAlign: 'right' },
    removeBtn: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px' },

    summary: { background: 'var(--color-surface)', padding: '2rem', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', height: 'fit-content', border: '1px solid var(--color-border)' },
    summaryRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' },

    checkoutBtn: { width: '100%', padding: '16px', background: 'var(--color-primary)', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
    primaryBtn: { padding: '12px 24px', background: 'var(--color-primary)', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }
};

export default Cart;
