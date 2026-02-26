import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Flame, Leaf, RefreshCw, Trophy, CalendarDays, BarChart3 } from 'lucide-react';
import { nutritionService } from '../services/api';
import '../styles/global.css';

const GOALS = {
    calories: 2000,
    protein: 150,
    carbs: 250,
    fats: 70,
    vegetables: 5,
};

const clampPct = (value, max = 100) => {
    if (!max || max <= 0) return 0;
    const pct = (Number(value || 0) / max) * 100;
    return Math.max(0, Math.min(100, pct));
};

const MeterCard = ({ label, value, unit, max = 100, color = '#e11d2e', helper }) => {
    const pct = clampPct(value, max);
    return (
        <div style={styles.meterCard} className="hover-lift fade-up">
            <div style={styles.meterRing} className="pulse-soft" aria-hidden="true">
                <div style={{ ...styles.meterStroke, background: `conic-gradient(${color} ${pct}%, #2a2a2a ${pct}% 100%)` }} />
                <div style={styles.meterInner}>
                    <div style={styles.meterValue}>{Math.round(value || 0)}</div>
                    <div style={styles.meterUnit}>{unit}</div>
                </div>
            </div>
            <div style={styles.meterMeta}>
                <span style={styles.meterLabel}>{label}</span>
                {helper && <span style={styles.meterHelper}>{helper}</span>}
            </div>
        </div>
    );
};

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
    const todayTotals = useMemo(() => ({
        calories: Math.round(today?.total_calories || 0),
        protein: Math.round(today?.total_protein || 0),
        carbs: Math.round(today?.total_carbs || 0),
        fats: Math.round(today?.total_fats || 0),
        vegetables: Number(today?.total_vegetable_servings || 0).toFixed(1),
    }), [today]);

    const scoreMeters = [
        { label: 'Today Score', value: summary?.today_score || 0, unit: 'pts', max: 100, color: '#e11d2e', helper: 'Daily balance' },
        { label: 'Weekly Avg', value: Math.round(summary?.weekly_score || 0), unit: 'avg', max: 100, color: '#ff6b6b', helper: 'Last 7 days' },
        { label: 'Streak', value: summary?.current_streak || 0, unit: 'days', max: 14, color: '#ff9f43', helper: 'Goal 14 days' },
        { label: 'Badges', value: summary?.healthy_week_badges || 0, unit: 'earned', max: 10, color: '#1dd1a1', helper: 'Healthy weeks' },
    ];

    const macroMeters = [
        { label: 'Calories', value: todayTotals.calories, unit: 'kcal', max: GOALS.calories, color: '#e11d2e', helper: `${GOALS.calories} goal` },
        { label: 'Protein', value: todayTotals.protein, unit: 'g', max: GOALS.protein, color: '#10b981', helper: `${GOALS.protein}g goal` },
        { label: 'Carbs', value: todayTotals.carbs, unit: 'g', max: GOALS.carbs, color: '#f59e0b', helper: `${GOALS.carbs}g goal` },
        { label: 'Fats', value: todayTotals.fats, unit: 'g', max: GOALS.fats, color: '#6366f1', helper: `${GOALS.fats}g goal` },
    ];

    const withDelay = (index) => ({ animationDelay: `${index * 0.08}s` });

    return (
        <div style={styles.page} className="nutrition-page">
            <div style={styles.accentBlob} className="float-slow" />

            <header style={styles.header}>
                <div style={styles.headerText}>
                    <span style={styles.kicker}>Stash Nutrition</span>
                    <h1 style={styles.heroTitle}>Fuel smarter, track your balance.</h1>
                    <p style={styles.heroSubtitle}>
                        A modern dashboard for daily energy, macro tracking, and cooking impact.
                    </p>
                </div>
                <div style={styles.headerActions}>
                    <button style={styles.primaryBtn} onClick={loadNutrition} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh data
                    </button>
                    <button style={styles.secondaryBtn}>Set goals</button>
                </div>
            </header>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.dashboard} className="nutrition-dashboard">
                <div style={styles.leftCol}>
                    <section style={{ ...styles.panel, ...withDelay(0) }} className="fade-up">
                        <div style={styles.panelHeader}>
                            <div>
                                <span style={styles.panelKicker}>Performance</span>
                                <h2 style={styles.sectionTitle}>Daily balance</h2>
                            </div>
                            <div style={styles.panelIcon}><Activity size={18} /></div>
                        </div>
                        <div style={styles.meterGrid}>
                            {scoreMeters.map((item) => (
                                <MeterCard key={item.label} {...item} />
                            ))}
                        </div>
                    </section>

                    <section style={{ ...styles.panel, ...withDelay(1) }} className="fade-up">
                        <div style={styles.panelHeader}>
                            <div>
                                <span style={styles.panelKicker}>Today</span>
                                <h2 style={styles.sectionTitle}>Fuel meters</h2>
                            </div>
                            <div style={styles.panelIcon}><Flame size={18} /></div>
                        </div>
                        {today ? (
                            <>
                                <div style={styles.meterGrid}>
                                    {macroMeters.map((item) => (
                                        <MeterCard key={item.label} {...item} />
                                    ))}
                                </div>
                                <div style={styles.totalsRow}>
                                    <div style={styles.totalPill}><Flame size={14} /> {todayTotals.calories} kcal</div>
                                    <div style={styles.totalPill}>Protein {todayTotals.protein} g</div>
                                    <div style={styles.totalPill}>Carbs {todayTotals.carbs} g</div>
                                    <div style={styles.totalPill}>Fats {todayTotals.fats} g</div>
                                    <div style={styles.totalPill}><Leaf size={14} /> {todayTotals.vegetables} servings</div>
                                </div>
                            </>
                        ) : (
                            <div style={styles.empty}>No cooked recipes logged today.</div>
                        )}
                    </section>

                    <section style={{ ...styles.panel, ...withDelay(2) }} className="fade-up">
                        <div style={styles.panelHeader}>
                            <div>
                                <span style={styles.panelKicker}>Growth</span>
                                <h2 style={styles.sectionTitle}>Level progress</h2>
                            </div>
                            <div style={styles.panelIcon}><Trophy size={18} /></div>
                        </div>
                        <div style={styles.progressGrid}>
                            <div style={styles.progressCard}>
                                <div style={styles.progressValue}>L{summary?.level ?? 1}</div>
                                <div style={styles.progressLabel}>Current level</div>
                            </div>
                            <div style={styles.progressCard}>
                                <div style={styles.progressValue}>{summary?.points ?? 0}</div>
                                <div style={styles.progressLabel}>Total points</div>
                            </div>
                            <div style={styles.progressCard}>
                                <div style={styles.progressValue}>{summary?.current_streak ?? 0} days</div>
                                <div style={styles.progressLabel}>Current streak</div>
                            </div>
                        </div>
                    </section>
                </div>

                <div style={styles.rightCol} className="nutrition-right">
                    <section style={{ ...styles.panel, ...withDelay(3) }} className="fade-up">
                        <div style={styles.panelHeader}>
                            <div>
                                <span style={styles.panelKicker}>History</span>
                                <h2 style={styles.sectionTitle}>Daily performance</h2>
                            </div>
                            <div style={styles.panelIcon}><BarChart3 size={18} /></div>
                        </div>
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
                    </section>

                    <section style={{ ...styles.panel, ...withDelay(4) }} className="fade-up">
                        <div style={styles.panelHeader}>
                            <div>
                                <span style={styles.panelKicker}>History</span>
                                <h2 style={styles.sectionTitle}>Weekly trends</h2>
                            </div>
                            <div style={styles.panelIcon}><CalendarDays size={18} /></div>
                        </div>
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
                    </section>

                    <section style={{ ...styles.panel, ...withDelay(5) }} className="fade-up">
                        <div style={styles.panelHeader}>
                            <div>
                                <span style={styles.panelKicker}>Rewards</span>
                                <h2 style={styles.sectionTitle}>Badges earned</h2>
                            </div>
                            <div style={styles.panelIcon}><Trophy size={18} /></div>
                        </div>
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
                    </section>

                    <section style={{ ...styles.panel, ...withDelay(6) }} className="fade-up">
                        <div style={styles.panelHeader}>
                            <div>
                                <span style={styles.panelKicker}>Cooked</span>
                                <h2 style={styles.sectionTitle}>Recent recipes</h2>
                            </div>
                            <div style={styles.panelIcon}><Leaf size={18} /></div>
                        </div>
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
                    </section>
                </div>
            </div>
        </div>
    );
};

const styles = {
    page: {
        width: '100%',
        minHeight: '100vh',
        padding: '2.2rem 3.2rem 3rem',
        background: '#f7f5f2',
        color: '#101010',
        position: 'relative',
        overflow: 'hidden',
    },
    accentBlob: {
        position: 'absolute',
        top: '-80px',
        right: '-120px',
        width: '260px',
        height: '260px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(225,29,46,0.25), rgba(225,29,46,0))',
        filter: 'blur(12px)',
        zIndex: 0,
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: '2rem',
        flexWrap: 'wrap',
        marginBottom: '2rem',
        position: 'relative',
        zIndex: 1,
    },
    headerText: { maxWidth: '520px' },
    kicker: { textTransform: 'uppercase', letterSpacing: '0.35em', fontSize: '0.7rem', color: '#e11d2e', fontWeight: 700 },
    heroTitle: { fontSize: '2.6rem', lineHeight: 1.1, margin: '0.4rem 0', color: '#111111' },
    heroSubtitle: { color: '#6b6b6b', fontSize: '1rem' },
    headerActions: { display: 'flex', gap: '0.8rem', flexWrap: 'wrap' },
    primaryBtn: { background: '#e11d2e', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '999px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 10px 25px rgba(225,29,46,0.25)' },
    secondaryBtn: { background: '#ffffff', color: '#111111', border: '1px solid #d9d9d9', padding: '10px 20px', borderRadius: '999px', cursor: 'pointer' },
    error: { background: 'rgba(225,29,46,0.12)', color: '#b91c1c', border: '1px solid rgba(225,29,46,0.25)', borderRadius: '10px', padding: '10px 12px', marginBottom: '1rem', position: 'relative', zIndex: 1 },
    dashboard: {
        display: 'grid',
        gridTemplateColumns: 'minmax(340px, 1.1fr) minmax(360px, 1fr)',
        gap: '1.4rem',
        position: 'relative',
        zIndex: 1,
    },
    leftCol: { display: 'flex', flexDirection: 'column', gap: '1.2rem' },
    rightCol: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(240px, 1fr))',
        gap: '1.2rem',
        alignContent: 'start',
    },
    panel: {
        background: '#111111',
        color: '#ffffff',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '1.2rem',
        boxShadow: '0 16px 40px rgba(0,0,0,0.12)',
    },
    panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
    panelKicker: { color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase' },
    panelIcon: { width: '36px', height: '36px', borderRadius: '12px', background: 'rgba(225,29,46,0.2)', color: '#ff5b6b', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { margin: 0, fontSize: '1.2rem', color: '#ffffff' },
    meterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.9rem' },
    meterCard: { background: '#0f0f0f', borderRadius: '16px', padding: '0.9rem', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '0.7rem', alignItems: 'center', textAlign: 'center' },
    meterRing: { width: '86px', height: '86px', borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
    meterStroke: { position: 'absolute', inset: '4px', borderRadius: '50%', background: '#2a2a2a' },
    meterInner: { width: '66px', height: '66px', borderRadius: '50%', background: '#111111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    meterValue: { fontSize: '1.1rem', fontWeight: 700 },
    meterUnit: { fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' },
    meterMeta: { display: 'flex', flexDirection: 'column', gap: '0.2rem' },
    meterLabel: { fontWeight: 600, fontSize: '0.9rem' },
    meterHelper: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' },
    totalsRow: { display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '1rem' },
    totalPill: { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '8px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' },
    progressGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.8rem' },
    progressCard: { background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '0.9rem', textAlign: 'center' },
    progressValue: { fontSize: '1.1rem', fontWeight: 700 },
    progressLabel: { fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' },
    list: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
    row: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', alignItems: 'center', gap: '0.5rem', background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '10px 12px', color: '#ffffff' },
    rowMeta: { color: 'rgba(255,255,255,0.6)', fontSize: '0.86rem', textAlign: 'right' },
    good: { justifySelf: 'end', color: '#4ade80', fontWeight: 700, fontSize: '0.85rem' },
    warn: { justifySelf: 'end', color: '#f97316', fontWeight: 700, fontSize: '0.85rem' },
    rewardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '10px 12px', color: '#ffffff' },
    rewardTitle: { fontWeight: 700, color: '#ffffff' },
    rewardMeta: { color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' },
    rewardPoints: { color: '#ff5b6b', fontWeight: 700 },
    empty: { color: 'rgba(255,255,255,0.6)', padding: '6px 0' },
};

export default Nutrition;

if (!document.getElementById('nutrition-animations')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'nutrition-animations';
    styleSheet.innerText = `
      @keyframes floatSlow {
        0% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
        100% { transform: translateY(0); }
      }
      @keyframes fadeUp {
        0% { opacity: 0; transform: translateY(12px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulseSoft {
        0% { box-shadow: 0 0 0 0 rgba(225,29,46,0.12); }
        70% { box-shadow: 0 0 0 12px rgba(225,29,46,0); }
        100% { box-shadow: 0 0 0 0 rgba(225,29,46,0); }
      }
      .fade-up { animation: fadeUp 0.6s ease both; }
      .hover-lift { transition: transform 0.3s ease, box-shadow 0.3s ease; }
      .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 18px 30px rgba(0,0,0,0.2); }
      .pulse-soft { animation: pulseSoft 2.4s ease-out infinite; }
      .fade-up { opacity: 0; animation: fadeUp 0.6s ease both; }
      @media (max-width: 1100px) {
        .nutrition-dashboard { grid-template-columns: 1fr; }
        .nutrition-right { grid-template-columns: 1fr; }
      }
      @media (max-width: 720px) {
        .nutrition-page { padding: 2rem 1.5rem 3rem; }
      }
    `;
    document.head.appendChild(styleSheet);
}
