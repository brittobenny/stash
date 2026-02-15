import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CreditCard, ShieldCheck, ArrowLeft } from 'lucide-react';
import { shopService } from '../services/api';
import '../styles/global.css';

const Payment = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [form, setForm] = useState({ name: '', card: '', exp: '', cvc: '' });

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            try {
                const res = await shopService.listOrders();
                const found = (res.data || []).find((o) => String(o.id) === String(id));
                setOrder(found || null);
            } catch (err) {
                setOrder(null);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [id]);

    const handlePay = async () => {
        setProcessing(true);
        setTimeout(() => {
            setProcessing(false);
            navigate('/customer/orders');
        }, 1200);
    };

    if (loading) return <div style={styles.loading}>Loading payment details...</div>;

    if (!order) {
        return (
            <div style={styles.loading}>
                Order not found.
                <button style={styles.backBtn} onClick={() => navigate('/customer/orders')}>
                    <ArrowLeft size={16} /> Back to Orders
                </button>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <button style={styles.backBtn} onClick={() => navigate('/customer/orders')}>
                <ArrowLeft size={16} /> Back to Orders
            </button>

            <div style={styles.card}>
                <div style={styles.header}>
                    <CreditCard size={28} />
                    <div>
                        <h1 style={styles.title}>Payment</h1>
                        <p style={styles.subtitle}>Secure checkout for Order #{order.id}</p>
                    </div>
                </div>

                <div style={styles.summary}>
                    <div style={styles.row}>
                        <span>Total Amount</span>
                        <strong>${Number(order.total_amount).toFixed(2)}</strong>
                    </div>
                    <div style={styles.row}>
                        <span>Status</span>
                        <strong>{order.status}</strong>
                    </div>
                </div>

                <div style={styles.fakeCard}>
                    <div style={styles.fakeTop}>
                        <span>Card Number</span>
                        <span>**** 3245</span>
                    </div>
                    <div style={styles.fakeMid}>12 / 29</div>
                    <div style={styles.fakeBottom}>
                        <span>{form.name || 'Stash User'}</span>
                        <ShieldCheck size={18} />
                    </div>
                </div>

                <div style={styles.form}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Cardholder Name</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="Alex Morgan"
                            style={styles.input}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Card Number</label>
                        <input
                            type="text"
                            value={form.card}
                            onChange={(e) => setForm({ ...form, card: e.target.value })}
                            placeholder="1234 5678 9012 3456"
                            style={styles.input}
                        />
                    </div>
                    <div style={styles.formRow}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Expiry</label>
                            <input
                                type="text"
                                value={form.exp}
                                onChange={(e) => setForm({ ...form, exp: e.target.value })}
                                placeholder="MM/YY"
                                style={styles.input}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>CVC</label>
                            <input
                                type="text"
                                value={form.cvc}
                                onChange={(e) => setForm({ ...form, cvc: e.target.value })}
                                placeholder="123"
                                style={styles.input}
                            />
                        </div>
                    </div>
                </div>

                <button style={styles.payBtn} onClick={handlePay} disabled={processing}>
                    {processing ? 'Processing...' : 'Confirm Payment'}
                </button>
                <p style={styles.note}>This is a demo payment flow.</p>
            </div>
        </div>
    );
};

const styles = {
    page: { maxWidth: '720px', margin: '0 auto', padding: '3rem 2rem', background: 'var(--color-background)', minHeight: '100vh', color: 'var(--color-text)' },
    loading: { textAlign: 'center', padding: '3rem', color: 'var(--color-text-light)' },
    backBtn: { background: 'none', border: 'none', color: 'var(--color-text-light)', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', cursor: 'pointer' },
    card: { background: 'var(--color-surface)', borderRadius: '20px', padding: '2rem', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' },
    header: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' },
    title: { fontSize: '2rem', marginBottom: '0.3rem' },
    subtitle: { color: 'var(--color-text-light)' },
    summary: { display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' },
    row: { display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-light)' },
    fakeCard: { background: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(15,23,42,0.05))', borderRadius: '18px', padding: '1.5rem', color: 'var(--color-text)', marginBottom: '1.5rem', border: '1px solid var(--color-border)' },
    fakeTop: { display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '1rem' },
    fakeMid: { fontSize: '1.6rem', letterSpacing: '0.2rem', marginBottom: '1rem' },
    fakeBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' },
    form: { display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' },
    formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
    label: { fontSize: '0.85rem', color: 'var(--color-text-light)' },
    input: { padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', fontSize: '1rem', color: 'var(--color-text)' },
    payBtn: { width: '100%', padding: '14px', background: 'var(--color-primary)', color: '#ffffff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' },
    note: { textAlign: 'center', marginTop: '0.8rem', color: 'var(--color-text-light)', fontSize: '0.85rem' },
};

export default Payment;
