import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Shield, PackageCheck, Flame, Activity, Package } from 'lucide-react';
import { pantryService, shopService, inventoryService } from '../services/api';
import '../styles/global.css';

const Profile = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [metrics, setMetrics] = useState({
        pantryCount: 0,
        ordersCount: 0,
        cookedCount: 0,
        caloriesToday: 0,
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

    useEffect(() => {
        // Fetch user from localStorage or API
        // Currently API doesn't have a /me endpoint so we rely on what we saved or mock it
        // Ideally, we should pull from an API. For now, let's look at localStorage 'user' if we saved it in Login.jsx
        // Note: In Login.jsx I haven't saved the user object yet, only role/token. 
        // I will need to update Login.jsx to save the User object stringified.

        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        } else {
            // Fallback or fetch if I implement /me later
            // For now, let's show a placeholder if missing
            setUser({
                name: 'Guest User',
                email: 'user@example.com',
                mobile_number: 'N/A',
                role: localStorage.getItem('role') || 'Customer'
            });
        }
    }, []);

    useEffect(() => {
        const storedProfile = JSON.parse(localStorage.getItem('nutrition_profile') || '{}');
        if (storedProfile.calorie_goal) {
            setNutritionProfile((prev) => ({ ...prev, ...storedProfile }));
        }
        const today = new Date().toISOString().slice(0, 10);
        const prog = JSON.parse(localStorage.getItem('nutrition_progress') || '{}');
        if (prog.date === today) {
            setNutritionProgress({
                calories: Number(prog.calories || 0),
                protein: Number(prog.protein || 0),
                carbs: Number(prog.carbs || 0),
                fat: Number(prog.fat || 0),
            });
        }
    }, []);

    useEffect(() => {
        const loadMetrics = async () => {
            try {
                const [pantryRes, ordersRes, usageRes] = await Promise.all([
                    pantryService.getItems(),
                    shopService.listOrders(),
                    inventoryService.listUsage(),
                ]);
                const cookedCount = parseInt(localStorage.getItem('cooked_count') || '0', 10);
                const progress = JSON.parse(localStorage.getItem('nutrition_progress') || '{}');
                setMetrics({
                    pantryCount: pantryRes.data?.length || 0,
                    ordersCount: ordersRes.data?.length || 0,
                    cookedCount,
                    caloriesToday: Math.round(Number(progress.calories || 0)),
                });
                const usageList = (usageRes.data || [])
                    .filter((u) => Number(u.quantity || 0) > 0)
                    .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))
                    .slice(0, 6);
                setUsage(usageList);
            } catch (err) {
                const cookedCount = parseInt(localStorage.getItem('cooked_count') || '0', 10);
                setMetrics((prev) => ({ ...prev, cookedCount }));
            }
        };
        loadMetrics();
    }, []);

    const macroBars = [
        { label: 'Calories', value: nutritionProgress.calories, goal: nutritionProfile.calorie_goal, color: 'var(--color-primary)' },
        { label: 'Protein', value: nutritionProgress.protein, goal: nutritionProfile.protein_goal, color: 'var(--color-primary)' },
        { label: 'Carbs', value: nutritionProgress.carbs, goal: nutritionProfile.carb_goal, color: 'var(--color-primary)' },
        { label: 'Fat', value: nutritionProgress.fat, goal: nutritionProfile.fat_goal, color: 'var(--color-primary)' },
    ];

    const maxUsage = Math.max(...usage.map((u) => Number(u.quantity || 0)), 1);

    if (!user) return <div style={{ padding: '2rem' }}>Loading profile...</div>;

    return (
        <div style={styles.page}>
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
                    </div>

                    <div style={styles.usageCard}>
                        <h3 style={styles.usageTitle}>Usage Snapshot</h3>
                        <div style={styles.usageRow}>
                            <span>Inventory tracked</span>
                            <span>{metrics.pantryCount} ingredients</span>
                        </div>
                        <div style={styles.usageRow}>
                            <span>Last cooked</span>
                            <span>{metrics.cookedCount > 0 ? 'Today' : 'No activity'}</span>
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
                </div>
            </div>
        </div>
    );
};

const styles = {
    page: { maxWidth: '1100px', margin: '0 auto', padding: '2rem' },
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
};

export default Profile;
