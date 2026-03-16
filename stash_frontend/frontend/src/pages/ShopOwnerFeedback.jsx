import React, { useEffect, useState } from 'react';
import { MessageSquare, RefreshCcw } from 'lucide-react';
import { shopOwnerService } from '../services/api';
import '../styles/global.css';

const ShopOwnerFeedback = () => {
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await shopOwnerService.getFeedback();
            setFeedback(res.data || []);
        } catch (err) {
            setError('Failed to load feedback.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

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
            <div style={styles.feedbackGrid}>
                {feedback.map((item, index) => (
                    <div key={item.id || index} style={styles.feedbackCard}>
                        <div style={styles.feedbackHeader}>
                            <strong>{item.user_name || 'Customer'}</strong>
                            <span style={styles.feedbackTag}>{item.status || 'OPEN'}</span>
                        </div>
                        <div style={styles.feedbackMeta}>Rating: {item.rating || 0}/5</div>
                        {item.title && <div style={styles.feedbackTitle}>{item.title}</div>}
                        <p>{item.message}</p>
                    </div>
                ))}
                {feedback.length === 0 && (
                    <div style={styles.empty}>No feedback yet.</div>
                )}
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
    feedbackGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem' },
    feedbackCard: { background: '#fff', borderRadius: '18px', border: '1px solid var(--color-border)', padding: '1.2rem', boxShadow: 'var(--shadow-sm)', color: 'var(--color-text-light)' },
    feedbackHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', color: 'var(--color-text)' },
    feedbackTag: { background: 'rgba(17,17,17,0.08)', padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem' },
    feedbackMeta: { fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: '0.4rem' },
    feedbackTitle: { fontWeight: 700, marginBottom: '0.4rem', color: 'var(--color-text)' },
    empty: { gridColumn: '1/-1', padding: '1rem', textAlign: 'center', color: 'var(--color-text-light)' },
};

export default ShopOwnerFeedback;
