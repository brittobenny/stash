import React from 'react';
import { MessageSquare } from 'lucide-react';
import '../styles/global.css';

const ShopOwnerFeedback = () => {
    const feedback = [
        { name: 'Sara V.', message: 'Great produce quality and quick delivery!', rating: 'Positive' },
        { name: 'Imran K.', message: 'Loved the packaging. Please add more dairy options.', rating: 'Suggestion' },
        { name: 'Priya S.', message: 'Order arrived fresh and on time.', rating: 'Positive' },
    ];

    return (
        <div style={styles.page}>
            <section style={styles.header}>
                <div>
                    <h1 style={styles.title}>Feedback</h1>
                    <p style={styles.subtitle}>What customers are saying about your shop.</p>
                </div>
                <div style={styles.reportBadge}>
                    <MessageSquare size={14} /> Weekly summary
                </div>
            </section>
            <div style={styles.feedbackGrid}>
                {feedback.map((item, index) => (
                    <div key={`${item.name}-${index}`} style={styles.feedbackCard}>
                        <div style={styles.feedbackHeader}>
                            <strong>{item.name}</strong>
                            <span style={styles.feedbackTag}>{item.rating}</span>
                        </div>
                        <p>{item.message}</p>
                    </div>
                ))}
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
    feedbackGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem' },
    feedbackCard: { background: '#fff', borderRadius: '18px', border: '1px solid var(--color-border)', padding: '1.2rem', boxShadow: 'var(--shadow-sm)', color: 'var(--color-text-light)' },
    feedbackHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', color: 'var(--color-text)' },
    feedbackTag: { background: 'rgba(17,17,17,0.08)', padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem' },
};

export default ShopOwnerFeedback;
