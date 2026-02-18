import React, { useEffect, useMemo, useState } from 'react';
import {
    DollarSign,
    Package,
    Layers,
    TrendingUp,
    Calendar,
} from 'lucide-react';
import { shopOwnerService } from '../services/api';
import '../styles/global.css';

const ShopOwnerDashboard = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const prodRes = await shopOwnerService.getMyProducts();
            setProducts(prodRes.data || []);
        } catch (err) {
            console.error('Shop owner products fetch failed', err);
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => ({
        totalProducts: products.length,
        totalStock: products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0),
        activeProducts: products.filter((p) => p.is_active).length,
        inventoryValue: products.reduce((sum, p) => sum + Number(p.price || 0) * Number(p.stock_quantity || 0), 0),
    }), [products]);

    const reportData = [
        { label: 'Mon', value: 38 },
        { label: 'Tue', value: 52 },
        { label: 'Wed', value: 28 },
        { label: 'Thu', value: 70 },
        { label: 'Fri', value: 64 },
        { label: 'Sat', value: 82 },
        { label: 'Sun', value: 45 },
    ];

    return (
        <div style={styles.page}>
            <section style={styles.hero}>
                <div style={styles.heroContent}>
                    <span style={styles.kicker}>Shop Owner Dashboard</span>
                    <h1 style={styles.title}>Command Center</h1>
                    <p style={styles.subtitle}>
                        Track sales performance, manage inventory, and keep your listings fresh across Stash.
                    </p>
                    <div style={styles.heroActions}>
                        <button style={styles.primaryBtn} onClick={loadProducts} disabled={loading}>
                            {loading ? 'Refreshing...' : 'Refresh Data'}
                        </button>
                    </div>
                </div>
                <div style={styles.heroPanel}>
                    <div style={styles.panelCard}>
                        <div style={styles.panelIcon}><DollarSign size={18} /></div>
                        <div>
                            <p style={styles.panelLabel}>Inventory value</p>
                            <p style={styles.panelValue}>${stats.inventoryValue.toFixed(2)}</p>
                        </div>
                    </div>
                    <div style={styles.panelCard}>
                        <div style={styles.panelIcon}><Package size={18} /></div>
                        <div>
                            <p style={styles.panelLabel}>Active listings</p>
                            <p style={styles.panelValue}>{stats.activeProducts}</p>
                        </div>
                    </div>
                    <div style={styles.panelCard}>
                        <div style={styles.panelIcon}><Layers size={18} /></div>
                        <div>
                            <p style={styles.panelLabel}>Stock units</p>
                            <p style={styles.panelValue}>{stats.totalStock}</p>
                        </div>
                    </div>
                    <div style={styles.panelCard}>
                        <div style={styles.panelIcon}><TrendingUp size={18} /></div>
                        <div>
                            <p style={styles.panelLabel}>Weekly growth</p>
                            <p style={styles.panelValue}>+14%</p>
                        </div>
                    </div>
                </div>
            </section>

            <section style={styles.reportSection}>
                <div style={styles.sectionHeader}>
                    <div>
                        <h2 style={styles.sectionTitle}>Sales reports</h2>
                        <p style={styles.sectionSubtitle}>Snapshot of weekly demand and fulfillment.</p>
                    </div>
                    <div style={styles.reportBadge}>
                        <Calendar size={14} /> Last 7 days
                    </div>
                </div>
                <div style={styles.reportGrid}>
                    <div style={styles.reportCard}>
                        <div style={styles.reportMetric}>
                            <p>Total orders</p>
                            <strong>128</strong>
                        </div>
                        <div style={styles.reportMetric}>
                            <p>Avg. order value</p>
                            <strong>$24.90</strong>
                        </div>
                        <div style={styles.reportMetric}>
                            <p>On-time delivery</p>
                            <strong>96%</strong>
                        </div>
                    </div>
                    <div style={styles.chartCard}>
                        <div style={styles.chartHeader}>
                            <h3>Demand trend</h3>
                            <span style={styles.chartNote}>Orders per day</span>
                        </div>
                        <div style={styles.chartBars}>
                            {reportData.map((item) => (
                                <div key={item.label} style={styles.chartBarWrap}>
                                    <div style={{ ...styles.chartBar, height: `${item.value}%` }}></div>
                                    <span>{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
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
    hero: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '2rem',
        padding: '2.5rem',
        borderRadius: '28px',
        background: '#1f1b16',
        color: '#fff',
        marginBottom: '2.5rem',
        boxShadow: '0 30px 60px rgba(30, 27, 22, 0.28)',
    },
    heroContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        justifyContent: 'center',
    },
    kicker: {
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
        fontSize: '0.75rem',
        color: 'rgba(255,255,255,0.6)',
    },
    title: { fontSize: '2.8rem', fontFamily: 'var(--font-heading)' },
    subtitle: { color: 'rgba(255,255,255,0.75)', maxWidth: '460px' },
    heroActions: { display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '1rem' },
    heroPanel: {
        display: 'grid',
        gap: '1rem',
        alignContent: 'center',
    },
    panelCard: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem 1.2rem',
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
    },
    panelIcon: {
        width: '40px',
        height: '40px',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    panelLabel: { fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' },
    panelValue: { fontSize: '1.4rem', fontWeight: 700 },

    primaryBtn: { background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '12px 18px', borderRadius: '999px', fontWeight: '600', cursor: 'pointer' },

    reportSection: { marginBottom: '2.5rem' },
    reportBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '999px', background: 'rgba(225,29,46,0.12)', color: 'var(--color-accent)', border: '1px solid rgba(225,29,46,0.2)' },
    reportGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' },
    reportCard: { background: '#fff', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', display: 'grid', gap: '1rem' },
    reportMetric: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1rem', color: 'var(--color-text-light)' },
    chartCard: { background: '#fff', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' },
    chartHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.5rem' },
    chartNote: { color: 'var(--color-text-light)', fontSize: '0.85rem' },
    chartBars: { display: 'flex', gap: '0.75rem', alignItems: 'flex-end', height: '160px' },
    chartBarWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', flex: 1, fontSize: '0.8rem', color: 'var(--color-text-light)' },
    chartBar: { width: '100%', borderRadius: '10px 10px 6px 6px', background: 'linear-gradient(180deg, var(--color-primary), var(--color-accent))' },

    sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' },
    sectionTitle: { fontSize: '1.7rem', color: 'var(--color-text)' },
    sectionSubtitle: { color: 'var(--color-text-light)' },
};

export default ShopOwnerDashboard;
