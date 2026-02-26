import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { accountService } from '../services/api';
import '../styles/global.css';

const Notifications = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await accountService.getNotifications();
                setNotifications(res.data || []);
            } catch (err) {
                setError('Failed to load notifications.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleMarkRead = async (id) => {
        try {
            await accountService.markNotificationRead(id);
            setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
        } catch (err) {
            setError('Failed to update notification.');
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await accountService.markAllNotificationsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } catch (err) {
            setError('Failed to update notifications.');
        }
    };

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return (
        <div style={styles.page}>
            <div style={styles.headerRow}>
                <button style={styles.backBtn} onClick={() => navigate('/customer/account')}>
                    <ArrowLeft size={16} /> Back to Account
                </button>
                <button style={styles.markAllBtn} onClick={handleMarkAllRead} disabled={notifications.length === 0}>
                    Mark all read
                </button>
            </div>

            <div style={styles.titleCard}>
                <div style={styles.titleIcon}>
                    <Bell size={20} />
                </div>
                <div>
                    <h1 style={styles.title}>Notifications</h1>
                    <p style={styles.subtitle}>{unreadCount} unread · {notifications.length} total</p>
                </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}
            {loading ? (
                <div style={styles.loading}>Loading notifications...</div>
            ) : notifications.length === 0 ? (
                <div style={styles.empty}>You are all caught up.</div>
            ) : (
                <div style={styles.list}>
                    {notifications.map((n) => (
                        <div key={n.id} style={{ ...styles.item, opacity: n.is_read ? 0.6 : 1 }}>
                            <div style={styles.itemLeft}>
                                <div style={styles.itemTitle}>{n.title}</div>
                                <div style={styles.itemMessage}>{n.message}</div>
                                <div style={styles.itemMeta}>{new Date(n.created_at).toLocaleString()}</div>
                            </div>
                            {!n.is_read && (
                                <button style={styles.itemBtn} onClick={() => handleMarkRead(n.id)}>
                                    <CheckCircle2 size={14} /> Mark read
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const styles = {
    page: { width: '100%', padding: '2rem 2.5rem' },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
    backBtn: { background: 'none', border: 'none', color: 'var(--color-text-light)', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
    markAllBtn: { background: 'transparent', border: '1px solid var(--color-border)', padding: '8px 14px', borderRadius: '999px', cursor: 'pointer', fontWeight: 600 },
    titleCard: { display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1.2rem', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem' },
    titleIcon: { width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(225,29,46,0.12)', color: 'var(--color-primary)' },
    title: { fontSize: '1.6rem', marginBottom: '0.2rem' },
    subtitle: { color: 'var(--color-text-light)' },
    error: { background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1rem' },
    loading: { color: 'var(--color-text-light)' },
    empty: { background: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: '16px', padding: '1.6rem', textAlign: 'center', color: 'var(--color-text-light)' },
    list: { display: 'flex', flexDirection: 'column', gap: '0.8rem' },
    item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: '14px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)' },
    itemLeft: { flex: 1 },
    itemTitle: { fontWeight: 700, marginBottom: '0.2rem' },
    itemMessage: { color: 'var(--color-text-light)' },
    itemMeta: { fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: '0.3rem' },
    itemBtn: { background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' },
};

export default Notifications;
