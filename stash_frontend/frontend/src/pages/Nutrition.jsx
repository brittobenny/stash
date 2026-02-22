import React, { useEffect, useState } from 'react';
import { Activity, Flame, Leaf, RefreshCw, Trophy, CalendarDays } from 'lucide-react';
import { nutritionService } from '../services/api';
import '../styles/global.css';

const Nutrition = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [summary, setSummary] = useState(null);
    const [daily, setDaily] = useState([]);
    const [weekly, setWeekly] = useState([]);
    const [rewards, setRewards] = useState([]);
    const [cooked, setCooked] = useState([]);

    const loadNutrition = async () => {
        setLoading(true);
        setError('');
        try {
            const [summaryRes, dailyRes, weeklyRes, rewardsRes, cookedRes] = await Promise.all([
                nutritionService.getProfileSummary(),
                nutritionService.getDailyScores({}),
                nutritionService.getWeeklyScores({ weeks: 10 }),
                nutritionService.getRewards({ limit: 20 }),
                nutritionService.getCookedHistory({ limit: 20 }),
            ]);
            setSummary(summaryRes.data || null);
            setDaily(dailyRes.data || []);
            setWeekly(weeklyRes.data || []);
            setRewards(rewardsRes.data || []);
            setCooked(cookedRes.data || []);
        } catch (err) {
            setError('Failed to load nutrition insights.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNutrition();
    }, []);

    const today = daily[0] || null;

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <div>
                    <h1 style={styles.title}>Nutrition Scores</h1>
                    <p style={styles.subtitle}>Daily and weekly balance, tracked automatically from cooked recipes.</p>
                </div>
                <button style={styles.refreshBtn} onClick={loadNutrition} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </header>

            {error && <div style={styles.error}>{error}</div>}

            <section style={styles.cards}>
                <div style={styles.card}>
                    <div style={styles.iconWrap}><Activity size={18} /></div>
                    <div>
                        <div style={styles.label}>Today Score</div>
                        <div style={styles.value}>{summary?.today_score ?? 0}</div>
                    </div>
                </div>
                <div style={styles.card}>
                    <div style={styles.iconWrap}><CalendarDays size={18} /></div>
                    <div>
                        <div style={styles.label}>Weekly Avg</div>
                        <div style={styles.value}>{Math.round(summary?.weekly_score ?? 0)}</div>
                    </div>
                </div>
                <div style={styles.card}>
                    <div style={styles.iconWrap}><Trophy size={18} /></div>
                    <div>
                        <div style={styles.label}>Level / Points</div>
                        <div style={styles.value}>L{summary?.level ?? 1} · {summary?.points ?? 0}</div>
                    </div>
                </div>
                <div style={styles.card}>
                    <div style={styles.iconWrap}><Leaf size={18} /></div>
                    <div>
                        <div style={styles.label}>Streak / Badges</div>
                        <div style={styles.value}>{summary?.current_streak ?? 0}d · {summary?.healthy_week_badges ?? 0}</div>
                    </div>
                </div>
            </section>

            <section style={styles.panel}>
                <h2 style={styles.sectionTitle}>Today Totals</h2>
                {today ? (
                    <div style={styles.macroGrid}>
                        <div style={styles.macroCard}><Flame size={16} /> {Math.round(today.total_calories || 0)} kcal</div>
                        <div style={styles.macroCard}>Protein {Math.round(today.total_protein || 0)} g</div>
                        <div style={styles.macroCard}>Carbs {Math.round(today.total_carbs || 0)} g</div>
                        <div style={styles.macroCard}>Fats {Math.round(today.total_fats || 0)} g</div>
                        <div style={styles.macroCard}>Vegetables {Number(today.total_vegetable_servings || 0).toFixed(1)} servings</div>
                    </div>
                ) : (
                    <div style={styles.empty}>No cooked recipes logged today.</div>
                )}
            </section>

            <section style={styles.grid2}>
                <div style={styles.panel}>
                    <h2 style={styles.sectionTitle}>Daily History</h2>
                    {daily.length === 0 ? (
                        <div style={styles.empty}>No daily history yet.</div>
                    ) : (
                        <div style={styles.list}>
                            {daily.map((d) => (
                                <div key={d.date} style={styles.row}>
                                    <span>{d.date}</span>
                                    <span style={styles.rowMeta}>Score {d.score}</span>
                                    <span style={d.balanced ? styles.good : styles.warn}>{d.balanced ? 'Balanced' : 'Needs work'}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={styles.panel}>
                    <h2 style={styles.sectionTitle}>Weekly History</h2>
                    {weekly.length === 0 ? (
                        <div style={styles.empty}>No weekly history yet.</div>
                    ) : (
                        <div style={styles.list}>
                            {weekly.map((w) => (
                                <div key={w.week_start} style={styles.row}>
                                    <span>{w.week_start} - {w.week_end}</span>
                                    <span style={styles.rowMeta}>Avg {Math.round(w.average_score || 0)}</span>
                                    <span style={styles.rowMeta}>{w.days_tracked} days</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <section style={styles.grid2}>
                <div style={styles.panel}>
                    <h2 style={styles.sectionTitle}>Rewards</h2>
                    {rewards.length === 0 ? (
                        <div style={styles.empty}>No rewards yet.</div>
                    ) : (
                        <div style={styles.list}>
                            {rewards.map((r) => (
                                <div key={r.id} style={styles.rewardRow}>
                                    <div>
                                        <div style={styles.rewardTitle}>{r.title}</div>
                                        <div style={styles.rewardMeta}>{new Date(r.awarded_at).toLocaleString()}</div>
                                    </div>
                                    <div style={styles.rewardPoints}>+{r.points}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={styles.panel}>
                    <h2 style={styles.sectionTitle}>Cooked Recipes</h2>
                    {cooked.length === 0 ? (
                        <div style={styles.empty}>No cooked recipes logged yet.</div>
                    ) : (
                        <div style={styles.list}>
                            {cooked.map((c) => (
                                <div key={c.id} style={styles.row}>
                                    <span>{c.recipe_name}</span>
                                    <span style={styles.rowMeta}>{Math.round(c.calories || 0)} kcal</span>
                                    <span style={styles.rowMeta}>{new Date(c.cooked_at).toLocaleDateString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

const styles = {
    page: { maxWidth: '1150px', margin: '0 auto', padding: '2rem' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' },
    title: { fontSize: '2.2rem', color: 'var(--color-text)' },
    subtitle: { color: 'var(--color-text-light)' },
    refreshBtn: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '10px 14px', display: 'inline-flex', gap: '8px', alignItems: 'center', cursor: 'pointer' },
    error: { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '10px 12px', marginBottom: '1rem' },
    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.2rem' },
    card: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' },
    iconWrap: { width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(225,29,46,0.12)', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    label: { color: 'var(--color-text-light)', fontSize: '0.82rem' },
    value: { fontWeight: '700', fontSize: '1.1rem' },
    panel: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1rem', marginBottom: '1rem' },
    sectionTitle: { marginBottom: '0.7rem' },
    macroGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem' },
    macroCard: { background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '8px 12px', display: 'inline-flex', gap: '6px', alignItems: 'center' },
    grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' },
    list: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
    row: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '8px 10px' },
    rowMeta: { color: 'var(--color-text-light)', fontSize: '0.86rem', textAlign: 'right' },
    good: { justifySelf: 'end', color: '#177245', fontWeight: '700', fontSize: '0.85rem' },
    warn: { justifySelf: 'end', color: '#b45309', fontWeight: '700', fontSize: '0.85rem' },
    rewardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '8px 10px' },
    rewardTitle: { fontWeight: '700' },
    rewardMeta: { color: 'var(--color-text-light)', fontSize: '0.8rem' },
    rewardPoints: { color: 'var(--color-primary)', fontWeight: '700' },
    empty: { color: 'var(--color-text-light)', padding: '8px 0' },
};

export default Nutrition;
