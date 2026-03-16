import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, UploadCloud, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { shopOwnerService } from '../services/api';
import '../styles/global.css';

const defaultAdjust = {
    product_id: '',
    change: '',
    reason: 'RESTOCK',
    note: '',
};

const ShopOwnerInventory = () => {
    const [products, setProducts] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [historyProduct, setHistoryProduct] = useState('');
    const [adjust, setAdjust] = useState(defaultAdjust);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadResult, setUploadResult] = useState(null);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [prodRes, historyRes] = await Promise.all([
                shopOwnerService.getMyProducts(),
                shopOwnerService.getStockHistory(historyProduct ? { product_id: historyProduct } : {}),
            ]);
            setProducts(prodRes.data || []);
            setHistory(historyRes.data || []);
        } catch (err) {
            setProducts([]);
            setHistory([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, [historyProduct]);

    const lowStock = useMemo(
        () => products.filter((p) => Number(p.stock_quantity || 0) <= Number(p.low_stock_threshold || 0)),
        [products]
    );

    const handleAdjustSubmit = async (e) => {
        e.preventDefault();
        if (!adjust.product_id || !adjust.change) return;
        try {
            await shopOwnerService.adjustStock({
                product_id: adjust.product_id,
                change: Number(adjust.change),
                reason: adjust.reason,
                note: adjust.note,
            });
            setAdjust(defaultAdjust);
            loadAll();
        } catch (err) {
            alert('Failed to adjust stock.');
        }
    };

    const handleUpload = async () => {
        if (!uploadFile) return;
        try {
            const res = await shopOwnerService.bulkUploadStock(uploadFile);
            setUploadResult(res.data);
            setUploadFile(null);
            loadAll();
        } catch (err) {
            alert('Bulk upload failed.');
        }
    };

    return (
        <div style={styles.page}>
            <section style={styles.header}>
                <div>
                    <h1 style={styles.title}>Inventory & Stock</h1>
                    <p style={styles.subtitle}>Track low stock, adjust quantities, and review stock history.</p>
                </div>
                <button style={styles.refreshBtn} onClick={loadAll} disabled={loading}>
                    <RefreshCw size={16} /> {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </section>

            <section style={styles.grid}>
                <div style={styles.card}>
                    <div style={styles.cardHeader}>
                        <div style={styles.cardTitle}>
                            <AlertTriangle size={18} />
                            Low Stock Alerts
                        </div>
                        <span style={styles.badge}>{lowStock.length}</span>
                    </div>
                    <div style={styles.alertList}>
                        {lowStock.length === 0 && <p style={styles.muted}>All items are healthy.</p>}
                        {lowStock.map((item) => (
                            <div key={item.id} style={styles.alertItem}>
                                <div>
                                    <strong>{item.name}</strong>
                                    <p style={styles.muted}>
                                        Stock {item.stock_quantity} · Threshold {item.low_stock_threshold}
                                    </p>
                                </div>
                                <span style={styles.alertPill}>
                                    {Number(item.stock_quantity) === 0 ? 'Out' : 'Low'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={styles.card}>
                    <div style={styles.cardHeader}>
                        <div style={styles.cardTitle}>Quick Stock Adjustment</div>
                        <span style={styles.helper}>Log restocks or corrections.</span>
                    </div>
                    <form onSubmit={handleAdjustSubmit} style={styles.form}>
                        <select
                            style={styles.input}
                            value={adjust.product_id}
                            onChange={(e) => setAdjust((prev) => ({ ...prev, product_id: e.target.value }))}
                            required
                        >
                            <option value="">Select product</option>
                            {products.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <div style={styles.row}>
                            <input
                                type="number"
                                style={styles.input}
                                placeholder="Change (+/-)"
                                value={adjust.change}
                                onChange={(e) => setAdjust((prev) => ({ ...prev, change: e.target.value }))}
                                required
                            />
                            <select
                                style={styles.input}
                                value={adjust.reason}
                                onChange={(e) => setAdjust((prev) => ({ ...prev, reason: e.target.value }))}
                            >
                                <option value="RESTOCK">Restock</option>
                                <option value="ADJUSTMENT">Adjustment</option>
                                <option value="BULK">Bulk Upload</option>
                            </select>
                        </div>
                        <input
                            style={styles.input}
                            placeholder="Note"
                            value={adjust.note}
                            onChange={(e) => setAdjust((prev) => ({ ...prev, note: e.target.value }))}
                        />
                        <button style={styles.primaryBtn} type="submit">Apply Change</button>
                    </form>
                </div>

                <div style={styles.card}>
                    <div style={styles.cardHeader}>
                        <div style={styles.cardTitle}>
                            <UploadCloud size={18} /> Bulk Upload CSV
                        </div>
                        <span style={styles.helper}>Use columns: product_id / name + stock_quantity or change.</span>
                    </div>
                    <div style={styles.uploadBox}>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        />
                        <button style={styles.secondaryBtn} onClick={handleUpload} disabled={!uploadFile}>
                            Upload & Apply
                        </button>
                    </div>
                    {uploadResult && (
                        <div style={styles.uploadResult}>
                            <strong>Updated:</strong> {uploadResult.updated?.length || 0}
                            <br />
                            <strong>Skipped:</strong> {uploadResult.skipped?.length || 0}
                        </div>
                    )}
                </div>
            </section>

            <section style={styles.historySection}>
                <div style={styles.historyHeader}>
                    <h2 style={styles.sectionTitle}>Stock History</h2>
                    <select
                        style={styles.input}
                        value={historyProduct}
                        onChange={(e) => setHistoryProduct(e.target.value)}
                    >
                        <option value="">All products</option>
                        {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
                <div style={styles.historyGrid}>
                    {history.length === 0 && <p style={styles.muted}>No stock movements logged yet.</p>}
                    {history.map((h) => (
                        <div key={h.id} style={styles.historyCard}>
                            <div style={styles.historyRow}>
                                <strong>{h.product_name}</strong>
                                <span style={h.change >= 0 ? styles.positive : styles.negative}>
                                    {h.change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                    {h.change}
                                </span>
                            </div>
                            <div style={styles.muted}>{h.reason} · {new Date(h.created_at).toLocaleString()}</div>
                            {h.note && <div style={styles.note}>{h.note}</div>}
                        </div>
                    ))}
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
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' },
    title: { fontSize: '2.2rem', color: 'var(--color-text)' },
    subtitle: { color: 'var(--color-text-light)' },
    refreshBtn: { background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.2rem', marginBottom: '2rem' },
    card: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: '20px', padding: '1.4rem', boxShadow: 'var(--shadow-sm)' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.6rem' },
    cardTitle: { display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 },
    badge: { background: 'rgba(239,68,68,0.12)', color: '#dc2626', borderRadius: '999px', padding: '4px 10px', fontSize: '0.8rem', fontWeight: 700 },
    helper: { color: 'var(--color-text-light)', fontSize: '0.85rem' },
    alertList: { display: 'grid', gap: '0.8rem' },
    alertItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '10px' },
    alertPill: { background: 'rgba(239,68,68,0.14)', color: '#dc2626', padding: '3px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 },
    muted: { color: 'var(--color-text-light)', fontSize: '0.9rem' },
    form: { display: 'grid', gap: '0.8rem' },
    row: { display: 'flex', gap: '0.8rem', flexWrap: 'wrap' },
    input: { padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)' },
    primaryBtn: { background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700 },
    secondaryBtn: { background: 'transparent', border: '1px solid var(--color-border)', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer' },
    uploadBox: { display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' },
    uploadResult: { marginTop: '0.8rem', fontSize: '0.9rem', color: 'var(--color-text)' },
    historySection: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: '22px', padding: '1.6rem', boxShadow: 'var(--shadow-sm)' },
    historyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' },
    sectionTitle: { fontSize: '1.5rem' },
    historyGrid: { display: 'grid', gap: '0.8rem' },
    historyCard: { border: '1px solid var(--color-border)', borderRadius: '14px', padding: '12px' },
    historyRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    positive: { color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 },
    negative: { color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 },
    note: { marginTop: '4px', color: 'var(--color-text-light)' },
};

export default ShopOwnerInventory;
