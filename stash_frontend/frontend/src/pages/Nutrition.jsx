
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Flame,
  Medal,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react';
import { nutritionService } from '../services/api';
import '../styles/global.css';

const RANGE_OPTIONS = [7, 14, 30];

const safeNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const formatDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const trendSummary = (points) => {
  if (!points || points.length < 2) return { direction: 'flat', delta: 0 };
  const delta = safeNum(points[points.length - 1].score) - safeNum(points[0].score);
  if (delta > 3) return { direction: 'up', delta: Math.round(delta) };
  if (delta < -3) return { direction: 'down', delta: Math.round(delta) };
  return { direction: 'flat', delta: Math.round(delta) };
};

const statusTone = (status) => {
  if (status === 'on_track') return { color: '#166534', bg: 'rgba(34,197,94,0.16)' };
  if (status === 'high') return { color: '#9a3412', bg: 'rgba(249,115,22,0.16)' };
  return { color: '#991b1b', bg: 'rgba(239,68,68,0.14)' };
};

const Gauge = ({ value, unit }) => {
  const pct = Math.max(0, Math.min(100, Math.round(safeNum(value))));
  const ring = `conic-gradient(#f59e0b 0% ${pct}%, #e5e7eb ${pct}% 100%)`;
  return (
    <div style={{ ...styles.gauge, background: ring }}>
      <div style={styles.gaugeInner}>
        <div style={styles.gaugeValue}>{pct}</div>
        <div style={styles.gaugeUnit}>{unit}</div>
      </div>
    </div>
  );
};

const Nutrition = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [cooked, setCooked] = useState([]);
  const [selectedDays, setSelectedDays] = useState(7);
  const [activePage, setActivePage] = useState('daily');

  const slides = useMemo(() => ([
    { id: 'daily', title: 'Daily balance' },
    { id: 'fuel', title: 'Fuel meters' },
    { id: 'badges', title: 'Badges' },
    { id: 'earned', title: 'Badges earned' },
    { id: 'recipes', title: 'Recent recipes' },
  ]), []);

  const loadNutrition = async (daysWindow = selectedDays) => {
    const safeDays = Math.max(1, Math.round(safeNum(daysWindow, 7)));
    const weeklyWindow = Math.max(6, Math.ceil(safeDays / 7) + 3);
    setLoading(true);
    setError('');
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - (safeDays - 1));
      const [sRes, dRes, wRes, rRes, cRes] = await Promise.all([
        nutritionService.getProfileSummary(),
        nutritionService.getDailyScores({ start: formatDate(start), end: formatDate(end) }),
        nutritionService.getWeeklyScores({ weeks: weeklyWindow }),
        nutritionService.getRewards({ limit: 20 }),
        nutritionService.getCookedHistory({ limit: 20 }),
      ]);
      setSummary(sRes.data || null);
      setDaily(dRes.data || []);
      setWeekly(wRes.data || []);
      setRewards(rRes.data || []);
      setCooked(cRes.data || []);
    } catch {
      setError('Failed to load nutrition insights.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadNutrition(selectedDays); }, [selectedDays]);

  const latestWeekly = weekly[0] || null;
  const latestReward = rewards[0] || null;

  const points = useMemo(() => {
    const usable = [...daily]
      .map((x) => ({ date: x.date, score: safeNum(x.score) }))
      .filter((x) => x.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return usable.slice(-7);
  }, [daily]);

  const trend = useMemo(() => trendSummary(points), [points]);

  const weeklyAvg = useMemo(() => {
    const backend = safeNum(latestWeekly?.average_score);
    if (backend > 0) return Math.round(backend);
    if (!points.length) return 0;
    return Math.round(points.reduce((a, p) => a + safeNum(p.score), 0) / points.length);
  }, [latestWeekly, points]);

  const display = useMemo(() => {
    const pts = safeNum(summary?.points);
    const lvl = Math.max(1, safeNum(summary?.level, 1));
    return {
      todayScore: safeNum(summary?.today_score),
      weeklyAvg: Math.max(safeNum(summary?.weekly_score), weeklyAvg),
      streak: safeNum(summary?.current_streak),
      badges: safeNum(summary?.healthy_week_badges),
      points: pts,
      level: lvl,
      longest: safeNum(summary?.longest_streak),
    };
  }, [summary, weeklyAvg]);

  const totals = useMemo(() => {
    const today = daily[0];
    return {
      calories: Math.round(safeNum(today?.total_calories)),
      protein: Math.round(safeNum(today?.total_protein)),
      carbs: Math.round(safeNum(today?.total_carbs)),
      fats: Math.round(safeNum(today?.total_fats)),
      vegetables: Number(safeNum(today?.total_vegetable_servings)).toFixed(1),
    };
  }, [daily]);

  const goals = summary?.goals || { calories: 2000, protein: 90, carbs: 250, fats: 70 };
  const goalProgress = useMemo(() => {
    if (summary?.goal_progress && Object.keys(summary.goal_progress).length) return summary.goal_progress;
    const metrics = ['calories', 'protein', 'carbs', 'fats'];
    return metrics.reduce((acc, m) => {
      const value = safeNum(totals[m]);
      const goal = safeNum(goals[m]);
      const percent = goal > 0 ? Math.round((value / goal) * 100) : 0;
      let status = 'low';
      if (percent >= 90 && percent <= 110) status = 'on_track';
      if (percent > 110) status = 'high';
      acc[m] = { value, goal, percent, status };
      return acc;
    }, {});
  }, [summary, totals, goals]);

  const renderCard = () => {
    if (activePage === 'daily') {
      const trendText = `${trend.direction} (${trend.delta >= 0 ? '+' : ''}${trend.delta})`;
      return (
        <div style={styles.dailyHeroCard} className="nutrition-fill-card">
          <div style={styles.dailyHeroBg} />
          <div style={styles.dailyHeroOverlay} />

          <div style={styles.dailyHeroContent} className="nutrition-daily-content">
            <div style={styles.dailyHeroLeft}>
              <div style={styles.heroKicker}>PERFORMANCE</div>
              <h2 style={styles.heroTitleDaily}>Daily balance</h2>

              <div style={styles.heroStatsRow} className="nutrition-hero-stats">
                <div style={styles.heroStat}>
                  <div style={styles.heroStatValue}>{Math.round(display.todayScore)}</div>
                  <div style={styles.heroStatUnit}>pts</div>
                  <div style={styles.heroStatLabel}>Daily Score</div>
                </div>

                <div style={styles.heroStat}>
                  <div style={styles.heroStatValue}>{Math.round(display.weeklyAvg)}</div>
                  <div style={styles.heroStatUnit}>pts</div>
                  <div style={styles.heroStatLabel}>Weekly Avg</div>
                </div>

                <div style={styles.heroStat}>
                  <div style={styles.heroStreakDays}>S M T W T F S</div>
                  <div style={styles.heroStreakGrid}>
                    {Array.from({ length: 14 }).map((_, i) => (
                      <span key={`h-streak-${i}`} style={i < display.streak ? styles.heroStreakOn : styles.heroStreakOff} />
                    ))}
                  </div>
                  <div style={styles.heroStatLabel}>{display.streak} days</div>
                </div>

                <div style={styles.heroStat}>
                  <div style={styles.heroBadgeIcon}><Trophy size={16} /></div>
                  <div style={styles.heroStatUnit}>{display.badges} earned</div>
                  <div style={styles.heroStatLabel}>Badges</div>
                </div>
              </div>

              <div style={styles.heroTrend}>Trend {trendText}</div>
            </div>
          </div>
        </div>
      );
    }

    if (activePage === 'fuel') {
      const fuelItems = [
        { key: 'calories', label: 'Calories', unit: 'kcal' },
        { key: 'protein', label: 'Protein', unit: 'g' },
        { key: 'carbs', label: 'Carbs', unit: 'g' },
        { key: 'fats', label: 'Fats', unit: 'g' },
      ];
      return (
        <div style={styles.dailyHeroCard} className="nutrition-fill-card">
          <div style={styles.dailyHeroBg} />
          <div style={styles.dailyHeroOverlay} />
          <div style={styles.dailyHeroContent} className="nutrition-daily-content">
            <div style={styles.dailyHeroLeft}>
              <div style={styles.heroKicker}>TODAY</div>
              <h2 style={styles.heroTitleDaily}>Fuel meters</h2>
              <div style={styles.heroStatsRow} className="nutrition-hero-stats">
                {fuelItems.map((item) => {
                  const gp = goalProgress[item.key] || {};
                  const tone = statusTone(gp.status);
                  return (
                    <div key={item.key} style={styles.heroStat}>
                      <div style={styles.heroStatValue}>{Math.round(safeNum(gp.value))}</div>
                      <div style={styles.heroStatUnit}>{item.unit}</div>
                      <div style={styles.heroStatLabel}>{item.label}</div>
                      <div style={{ ...styles.heroMicro, color: tone.color }}>
                        {Math.round(safeNum(gp.percent))}% • {(gp.status || 'low').replace('_', ' ')}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={styles.heroTrend}>Vegetable servings {totals.vegetables}</div>
              <button style={styles.heroCta} onClick={() => navigate('/customer/cook')}>
                <Sparkles size={14} /> Log Meal
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activePage === 'badges') {
      return (
        <div style={styles.dailyHeroCard} className="nutrition-fill-card">
          <div style={styles.dailyHeroBg} />
          <div style={styles.dailyHeroOverlay} />
          <div style={styles.dailyHeroContent} className="nutrition-daily-content">
            <div style={styles.dailyHeroLeft}>
              <div style={styles.heroKicker}>PERFORMANCE</div>
              <h2 style={styles.heroTitleDaily}>Badges</h2>
              <div style={styles.heroStatsRow} className="nutrition-hero-stats">
                <div style={styles.heroStat}>
                  <div style={styles.heroStatValue}>{display.streak}</div>
                  <div style={styles.heroStatUnit}>days</div>
                  <div style={styles.heroStatLabel}>Current streak</div>
                </div>
                <div style={styles.heroStat}>
                  <div style={styles.heroStatValue}>{display.longest}</div>
                  <div style={styles.heroStatUnit}>days</div>
                  <div style={styles.heroStatLabel}>Longest streak</div>
                </div>
                <div style={styles.heroStat}>
                  <div style={styles.heroStatValue}>{display.badges}</div>
                  <div style={styles.heroStatUnit}>earned</div>
                  <div style={styles.heroStatLabel}>Healthy-week badges</div>
                </div>
                <div style={styles.heroStat}>
                  <div style={styles.heroBadgeIcon}><Medal size={16} /></div>
                  <div style={styles.heroStatUnit}>L{display.level}</div>
                  <div style={styles.heroStatLabel}>Current level</div>
                </div>
              </div>
              <div style={styles.heroTrend}>{display.points} total points</div>
            </div>
          </div>
        </div>
      );
    }

    if (activePage === 'earned') {
      const rewardItems = rewards.slice(0, 4);
      return (
        <div style={styles.dailyHeroCard} className="nutrition-fill-card">
          <div style={styles.dailyHeroBg} />
          <div style={styles.dailyHeroOverlay} />
          <div style={styles.dailyHeroContent} className="nutrition-daily-content">
            <div style={styles.dailyHeroLeft}>
              <div style={styles.heroKicker}>REWARDS</div>
              <h2 style={styles.heroTitleDaily}>Badges earned</h2>
              <div style={styles.heroStatsRow} className="nutrition-hero-stats">
                {Array.from({ length: 4 }).map((_, idx) => {
                  const reward = rewardItems[idx];
                  return (
                    <div key={`reward-${idx}`} style={styles.heroStat}>
                      <div style={styles.heroBadgeIcon}><Trophy size={16} /></div>
                      <div style={styles.heroStatUnit}>
                        {reward ? `+${safeNum(reward.points)}` : '+0'}
                      </div>
                      <div style={styles.heroStatLabel}>
                        {reward ? reward.title : 'No reward'}
                      </div>
                      <div style={styles.heroMicro}>
                        {reward ? (reward.reference_date || '--') : '--'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={styles.heroTrend}>{latestReward?.title || 'No rewards earned yet'}</div>
            </div>
          </div>
        </div>
      );
    }

    const recipeItems = cooked.slice(0, 4);
    return (
      <div style={styles.dailyHeroCard} className="nutrition-fill-card">
        <div style={styles.dailyHeroBg} />
        <div style={styles.dailyHeroOverlay} />
        <div style={styles.dailyHeroContent} className="nutrition-daily-content">
          <div style={styles.dailyHeroLeft}>
            <div style={styles.heroKicker}>COOKED</div>
            <h2 style={styles.heroTitleDaily}>Recent recipes</h2>
            <div style={styles.heroStatsRow} className="nutrition-hero-stats">
              {Array.from({ length: 4 }).map((_, idx) => {
                const item = recipeItems[idx];
                return (
                  <div key={`recipe-${idx}`} style={styles.heroStat}>
                    <div style={styles.heroStatValue}>
                      {item ? Math.round(safeNum(item.calories)) : 0}
                    </div>
                    <div style={styles.heroStatUnit}>kcal</div>
                    <div style={styles.heroStatLabel}>{item ? item.recipe_name : 'No recipe'}</div>
                    <div style={styles.heroMicro}>
                      {item ? new Date(item.cooked_at).toLocaleDateString() : '--'}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={styles.heroTrend}>{recipeItems.length} recipes logged</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.pageTitle}>NUTRITION STUDIO</h1>
          <p style={styles.pageSub}>Track your balance, fuel, rewards and recipes in one light workspace.</p>
        </div>
        <div style={styles.controls}>
          <div style={styles.rangeWrap}>
            {RANGE_OPTIONS.map((r) => (
              <button key={r} style={selectedDays === r ? { ...styles.rangeBtn, ...styles.rangeBtnActive } : styles.rangeBtn} onClick={() => setSelectedDays(r)}>{r}D</button>
            ))}
          </div>
          <button style={styles.refreshBtn} onClick={() => loadNutrition(selectedDays)} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh</button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.moduleStrip} className="nutrition-module-strip">
        {slides.map((slide) => (
          <button key={slide.id} style={activePage === slide.id ? { ...styles.moduleBtn, ...styles.moduleBtnActive } : styles.moduleBtn} onClick={() => setActivePage(slide.id)}>
            {slide.title}
          </button>
        ))}
      </div>

      <div style={styles.contentArea}>
        {loading ? <div style={styles.loading}>Loading nutrition data...</div> : renderCard()}
      </div>

    </div>
  );
};

const styles = {
  page: { width: '100%', minHeight: 'calc(100vh - 88px)', background: 'var(--color-bg)', padding: '1.2rem 1.4rem 1.4rem', display: 'flex', flexDirection: 'column' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.55rem' },
  pageTitle: { margin: 0, fontSize: '2rem', color: 'var(--color-text)', fontFamily: 'var(--font-heading)', letterSpacing: '0.02em' },
  pageSub: { margin: '0.28rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' },
  controls: { display: 'flex', gap: '0.55rem', alignItems: 'center', flexWrap: 'wrap' },
  rangeWrap: { display: 'flex', gap: '0.26rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '999px', padding: 4 },
  rangeBtn: { border: 'none', borderRadius: '999px', background: 'transparent', color: 'var(--color-text-muted)', fontWeight: 700, padding: '7px 12px', cursor: 'pointer' },
  rangeBtnActive: { background: 'rgba(225,29,46,0.12)', color: 'var(--color-primary)', border: '1px solid rgba(225,29,46,0.2)' },
  refreshBtn: { border: '1px solid var(--color-border)', borderRadius: '999px', background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: 700, padding: '8px 13px', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' },
  error: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: 12, color: '#b91c1c', padding: '10px 12px', marginBottom: '0.8rem' },
  moduleStrip: { display: 'flex', gap: '1.1rem', marginBottom: '0.95rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.4rem', overflowX: 'auto' },
  moduleBtn: { border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'transparent', background: 'transparent', color: 'var(--color-text-muted)', padding: '6px 2px 10px', textAlign: 'left', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  moduleBtnActive: { color: 'var(--color-text)', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'rgba(139,92,246,0.4)' },
  contentArea: { width: '100%', flex: 1, display: 'flex', alignItems: 'stretch' },
  loading: { borderRadius: 16, border: '1px solid var(--color-border)', background: 'var(--color-surface)', minHeight: 280, width: '100%', display: 'grid', placeItems: 'center', color: 'var(--color-text)' },
  dailyHeroCard: { position: 'relative', borderRadius: 16, overflow: 'hidden', minHeight: 'calc(100vh - 230px)', width: '100%', border: '1px solid rgba(0,0,0,0.14)', boxShadow: '0 12px 22px rgba(0,0,0,0.1)' },
  dailyHeroBg: { position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1700&q=80)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(7px) saturate(1.06) brightness(0.84)', transform: 'scale(1.1)' },
  dailyHeroOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(24,26,34,0.62) 0%, rgba(26,28,36,0.54) 60%, rgba(28,30,38,0.64) 100%)' },
  dailyHeroContent: { position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100%', padding: '1.1rem', color: '#f8fafc' },
  dailyHeroLeft: { width: 'min(1180px, 96%)', margin: '0 auto', borderRadius: 14, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(28,30,38,0.34)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', padding: '1.2rem 1rem' },
  heroKicker: { fontSize: '0.75rem', letterSpacing: '0.15em', fontWeight: 700, color: 'rgba(255,255,255,0.82)' },
  heroTitleDaily: { margin: '0.28rem 0 0.7rem', fontFamily: '"Fraunces", "Times New Roman", serif', fontSize: '2.1rem', lineHeight: 1, color: '#fff7ed' },
  heroStatsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.45rem' },
  heroStat: { borderRight: '1px solid rgba(255,255,255,0.18)', padding: '0 0.45rem', textAlign: 'center', minHeight: 136 },
  heroStatValue: { fontSize: '3rem', lineHeight: 0.95, fontWeight: 800, color: '#fff' },
  heroStatUnit: { fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)', marginBottom: '0.34rem' },
  heroStatLabel: { fontSize: '0.96rem', fontWeight: 700, color: '#fff7ed' },
  heroStreakDays: { fontSize: '0.7rem', letterSpacing: '0.2em', marginBottom: '0.35rem', color: 'rgba(255,255,255,0.82)' },
  heroStreakGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: '0.45rem' },
  heroStreakOn: { height: 12, borderRadius: 4, background: 'linear-gradient(180deg,#ffe08a,#f59e0b)' },
  heroStreakOff: { height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.18)' },
  heroBadgeIcon: { width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.33)', display: 'grid', placeItems: 'center', margin: '4px auto', color: '#e5e7eb' },
  heroMicro: { marginTop: '0.3rem', fontSize: '0.74rem', color: 'rgba(255,255,255,0.72)' },
  heroTrend: { marginTop: '0.55rem', color: 'rgba(255,255,255,0.84)', fontSize: '0.82rem' },
  heroCta: { marginTop: '0.55rem', border: '1px solid rgba(255,255,255,0.28)', borderRadius: 999, background: 'rgba(255,255,255,0.12)', color: '#f8fafc', fontWeight: 700, padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' },
  sectionCard: { borderRadius: 16, border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '1rem', boxShadow: 'var(--shadow-sm)', width: '100%', minHeight: 'calc(100vh - 260px)' },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', color: 'var(--color-text)' },
  sectionTitle: { margin: 0, fontSize: '1.12rem', fontWeight: 700, fontFamily: 'var(--font-heading)' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.65rem' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.65rem' },
  metricCard: { borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', padding: '10px', textAlign: 'center' },
  metricLabel: { color: 'var(--color-text-muted)', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'capitalize' },
  metricBig: { fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' },
  gauge: { width: 92, height: 92, borderRadius: '50%', margin: '0 auto', display: 'grid', placeItems: 'center' },
  gaugeInner: { width: 68, height: 68, borderRadius: '50%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'grid', placeItems: 'center' },
  gaugeValue: { fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 },
  gaugeUnit: { fontSize: '0.75rem', color: 'var(--color-text-muted)' },
  badgeRow: { display: 'flex', justifyContent: 'center', gap: '0.45rem', marginBottom: '0.35rem' },
  badgeDot: { width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', border: '1px solid var(--color-border)', background: 'var(--color-surface)' },
  stack: { display: 'grid', gap: '0.5rem' },
  progressRow: { borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', padding: '8px 9px' },
  progressHead: { display: 'flex', justifyContent: 'space-between', color: 'var(--color-text)', fontSize: '0.8rem', marginBottom: 4, textTransform: 'capitalize' },
  track: { height: 7, borderRadius: '999px', background: '#e5e7eb', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg,#f59e0b,#ef4444)' },
  pill: { marginTop: 5, display: 'inline-block', borderRadius: '999px', fontSize: '0.68rem', padding: '2px 7px', textTransform: 'capitalize', fontWeight: 700 },
  cta: { border: '1px solid rgba(225,29,46,0.2)', borderRadius: 999, background: 'rgba(225,29,46,0.08)', color: 'var(--color-primary)', fontWeight: 700, padding: '8px 15px', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 8 },
  levelLine: { display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 8, marginTop: 4, color: 'var(--color-text)' },
  levelTrack: { height: 9, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' },
  levelFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#f59e0b,#ef4444)' },
  rewardHero: { width: 88, height: 88, borderRadius: '50%', margin: '4px auto 8px', background: 'radial-gradient(circle at 34% 30%, #fff7ed, #fdba74 58%, #fb7185)', display: 'grid', placeItems: 'center', color: '#7f1d1d' },
  listRow: { display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) auto auto', gap: 6, alignItems: 'center', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', padding: '8px 9px', fontSize: '0.83rem', color: 'var(--color-text)' },
  metaText: { color: 'var(--color-text-muted)', fontSize: '0.86rem', marginTop: '0.3rem', textAlign: 'center' },
  footerMeta: { marginTop: '0.7rem', fontSize: '0.82rem', color: 'var(--color-text-muted)' },
};

export default Nutrition;

if (typeof document !== 'undefined' && !document.getElementById('nutrition-light-layout')) {
  const style = document.createElement('style');
  style.id = 'nutrition-light-layout';
  style.innerText = `
    @media (max-width: 1200px) {
      .nutrition-module-strip {
        gap: 0.8rem;
      }
    }

    @media (max-width: 900px) {
      .nutrition-fill-card {
        min-height: auto !important;
      }

      .nutrition-grid-4 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .nutrition-grid-3 {
        grid-template-columns: 1fr;
      }

      .nutrition-daily-content {
        grid-template-columns: 1fr !important;
      }

      .nutrition-hero-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }
    }

    @media (max-width: 720px) {
      .nutrition-module-strip {
        gap: 0.6rem;
      }

      .nutrition-grid-4 {
        grid-template-columns: 1fr;
      }

      .nutrition-hero-stats {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(style);
}
