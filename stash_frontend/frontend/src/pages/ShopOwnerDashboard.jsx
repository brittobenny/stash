import React, { useEffect, useMemo, useState } from 'react';
import {
    DollarSign,
    Package,
    Layers,
    TrendingUp,
    Calendar,
    AlertTriangle,
    Download,
} from 'lucide-react';
import { shopOwnerService } from '../services/api';
import '../styles/global.css';

const isoDate = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const defaultTo = isoDate(today);
const defaultFrom = isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29));

const ShopOwnerDashboard = () => {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [filters, setFilters] = useState({
        date_from: defaultFrom,
        date_to: defaultTo,
    });

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const res = await shopOwnerService.getAnalytics(filters);
            setAnalytics(res.data || null);
        } catch (err) {
            setAnalytics(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAnalytics();
    }, []);

    const summary = analytics?.summary || {};
    const salesByDay = analytics?.sales_by_day || [];
    const chartRows = salesByDay.slice(-10);
    const topProducts = analytics?.top_products || [];
    const lowStockAlerts = analytics?.low_stock_alerts || [];

    const maxRevenue = useMemo(() => {
        const m = chartRows.reduce((acc, row) => Math.max(acc, Number(row.revenue || 0)), 0);
        return m || 1;
    }, [chartRows]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const res = await shopOwnerService.exportAnalytics(filters);
            const blob = new Blob([res.data], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shop_owner_analytics_${filters.date_from}_${filters.date_to}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Failed to export report.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div style={styles.page}>
            <section style={styles.hero}>
                <div style={styles.heroContent}>
                    <span style={styles.kicker}>Shop Owner Dashboard</span>
                    <h1 style={styles.title}>Operations Command Center</h1>
                    <p style={styles.subtitle}>
                        Live sales analytics, low-stock alerts, and export-ready reporting for your store.
                    </p>
                    <div style={styles.filterRow}>
                        <div style={styles.filterField}>
                            <label>From</label>
                            <input
                                type="date"
                                value={filters.date_from}
                                onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value }))}
                                style={styles.input}
                            />
                        </div>
                        <div style={styles.filterField}>
                            <label>To</label>
                            <input
                                type="date"
                                value={filters.date_to}
                                onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                                style={styles.input}
                            />
                        </div>
                    </div>
                    <div style={styles.heroActions}>
                        <button style={styles.primaryBtn} onClick={loadAnalytics} disabled={loading}>
                            {loading ? 'Refreshing...' : 'Refresh Data'}
                        </button>
                        <button style={styles.secondaryBtn} onClick={handleExport} disabled={exporting}>
                            <Download size={16} /> {exporting ? 'Exporting...' : 'Export CSV'}
                        </button>
                    </div>
                </div>
                <div style={styles.heroPanel}>
                    <div style={styles.panelCard}>
                        <div style={styles.panelIcon}><DollarSign size={18} /></div>
                        <div>
                            <p style={styles.panelLabel}>Revenue</p>
                            <p style={styles.panelValue}>${Number(summary.total_revenue || 0).toFixed(2)}</p>
                        </div>
                    </div>
                    <div style={styles.panelCard}>
                        <div style={styles.panelIcon}><Package size={18} /></div>
                        <div>
                            <p style={styles.panelLabel}>Orders</p>
                            <p style={styles.panelValue}>{summary.total_orders || 0}</p>
                        </div>
                    </div>
                    <div style={styles.panelCard}>
                        <div style={styles.panelIcon}><Layers size={18} /></div>
                        <div>
                            <p style={styles.panelLabel}>Items sold</p>
                            <p style={styles.panelValue}>{summary.total_items_sold || 0}</p>
                        </div>
                    </div>
                    <div style={styles.panelCard}>
                        <div style={styles.panelIcon}><TrendingUp size={18} /></div>
                        <div>
                            <p style={styles.panelLabel}>Avg order value</p>
                            <p style={styles.panelValue}>${Number(summary.avg_order_value || 0).toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section style={styles.reportSection}>
                <div style={styles.sectionHeader}>
                    <div>
                        <h2 style={styles.sectionTitle}>Sales trend</h2>
                        <p style={styles.sectionSubtitle}>Daily revenue for the selected period.</p>
                    </div>
                    <div style={styles.reportBadge}>
                        <Calendar size={14} /> {filters.date_from} to {filters.date_to}
                    </div>
                </div>
                <div style={styles.reportGrid}>
                    <div style={styles.reportCard}>
                        <div style={styles.reportMetric}>
                            <p>Delivered orders</p>
                            <strong>{summary.delivered_orders || 0}</strong>
                        </div>
                        <div style={styles.reportMetric}>
                            <p>Low stock products</p>
                            <strong>{summary.low_stock_count || 0}</strong>
                        </div>
                        <div style={styles.reportMetric}>
                            <p>Out of stock</p>
                            <strong>{summary.out_of_stock_count || 0}</strong>
                        </div>
                    </div>
                    <div style={styles.chartCard}>
                        <div style={styles.chartHeader}>
                            <h3>Revenue trend</h3>
                            <span style={styles.chartNote}>Latest {chartRows.length || 0} days</span>
                        </div>
                        <div style={styles.chartBars}>
                            {chartRows.length === 0 && <div style={styles.emptyText}>No sales in this period.</div>}
                            {chartRows.map((item) => (
                                <div key={item.date} style={styles.chartBarWrap}>
                                    <div
                                        style={{
                                            ...styles.chartBar,
                                            height: `${Math.max(10, (Number(item.revenue || 0) / maxRevenue) * 100)}%`,
                                        }}
                                        title={`$${Number(item.revenue || 0).toFixed(2)}`}
                                    ></div>
                                    <span>{item.date.slice(5)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section style={styles.tableSection}>
                <div style={styles.tableCard}>
                    <h3 style={styles.tableTitle}>Top products</h3>
                    <div style={styles.tableWrap}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Product</th>
                                    <th style={styles.th}>Units</th>
                                    <th style={styles.th}>Revenue</th>
                                    <th style={styles.th}>Stock</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topProducts.map((p) => (
                                    <tr key={p.product_id}>
                                        <td style={styles.td}>{p.name}</td>
                                        <td style={styles.td}>{p.units_sold}</td>
                                        <td style={styles.td}>${Number(p.revenue || 0).toFixed(2)}</td>
                                        <td style={styles.td}>
                                            {p.stock_quantity}
                                            {p.low_stock ? <span style={styles.lowTag}>Low</span> : null}
                                        </td>
                                    </tr>
                                ))}
                                {topProducts.length === 0 && (
                                    <tr>
                                        <td style={styles.emptyCell} colSpan={4}>No product sales yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={styles.alertCard}>
                    <div style={styles.alertHeader}>
                        <AlertTriangle size={18} />
                        <h3>Inventory alerts</h3>
                    </div>
                    <div style={styles.alertList}>
                        {lowStockAlerts.length === 0 && <p style={styles.emptyText}>No low-stock alerts.</p>}
                        {lowStockAlerts.map((item) => (
                            <div key={item.product_id} style={styles.alertItem}>
                                <div>
                                    <strong>{item.name}</strong>
                                    <p style={styles.alertMeta}>
                                        Stock {item.stock_quantity} / Threshold {item.low_stock_threshold}
                                    </p>
                                </div>
                                <span style={item.is_out_of_stock ? styles.alertBad : styles.alertWarn}>
                                    {item.is_out_of_stock ? 'Out' : 'Low'}
                                </span>
                            </div>
                        ))}
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2rem',
        padding: '2.4rem',
        borderRadius: '28px',
        background: '#1f1b16',
        color: '#fff',
        marginBottom: '2.5rem',
        boxShadow: '0 30px 60px rgba(30, 27, 22, 0.28)',
    },
    heroContent: { display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' },
    kicker: { textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' },
    title: { fontSize: '2.6rem', fontFamily: 'var(--font-heading)' },
    subtitle: { color: 'rgba(255,255,255,0.75)', maxWidth: '520px' },
    filterRow: { display: 'flex', gap: '0.8rem', flexWrap: 'wrap' },
    filterField: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' },
    input: { padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#fff' },
    heroActions: { display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.5rem' },
    primaryBtn: { background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '12px 18px', borderRadius: '999px', fontWeight: '600', cursor: 'pointer' },
    secondaryBtn: { background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '12px 18px', borderRadius: '999px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' },
    heroPanel: { display: 'grid', gap: '1rem', alignContent: 'center' },
    panelCard: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.2rem', borderRadius: '16px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' },
    panelIcon: { width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    panelLabel: { fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' },
    panelValue: { fontSize: '1.4rem', fontWeight: 700 },

    reportSection: { marginBottom: '1.6rem' },
    sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' },
    sectionTitle: { fontSize: '1.7rem', color: 'var(--color-text)' },
    sectionSubtitle: { color: 'var(--color-text-light)' },
    reportBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '999px', background: 'rgba(225,29,46,0.12)', color: 'var(--color-accent)', border: '1px solid rgba(225,29,46,0.2)' },
    reportGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' },
    reportCard: { background: '#fff', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', display: 'grid', gap: '1rem' },
    reportMetric: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1rem', color: 'var(--color-text-light)' },
    chartCard: { background: '#fff', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' },
    chartHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' },
    chartNote: { color: 'var(--color-text-light)', fontSize: '0.85rem' },
    chartBars: { display: 'flex', gap: '0.55rem', alignItems: 'flex-end', height: '170px' },
    chartBarWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', flex: 1, fontSize: '0.75rem', color: 'var(--color-text-light)' },
    chartBar: { width: '100%', borderRadius: '10px 10px 6px 6px', background: 'linear-gradient(180deg, var(--color-primary), var(--color-accent))', minHeight: '10px' },

    tableSection: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.2rem' },
    tableCard: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: '20px', boxShadow: 'var(--shadow-sm)', padding: '1.2rem' },
    tableTitle: { marginBottom: '0.7rem' },
    tableWrap: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-light)', fontSize: '0.8rem', textTransform: 'uppercase' },
    td: { padding: '10px 8px', borderBottom: '1px solid var(--color-border)' },
    emptyCell: { padding: '1rem', textAlign: 'center', color: 'var(--color-text-light)' },
    lowTag: { marginLeft: '8px', background: 'rgba(239,68,68,0.14)', color: '#dc2626', padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700' },

    alertCard: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: '20px', boxShadow: 'var(--shadow-sm)', padding: '1.2rem' },
    alertHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.7rem' },
    alertList: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
    alertItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '10px' },
    alertMeta: { color: 'var(--color-text-light)', fontSize: '0.82rem', marginTop: '2px' },
    alertWarn: { background: 'rgba(245,158,11,0.14)', color: '#b45309', padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700' },
    alertBad: { background: 'rgba(239,68,68,0.14)', color: '#dc2626', padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700' },
    emptyText: { color: 'var(--color-text-light)', fontSize: '0.9rem' },
};

export default ShopOwnerDashboard;
