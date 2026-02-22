import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Shield, PackageCheck, Flame, Activity, Package, Bell } from 'lucide-react';
import { pantryService, shopService, inventoryService, accountService, nutritionService } from '../services/api';
import '../styles/global.css';

const Profile = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [profileComplete, setProfileComplete] = useState(true);
    const [profileForm, setProfileForm] = useState({ address: '', location: '', mobile_number: '' });
    const [savingProfile, setSavingProfile] = useState(false);
    const [metrics, setMetrics] = useState({
        pantryCount: 0,
        ordersCount: 0,
        cookedCount: 0,
        caloriesToday: 0,
        todayScore: 0,
        weeklyScore: 0,
        points: 0,
        level: 1,
        streak: 0,
        lastCookedText: 'No activity',
    });
    const [usage, setUsage] = useState([]);
    const [nutritionProfile, setNutritionProfile] = useState({
        calorie_goal: 2000,
        protein_goal: 90,
        carb_goal: 250,
        fat_goal: 70,
    });
    const [nutritionProgress, setNutritionProgress] = useState({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
    });
    const [notifications, setNotifications] = useState([]);
    const [notifLoading, setNotifLoading] = useState(false);
    const [notifError, setNotifError] = useState('');

    useEffect(() => {
        // Fetch user from localStorage or API
        // Currently API doesn't have a /me endpoint so we rely on what we saved or mock it
        // Ideally, we should pull from an API. For now, let's look at localStorage 'user' if we saved it in Login.jsx
        // Note: In Login.jsx I haven't saved the user object yet, only role/token. 
        // I will need to update Login.jsx to save the User object stringified.

        const loadProfile = async () => {
            try {
                const res = await accountService.getProfile();
                const data = res.data || {};
                setUser({
                    name: data.name,
                    email: data.email,
                    mobile_number: data.mobile_number,
                    role: data.role,
                    address: data.address,
                    location: data.location,
                });
                setProfileComplete(Boolean(data.profile_completed));
                setProfileForm({
                    address: data.address || '',
                    location: data.location || '',
                    mobile_number: data.mobile_number || '',
                });
                localStorage.setItem('user', JSON.stringify({
                    name: data.name,
                    email: data.email,
                    role: data.role,
                    mobile_number: data.mobile_number,
                    address: data.address,
                    location: data.location,
                    profile_completed: data.profile_completed,
                }));
            } catch (err) {
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    setUser(JSON.parse(storedUser));
                } else {
                    setUser({
                        name: 'Guest User',
                        email: 'user@example.com',
                        mobile_number: 'N/A',
                        role: localStorage.getItem('role') || 'Customer'
                    });
                }
            }
        };
        loadProfile();
    }, []);

    useEffect(() => {
        const loadMetrics = async () => {
            try {
                const today = new Date().toISOString().slice(0, 10);
                const [pantryRes, ordersRes, usageRes, nutritionSummaryRes, todayScoreRes, cookedRes] = await Promise.all([
                    pantryService.getItems(),
                    shopService.listOrders(),
                    inventoryService.listUsage(),
                    nutritionService.getProfileSummary(),
                    nutritionService.getDailyScores({ start: today, end: today }),
                    nutritionService.getCookedHistory({ limit: 200 }),
                ]);
                const summary = nutritionSummaryRes.data || {};
                const todayEntry = (todayScoreRes.data || [])[0] || null;
                const cookedEntries = cookedRes.data || [];
                const lastCookedAt = cookedEntries.length > 0 ? new Date(cookedEntries[0].cooked_at) : null;
                setMetrics({
                    pantryCount: pantryRes.data?.length || 0,
                    ordersCount: ordersRes.data?.length || 0,
                    cookedCount: cookedEntries.length,
                    caloriesToday: Math.round(Number(todayEntry?.total_calories || 0)),
                    todayScore: Number(summary.today_score || 0),
                    weeklyScore: Number(summary.weekly_score || 0),
                    points: Number(summary.points || 0),
                    level: Number(summary.level || 1),
                    streak: Number(summary.current_streak || 0),
                    lastCookedText: lastCookedAt ? lastCookedAt.toLocaleDateString() : 'No activity',
                });
                if (todayEntry) {
                    setNutritionProgress({
                        calories: Number(todayEntry.total_calories || 0),
                        protein: Number(todayEntry.total_protein || 0),
                        carbs: Number(todayEntry.total_carbs || 0),
                        fat: Number(todayEntry.total_fats || 0),
                    });
                } else {
                    setNutritionProgress({ calories: 0, protein: 0, carbs: 0, fat: 0 });
                }
                const usageList = (usageRes.data || [])
                    .filter((u) => Number(u.quantity || 0) > 0)
                    .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))
                    .slice(0, 6);
                setUsage(usageList);
            } catch (err) {
                setMetrics((prev) => ({ ...prev }));
            }
        };
        loadMetrics();
    }, []);

    useEffect(() => {
        const loadNotifications = async () => {
            setNotifLoading(true);
            setNotifError('');
            try {
                const res = await accountService.getNotifications();
                setNotifications(res.data || []);
            } catch (err) {
                setNotifError('Failed to load notifications.');
            } finally {
                setNotifLoading(false);
            }
        };
        loadNotifications();
    }, []);

    const macroBars = [
        { label: 'Calories', value: nutritionProgress.calories, goal: nutritionProfile.calorie_goal, color: 'var(--color-primary)' },
        { label: 'Protein', value: nutritionProgress.protein, goal: nutritionProfile.protein_goal, color: 'var(--color-primary)' },
        { label: 'Carbs', value: nutritionProgress.carbs, goal: nutritionProfile.carb_goal, color: 'var(--color-primary)' },
        { label: 'Fat', value: nutritionProgress.fat, goal: nutritionProfile.fat_goal, color: 'var(--color-primary)' },
    ];

    const maxUsage = Math.max(...usage.map((u) => Number(u.quantity || 0)), 1);

    const handleProfileSave = async () => {
        setSavingProfile(true);
        try {
            const res = await accountService.updateProfile(profileForm);
            const data = res.data || {};
            setUser((prev) => ({ ...prev, ...data }));
            setProfileComplete(Boolean(data.profile_completed));
            localStorage.setItem('user', JSON.stringify({
                name: data.name,
                email: data.email,
                role: data.role,
                mobile_number: data.mobile_number,
                address: data.address,
                location: data.location,
                profile_completed: data.profile_completed,
            }));
        } catch (err) {
            alert('Failed to update profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleMarkRead = async (id) => {
        try {
            await accountService.markNotificationRead(id);
            setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
        } catch (err) {
            setNotifError('Failed to update notification.');
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await accountService.markAllNotificationsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } catch (err) {
            setNotifError('Failed to update notifications.');
        }
    };

    if (!user) return <div style={{ padding: '2rem' }}>Loading profile...</div>;

    return (
        <div style={styles.page}>
            {!profileComplete && (
                <div style={styles.alert}>
                    Your profile is incomplete. Please add your address and location to place orders.
                </div>
            )}
            <div style={styles.grid}>
                <div style={styles.card}>
                    <div style={styles.header}>
                        <div style={styles.avatar}>
                            <User size={40} color="var(--color-accent)" />
                        </div>
                        <h1 style={styles.name}>{user.name || 'Stash User'}</h1>
                        <span style={styles.roleBadge}>{user.role}</span>
                    </div>

                    <div style={styles.details}>
                        <div style={styles.row}>
                            <Mail size={20} style={styles.icon} />
                            <div>
                                <label style={styles.label}>Email</label>
                                <p style={styles.value}>{user.email}</p>
                            </div>
                        </div>
                        <div style={styles.row}>
                            <Phone size={20} style={styles.icon} />
                            <div>
                                <label style={styles.label}>Mobile</label>
                                <p style={styles.value}>{user.mobile_number || 'Not provided'}</p>
                            </div>
                        </div>
                        <div style={styles.row}>
                            <Shield size={20} style={styles.icon} />
                            <div>
                                <label style={styles.label}>Address</label>
                                <p style={styles.value}>{user.address || 'Not provided'}</p>
                            </div>
                        </div>
                        <div style={styles.row}>
                            <Shield size={20} style={styles.icon} />
                            <div>
                                <label style={styles.label}>Location</label>
                                <p style={styles.value}>{user.location || 'Not provided'}</p>
                            </div>
                        </div>
                        <div style={styles.row}>
                            <Shield size={20} style={styles.icon} />
                            <div>
                                <label style={styles.label}>Account Type</label>
                                <p style={styles.value}>{user.role}</p>
                            </div>
                        </div>
                        <button style={styles.ordersBtn} onClick={() => navigate('/customer/orders')}>
                            <PackageCheck size={18} /> View Orders
                        </button>
                    </div>
                </div>

                <div style={styles.dashboard}>
                    <h2 style={styles.dashboardTitle}>Your Dashboard</h2>
                    <div style={styles.metrics}>
                        <div style={styles.metricCard}>
                            <Package size={18} />
                            <div>
                                <p style={styles.metricLabel}>Pantry Items</p>
                                <p style={styles.metricValue}>{metrics.pantryCount}</p>
                            </div>
                        </div>
                        <div style={styles.metricCard}>
                            <PackageCheck size={18} />
                            <div>
                                <p style={styles.metricLabel}>Orders</p>
                                <p style={styles.metricValue}>{metrics.ordersCount}</p>
                            </div>
                        </div>
                        <div style={styles.metricCard}>
                            <Activity size={18} />
                            <div>
                                <p style={styles.metricLabel}>Recipes Cooked</p>
                                <p style={styles.metricValue}>{metrics.cookedCount}</p>
                            </div>
                        </div>
                        <div style={styles.metricCard}>
                            <Flame size={18} />
                            <div>
                                <p style={styles.metricLabel}>Calories Today</p>
                                <p style={styles.metricValue}>{metrics.caloriesToday}</p>
                            </div>
                        </div>
                        <div style={styles.metricCard}>
                            <Activity size={18} />
                            <div>
                                <p style={styles.metricLabel}>Today Score</p>
                                <p style={styles.metricValue}>{Math.round(metrics.todayScore)}</p>
                            </div>
                        </div>
                        <div style={styles.metricCard}>
                            <Activity size={18} />
                            <div>
                                <p style={styles.metricLabel}>Weekly Avg</p>
                                <p style={styles.metricValue}>{Math.round(metrics.weeklyScore)}</p>
                            </div>
                        </div>
                        <div style={styles.metricCard}>
                            <Activity size={18} />
                            <div>
                                <p style={styles.metricLabel}>Level / Points</p>
                                <p style={styles.metricValue}>L{metrics.level} · {metrics.points}</p>
                            </div>
                        </div>
                        <div style={styles.metricCard}>
                            <Activity size={18} />
                            <div>
                                <p style={styles.metricLabel}>Streak</p>
                                <p style={styles.metricValue}>{metrics.streak} days</p>
                            </div>
                        </div>
                    </div>

                    <div style={styles.usageCard}>
                        <h3 style={styles.usageTitle}>Usage Snapshot</h3>
                        <div style={styles.usageRow}>
                            <span>Inventory tracked</span>
                            <span>{metrics.pantryCount} ingredients</span>
                        </div>
                        <div style={styles.usageRow}>
                            <span>Last cooked</span>
                            <span>{metrics.lastCookedText}</span>
                        </div>
                        <div style={styles.usageRow}>
                            <span>Orders in progress</span>
                            <span>{metrics.ordersCount}</span>
                        </div>
                    </div>

                    <div style={styles.charts}>
                        <div style={styles.chartCard}>
                            <h3 style={styles.chartTitle}>Goal Progress</h3>
                            {macroBars.map((bar) => {
                                const pct = Math.min(100, Math.round((Number(bar.value || 0) / Math.max(Number(bar.goal || 1), 1)) * 100));
                                return (
                                    <div key={bar.label} style={styles.barRow}>
                                        <div style={styles.barLabel}>
                                            <span>{bar.label}</span>
                                            <span>{Math.round(bar.value)} / {bar.goal}</span>
                                        </div>
                                        <div style={styles.barTrack}>
                                            <div style={{ ...styles.barFill, width: `${pct}%`, background: bar.color }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={styles.chartCard}>
                            <h3 style={styles.chartTitle}>Top Used Ingredients</h3>
                            {usage.length === 0 ? (
                                <p style={styles.chartEmpty}>Cook a recipe to see usage trends here.</p>
                            ) : (
                                usage.map((item) => {
                                    const pct = Math.min(100, Math.round((Number(item.quantity || 0) / maxUsage) * 100));
                                    return (
                                        <div key={item.id} style={styles.barRow}>
                                            <div style={styles.barLabel}>
                                                <span>{item.ingredient_name || 'Ingredient'}</span>
                                                <span>{Math.round(Number(item.quantity || 0))} {item.unit || ''}</span>
                                            </div>
                                            <div style={styles.barTrack}>
                                            <div style={{ ...styles.barFill, width: `${pct}%`, background: 'var(--color-primary)' }}></div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    <div style={styles.profileCard}>
                        <h3 style={styles.chartTitle}>Complete Profile</h3>
                        <div style={styles.profileForm}>
                            <label style={styles.label}>Mobile Number</label>
                            <input
                                style={styles.input}
                                value={profileForm.mobile_number}
                                onChange={(e) => setProfileForm((prev) => ({ ...prev, mobile_number: e.target.value }))}
                                placeholder="Enter mobile number"
                            />
                            <label style={styles.label}>Address</label>
                            <input
                                style={styles.input}
                                value={profileForm.address}
                                onChange={(e) => setProfileForm((prev) => ({ ...prev, address: e.target.value }))}
                                placeholder="Street / Address"
                            />
                            <label style={styles.label}>Location</label>
                            <input
                                style={styles.input}
                                value={profileForm.location}
                                onChange={(e) => setProfileForm((prev) => ({ ...prev, location: e.target.value }))}
                                placeholder="City / Area"
                            />
                            <button style={styles.saveBtn} onClick={handleProfileSave} disabled={savingProfile}>
                                {savingProfile ? 'Saving...' : 'Save Profile'}
                            </button>
                        </div>
                    </div>

                    <div style={styles.notificationsCard}>
                        <div style={styles.notificationsHeader}>
                            <h3 style={styles.chartTitle}><Bell size={18} /> Notifications</h3>
                            <button style={styles.markAllBtn} onClick={handleMarkAllRead}>
                                Mark all read
                            </button>
                        </div>
                        {notifError && <div style={styles.notifError}>{notifError}</div>}
                        {notifLoading ? (
                            <div style={styles.notifLoading}>Loading notifications...</div>
                        ) : notifications.length === 0 ? (
                            <div style={styles.notifEmpty}>You're all caught up.</div>
                        ) : (
                            <div style={styles.notifList}>
                                {notifications.map((n) => (
                                    <div key={n.id} style={{ ...styles.notifItem, opacity: n.is_read ? 0.6 : 1 }}>
                                        <div>
                                            <div style={styles.notifTitle}>{n.title}</div>
                                            <div style={styles.notifMessage}>{n.message}</div>
                                            <div style={styles.notifMeta}>{new Date(n.created_at).toLocaleString()}</div>
                                        </div>
                                        {!n.is_read && (
                                            <button style={styles.notifBtn} onClick={() => handleMarkRead(n.id)}>
                                                Mark read
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const styles = {
    page: { width: '100%', margin: 0, padding: '2rem 2.5rem' },
    alert: { background: 'rgba(225,29,46,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(225,29,46,0.2)', padding: '12px 16px', borderRadius: '12px', marginBottom: '1.5rem', fontWeight: '600' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' },
    card: { background: 'var(--color-surface)', borderRadius: '20px', boxShadow: 'var(--shadow-md)', overflow: 'hidden', border: '1px solid var(--color-border)' },
    header: { background: '#f6f1e7', padding: '3rem 2rem', textAlign: 'center', color: 'var(--color-text)' },
    avatar: { width: '80px', height: '80px', background: 'rgba(225,29,46,0.18)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' },
    name: { fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem' },
    roleBadge: { background: 'rgba(225,29,46,0.15)', color: 'var(--color-accent)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.9rem', textTransform: 'capitalize' },
    details: { padding: '2rem' },
    row: { display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' },
    icon: { color: 'var(--color-primary)' },
    label: { fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: '4px', display: 'block' },
    value: { fontSize: '1.1rem', fontWeight: '500', color: 'var(--color-text)' },
    ordersBtn: { marginTop: '0.5rem', background: 'var(--color-primary)', color: '#ffffff', border: 'none', padding: '10px 14px', borderRadius: '10px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
    dashboard: { background: 'var(--color-surface)', borderRadius: '20px', border: '1px solid var(--color-border)', padding: '2rem', boxShadow: 'var(--shadow-md)' },
    dashboardTitle: { fontSize: '1.6rem', marginBottom: '1.5rem' },
    metrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' },
    metricCard: { display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'var(--color-surface-2)', padding: '0.9rem', borderRadius: '14px', border: '1px solid var(--color-border)' },
    metricLabel: { fontSize: '0.85rem', color: 'var(--color-text-light)' },
    metricValue: { fontSize: '1.2rem', fontWeight: '700' },
    usageCard: { background: 'var(--color-surface-2)', borderRadius: '16px', padding: '1rem', border: '1px solid var(--color-border)' },
    usageTitle: { fontSize: '1.1rem', marginBottom: '0.8rem' },
    usageRow: { display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-light)', marginBottom: '0.4rem' },
    charts: { marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' },
    chartCard: { background: 'var(--color-surface)', borderRadius: '16px', padding: '1rem', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' },
    chartTitle: { fontSize: '1.05rem', marginBottom: '0.8rem' },
    barRow: { marginBottom: '0.8rem' },
    barLabel: { display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: '0.3rem' },
    barTrack: { background: 'var(--color-surface-2)', borderRadius: '999px', height: '8px', overflow: 'hidden', border: '1px solid var(--color-border)' },
    barFill: { height: '100%', borderRadius: '999px' },
    chartEmpty: { color: 'var(--color-text-light)', fontSize: '0.9rem' },
    profileCard: { marginTop: '1.5rem', background: 'var(--color-surface-2)', borderRadius: '16px', padding: '1rem', border: '1px solid var(--color-border)' },
    profileForm: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
    input: { padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border)', background: '#fff' },
    saveBtn: { marginTop: '0.6rem', background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' },
    notificationsCard: { marginTop: '1.5rem', background: 'var(--color-surface)', borderRadius: '16px', padding: '1.2rem', border: '1px solid var(--color-border)' },
    notificationsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', gap: '0.8rem' },
    markAllBtn: { background: 'transparent', border: '1px solid var(--color-border)', padding: '6px 10px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.85rem' },
    notifList: { display: 'flex', flexDirection: 'column', gap: '0.8rem' },
    notifItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.9rem', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)' },
    notifTitle: { fontWeight: '700', marginBottom: '0.2rem' },
    notifMessage: { color: 'var(--color-text-light)' },
    notifMeta: { fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: '0.2rem' },
    notifBtn: { background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.85rem' },
    notifLoading: { color: 'var(--color-text-light)' },
    notifEmpty: { color: 'var(--color-text-light)' },
    notifError: { background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' },
};

export default Profile;
