import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ChefHat,
  Flame,
  Medal,
  RefreshCw,
  Sparkles,
  Star,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus as TrendFlat,
  Target,
  Zap,
} from 'lucide-react';
import { nutritionService } from '../services/api';
import '../styles/global.css';
import '../styles/nutritionFloating.css';

const RANGE_OPTIONS = [7, 14, 30];
const FLOATING_FOODS = [
  { icon: '🥑', top: '6%', left: '4%', size: 96, duration: '21s', delay: '-2s', rotate: '-12deg' },
  { icon: '🍎', top: '10%', left: '24%', size: 74, duration: '19s', delay: '-6s', rotate: '9deg' },
  { icon: '🥕', top: '13%', left: '47%', size: 104, duration: '24s', delay: '-4s', rotate: '-18deg' },
  { icon: '🍋', top: '8%', left: '72%', size: 82, duration: '20s', delay: '-9s', rotate: '12deg' },
  { icon: '🥦', top: '17%', left: '90%', size: 108, duration: '26s', delay: '-3s', rotate: '-10deg' },
  { icon: '🍓', top: '34%', left: '10%', size: 76, duration: '18s', delay: '-8s', rotate: '8deg' },
  { icon: '🥬', top: '38%', left: '32%', size: 102, duration: '25s', delay: '-11s', rotate: '-16deg' },
  { icon: '🫐', top: '44%', left: '54%', size: 70, duration: '19s', delay: '-5s', rotate: '10deg' },
  { icon: '🍅', top: '36%', left: '77%', size: 92, duration: '22s', delay: '-13s', rotate: '-7deg' },
  { icon: '🥒', top: '52%', left: '92%', size: 88, duration: '21s', delay: '-1s', rotate: '15deg' },
  { icon: '🍇', top: '60%', left: '6%', size: 84, duration: '20s', delay: '-10s', rotate: '-6deg' },
  { icon: '🥭', top: '68%', left: '23%', size: 94, duration: '23s', delay: '-7s', rotate: '11deg' },
  { icon: '🥝', top: '73%', left: '43%', size: 78, duration: '18s', delay: '-12s', rotate: '-9deg' },
  { icon: '🌽', top: '79%', left: '63%', size: 100, duration: '24s', delay: '-15s', rotate: '7deg' },
  { icon: '🍊', top: '83%', left: '82%', size: 86, duration: '22s', delay: '-14s', rotate: '-13deg' },
  { icon: '🥗', top: '88%', left: '95%', size: 92, duration: '25s', delay: '-16s', rotate: '6deg' },
];

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

const formatShortDay = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { weekday: 'short' });
};

const trendSummary = (points) => {
  const tracked = Array.isArray(points) ? points.filter((p) => p?.tracked !== false) : [];
  if (tracked.length < 2) return { direction: 'flat', delta: 0, trackedDays: tracked.length };
  const delta = safeNum(tracked[tracked.length - 1].score) - safeNum(tracked[0].score);
  if (delta > 3) return { direction: 'up', delta: Math.round(delta) };
  if (delta < -3) return { direction: 'down', delta: Math.round(delta) };
  return { direction: 'flat', delta: Math.round(delta), trackedDays: tracked.length };
};

const dayLabel = (count) => (safeNum(count) === 1 ? 'day' : 'days');

const ScoreRing = ({ score, size = 88, unitLabel = 'score' }) => {
  const pct = Math.max(0, Math.min(100, Math.round(safeNum(score))));
  const color = pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626';
  const ring = `conic-gradient(${color} 0% ${pct}%, #e5e7eb ${pct}% 100%)`;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: ring, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <div style={{ width: size - 16, height: size - 16, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center' }}>
        <div>
          <div style={{ fontSize: size > 70 ? '1.4rem' : '1rem', fontWeight: 800, color: '#1f1712', lineHeight: 1, textAlign: 'center' }}>{pct}</div>
          <div style={{ fontSize: '0.65rem', color: '#7a6d61', textAlign: 'center' }}>{unitLabel}</div>
        </div>
      </div>
    </div>
  );
};

const ProgressBar = ({ value, label, unit, color = '#e74c3c' }) => {
  return (
    <div style={styles.progressItem}>
      <div style={styles.progressHead}>
        <span style={styles.progressLabel}>{label}</span>
        <span style={styles.progressValue}>{Math.round(safeNum(value))} {unit}</span>
      </div>
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: '100%', background: color }} />
      </div>
    </div>
  );
};

const EmptyState = ({ navigate }) => (
  <div style={styles.emptyState}>
    <div style={styles.emptyIcon}><ChefHat size={48} strokeWidth={1.5} /></div>
    <h2 style={styles.emptyTitle}>No nutrition data yet</h2>
    <p style={styles.emptyText}>
      Cook a recipe from your pantry to start tracking your daily nutrition, earn badges, and build your streak.
    </p>
    <button style={styles.emptyBtn} onClick={() => navigate('/customer/cook')}>
      <Sparkles size={16} /> Start cooking
    </button>
  </div>
);

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
  const [activeTab, setActiveTab] = useState('overview');

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
      setDaily(Array.isArray(dRes.data) ? dRes.data : []);
      setWeekly(Array.isArray(wRes.data) ? wRes.data : []);
      setRewards(Array.isArray(rRes.data) ? rRes.data : []);
      setCooked(Array.isArray(cRes.data) ? cRes.data : []);
    } catch (err) {
      if (err?.response?.status !== 401) {
        setError('Failed to load nutrition data. Make sure the server is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadNutrition(selectedDays); }, [selectedDays]);

  const hasData = cooked.length > 0 || daily.length > 0;
  const todayKey = formatDate(new Date());

  const todayData = useMemo(
    () => daily.find((d) => d.date === todayKey) || null,
    [daily, todayKey]
  );

  const points = useMemo(() => {
    const summaryPoints = Array.isArray(summary?.weekly_trend?.points) ? summary.weekly_trend.points : [];
    const source = selectedDays === 7 && summaryPoints.length ? summaryPoints : daily;
    return [...source]
      .map((x) => ({ date: x.date, score: safeNum(x.score), tracked: x.tracked !== false }))
      .filter((x) => x.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(-Math.min(selectedDays, 14));
  }, [daily, selectedDays, summary]);

  const trend = useMemo(() => trendSummary(points), [points]);
  const hasTodayData = Boolean(summary?.has_today_data || todayData);
  const trackedDays = safeNum(summary?.weekly_trend?.tracked_days, points.filter((p) => p.tracked !== false).length);
  const streakDays = useMemo(() => {
    const summaryPoints = Array.isArray(summary?.weekly_trend?.points) ? summary.weekly_trend.points : [];
    return summaryPoints.slice(-7).map((point) => ({
      date: point.date,
      label: formatShortDay(point.date),
      tracked: point.tracked !== false,
      healthy: point.tracked !== false && safeNum(point.score) >= 70,
    }));
  }, [summary]);

  const weeklyAvg = useMemo(() => {
    const backend = safeNum(weekly[0]?.average_score);
    if (backend > 0) return Math.round(backend);
    const tracked = points.filter((p) => p.tracked !== false);
    if (!tracked.length) return 0;
    return Math.round(tracked.reduce((a, p) => a + safeNum(p.score), 0) / tracked.length);
  }, [weekly, points]);

  const display = useMemo(() => ({
    todayScore: hasTodayData ? Math.max(safeNum(summary?.today_score), safeNum(todayData?.score)) : 0,
    weeklyAvg: Math.max(safeNum(summary?.weekly_score), weeklyAvg),
    streak: safeNum(summary?.current_streak),
    longest: safeNum(summary?.longest_streak),
    badges: safeNum(summary?.healthy_week_badges),
    points: safeNum(summary?.points),
    level: Math.max(1, safeNum(summary?.level, 1)),
  }), [hasTodayData, summary, weeklyAvg, todayData]);

  const totals = useMemo(() => ({
    calories: safeNum(todayData?.total_calories),
    protein: safeNum(todayData?.total_protein),
    carbs: safeNum(todayData?.total_carbs),
    fats: safeNum(todayData?.total_fats),
    vegetables: safeNum(todayData?.total_vegetable_servings),
  }), [todayData]);

  const fixMyPlate = summary?.fix_my_plate || [];

  const TrendIcon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : TrendFlat;
  const trendColor = trend.direction === 'up' ? '#16a34a' : trend.direction === 'down' ? '#dc2626' : '#6b7280';
  const trendHeadline = trackedDays < 2
    ? `${trackedDays || 0} tracked ${trackedDays === 1 ? 'day' : 'days'}`
    : trend.direction === 'flat'
    ? 'Stable over period'
    : `${Math.abs(trend.delta)} pts this week`;
  const streakInsightMessage = trackedDays < 2
    ? `You've logged ${trackedDays} ${dayLabel(trackedDays)} so far. Cook again tomorrow to unlock the weekly trend.`
    : trend.direction === 'flat'
      ? 'Your nutrition score has stayed steady this week.'
      : trend.direction === 'up'
        ? 'Your nutrition score is improving this week.'
        : 'Your nutrition score dipped this week. One balanced day can lift it back up.';

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'today', label: "Today's Fuel" },
    { id: 'history', label: 'History' },
    { id: 'rewards', label: 'Rewards' },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.pageGlowA} />
      <div style={styles.pageGlowB} />
      <div className="nutrition-float-layer" aria-hidden="true">
        {FLOATING_FOODS.map((item, index) => (
          <div
            key={`${item.icon}-${index}`}
            className="nutrition-float-item"
            style={{
              '--top': item.top,
              '--left': item.left,
              '--size': `${item.size}px`,
              '--duration': item.duration,
              '--delay': item.delay,
              '--rotate': item.rotate,
            }}
          >
            <span>{item.icon}</span>
          </div>
        ))}
      </div>
      <div style={styles.pageShell}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.pageTitle}>Nutrition Studio</h1>
            <p style={styles.pageSub}>Track your daily balance, fuel, and streaks</p>
          </div>
          <div style={styles.headerActions}>
            <div style={styles.headerControlShell}>
              <div style={styles.rangeWrap}>
                {RANGE_OPTIONS.map((r) => (
                  <button
                    key={r}
                    style={selectedDays === r ? { ...styles.rangeBtn, ...styles.rangeBtnActive } : styles.rangeBtn}
                    onClick={() => setSelectedDays(r)}
                  >
                    {r}D
                  </button>
                ))}
              </div>
              <button style={styles.refreshBtn} onClick={() => loadNutrition(selectedDays)} disabled={loading}>
                <RefreshCw size={15} className={loading ? 'spin' : ''} />
              </button>
            </div>
            <button style={styles.cookBtn} onClick={() => navigate('/customer/cook')}>
              <ChefHat size={15} /> Cook Recipe
            </button>
          </div>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}

        {loading ? (
          <div style={styles.loadingBox}>
            <div style={styles.loadingSpinner} />
            <span style={{ color: '#7a6d61', fontSize: '0.9rem' }}>Loading nutrition data...</span>
          </div>
        ) : !hasData ? (
          <EmptyState navigate={navigate} />
        ) : (
          <div style={styles.contentShell}>
            <div style={styles.tabBar}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  style={activeTab === tab.id ? { ...styles.tabBtn, ...styles.tabBtnActive } : styles.tabBtn}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div style={styles.grid}>
                <div style={{ ...styles.card, ...styles.scoreCard }}>
                  <div style={styles.cardLabel}><Activity size={14} /> Today&apos;s Score So Far</div>
                  <div style={styles.scoreRow}>
                    <ScoreRing score={display.todayScore} size={136} />
                    <div style={styles.scoreStats}>
                      <div style={styles.scoreStatPrimary}>
                        <span style={styles.scoreStatVal}>{display.todayScore}</span>
                        <span style={styles.scoreStatUnit}>score</span>
                      </div>
                      <div style={styles.scoreStatMeta}>
                        <span><strong>{display.weeklyAvg}</strong> Weekly avg</span>
                      </div>
                      <div style={styles.scoreStat}>
                        <span style={styles.scoreStatVal}>L{display.level}</span>
                        <span style={styles.scoreStatLabel}>Level</span>
                      </div>
                      <div style={styles.scoreStat}>
                        <span style={styles.scoreStatVal}>{display.streak}</span>
                        <span style={styles.scoreStatLabel}>Day streak</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ ...styles.trendChip, color: trendColor }}>
                    <TrendIcon size={14} />
                    {trackedDays < 2
                      ? 'Need more tracked days for a trend'
                      : trend.direction === 'flat'
                      ? 'Stable over period'
                      : `${trend.direction === 'up' ? '+' : ''}${trend.delta} pts ${trend.direction === 'up' ? 'improved' : 'dropped'}`}
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardLabel}><Flame size={14} /> Streak & Badges</div>
                  <div style={styles.streakGrid}>
                    {streakDays.map((day) => (
                      <div
                        key={day.date}
                        style={{
                          ...styles.streakDay,
                          borderColor: day.healthy ? 'rgba(225,29,46,0.18)' : 'var(--color-border)',
                          background: day.healthy ? 'rgba(225,29,46,0.08)' : 'rgba(17,17,17,0.03)',
                        }}
                        title={
                          day.healthy
                            ? `${day.label}: healthy day`
                            : day.tracked
                              ? `${day.label}: tracked but not a healthy day`
                              : `${day.label}: no nutrition data`
                        }
                      >
                        <div
                          style={{
                            ...styles.streakDot,
                            background: day.healthy
                              ? 'linear-gradient(135deg, var(--color-primary), var(--color-accent))'
                              : 'rgba(17,17,17,0.08)',
                            opacity: day.tracked ? 1 : 0.45,
                          }}
                        />
                        <div style={styles.streakDayLabel}>{day.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={styles.streakHelper}>Each labeled block shows a day from this week. Filled means that day counted as healthy.</div>
                  <div style={styles.streakMeta}>
                    <span><strong>{display.streak} {dayLabel(display.streak)}</strong> current streak</span>
                    <span><strong>{display.longest} {dayLabel(display.longest)}</strong> best streak</span>
                    <span><Trophy size={12} /> <strong>{display.badges}</strong> badges earned</span>
                    <span><Star size={12} /> <strong>{display.points}</strong> reward points</span>
                  </div>
                  <div style={styles.streakInsight}>
                    <div style={styles.streakInsightIcon}><Sparkles size={16} /></div>
                    <div style={styles.streakInsightText}>
                      {streakInsightMessage}
                    </div>
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardLabel}><Target size={14} /> Fix My Plate</div>
                  <div style={styles.fixPlateHero}>
                    <div style={styles.fixPlateAura} />
                    <div style={styles.fixPlatePlate}>
                      <ChefHat size={28} />
                    </div>
                    <div style={styles.fixPlateProduceTomato} />
                    <div style={styles.fixPlateProduceCarrot} />
                    <div style={styles.fixPlateProduceLeaf} />
                  </div>
                  {fixMyPlate.length === 0 ? (
                    <>
                      <p style={styles.fixPlateText}>Cook a recipe today to get personalized suggestions.</p>
                      <button style={styles.softActionBtn} onClick={() => navigate('/customer/cook')}>
                        Find Recipes
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={styles.suggestionList}>
                        {fixMyPlate.slice(0, 2).map((s, i) => (
                          <div
                            key={i}
                            style={{
                              ...styles.suggestionItem,
                              borderLeft: `3px solid ${s.priority === 'high' ? '#dc2626' : s.priority === 'medium' ? '#d97706' : '#16a34a'}`
                            }}
                          >
                            <div style={styles.suggestionTitle}>{s.title}</div>
                            <div style={styles.suggestionAction}>{s.action}</div>
                          </div>
                        ))}
                      </div>
                      <button style={styles.softActionBtn} onClick={() => navigate('/customer/cook')}>
                        Find Recipes
                      </button>
                    </>
                  )}
                </div>

                <div style={styles.card}>
                  <div style={styles.cardLabel}><TrendingUp size={14} /> {selectedDays}-day Trend</div>
                  {points.filter((p) => p.tracked !== false).length === 0 ? (
                    <p style={styles.emptyCardText}>No score history in this period.</p>
                  ) : (
                    <>
                      <div style={styles.trendLead}>
                        <span style={{ ...styles.trendLeadValue, color: trendColor }}>
                          <TrendIcon size={18} /> {trendHeadline}
                        </span>
                      </div>
                      <div style={styles.chartPanel}>
                        <div style={styles.barChart}>
                          {points.map((p, i) => {
                            const isTracked = p.tracked !== false;
                            const h = isTracked ? Math.max(24, Math.round((safeNum(p.score) / 100) * 150)) : 14;
                            return (
                              <div key={i} style={styles.barWrap} title={isTracked ? `${p.date}: ${p.score} score` : `${p.date}: no data`}>
                                <div
                                  style={{
                                    ...styles.bar,
                                    height: `${h}px`,
                                    opacity: isTracked ? 1 : 0.22,
                                    background: isTracked ? styles.bar.background : 'linear-gradient(180deg, #d7dadd 0%, #eceff1 100%)',
                                  }}
                                />
                                <div style={styles.barLabel}>{formatShortDay(p.date)}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'today' && (
              <div style={styles.fuelSection}>
                {!hasTodayData || !todayData ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}><Zap size={36} strokeWidth={1.5} /></div>
                    <h3 style={styles.emptyTitle}>No data for today</h3>
                    <p style={styles.emptyText}>Cook a recipe to log today&apos;s nutrition.</p>
                    <button style={styles.emptyBtn} onClick={() => navigate('/customer/cook')}>
                      <ChefHat size={15} /> Cook Now
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={styles.fuelHeader}>
                      <ScoreRing score={todayData?.score || 0} size={96} />
                      <div>
                        <div style={styles.fuelTitle}>Today&apos;s Nutrition</div>
                        <div style={styles.fuelDate}>{todayData?.date}</div>
                        <div
                          style={{
                            ...styles.balancedBadge,
                            background: todayData?.balanced ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)',
                            color: todayData?.balanced ? '#15803d' : '#dc2626',
                          }}
                        >
                          {todayData?.balanced ? 'Balanced day' : 'Needs balance'}
                        </div>
                      </div>
                    </div>
                    <div style={styles.progressList}>
                      <ProgressBar value={totals.calories} label="Calories" unit="kcal" color="linear-gradient(90deg,#ff8a3d,#f24c32)" />
                      <ProgressBar value={totals.protein} label="Protein" unit="g" color="linear-gradient(90deg,#7c6bf1,#9f7aea)" />
                      <ProgressBar value={totals.carbs} label="Carbs" unit="g" color="linear-gradient(90deg,#f4a83f,#f18c20)" />
                      <ProgressBar value={totals.fats} label="Fats" unit="g" color="linear-gradient(90deg,#45c2d7,#0ea5b7)" />
                      <ProgressBar value={totals.vegetables} label="Vegetables" unit="servings" color="linear-gradient(90deg,#65c466,#20a463)" />
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div style={styles.historySection}>
                {daily.length === 0 && cooked.length === 0 ? (
                  <p style={styles.emptyCardText}>No history in this period.</p>
                ) : (
                  <>
                    {daily.length > 0 && (
                      <div style={styles.historyGroup}>
                        <h3 style={styles.historyGroupTitle}>Daily Scores</h3>
                        <div style={styles.historyList}>
                          {daily.map((d) => (
                            <div key={d.date} style={styles.historyRow}>
                              <ScoreRing score={d.score} size={52} />
                              <div style={styles.historyInfo}>
                                <div style={styles.historyDate}>{d.date}</div>
                                <div style={styles.historyNutrients}>
                                  <span>{Math.round(safeNum(d.total_calories))} kcal</span>
                                  <span>{Math.round(safeNum(d.total_protein))}g protein</span>
                                  <span>{Math.round(safeNum(d.total_carbs))}g carbs</span>
                                </div>
                              </div>
                              {d.balanced && <span style={styles.balancedTag}>Balanced</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {cooked.length > 0 && (
                      <div style={styles.historyGroup}>
                        <h3 style={styles.historyGroupTitle}>Cooked Recipes</h3>
                        <div style={styles.historyList}>
                          {cooked.map((c) => (
                            <div key={c.id} style={styles.historyRow}>
                              <div style={styles.recipeIcon}><ChefHat size={18} /></div>
                              <div style={styles.historyInfo}>
                                <div style={styles.historyDate}>{c.recipe_name}</div>
                                <div style={styles.historyNutrients}>
                                  <span>{Math.round(safeNum(c.calories))} kcal</span>
                                  <span>{Math.round(safeNum(c.protein))}g protein</span>
                                  <span>{new Date(c.cooked_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'rewards' && (
              <div style={styles.rewardsSection}>
                <div style={styles.rewardProfile}>
                  <div style={styles.levelBadge}>L{display.level}</div>
                  <div>
                    <div style={styles.rewardProfileName}>{display.points} total points</div>
                    <div style={styles.rewardProfileSub}>{display.badges} healthy-week badges | {display.streak}-day streak</div>
                  </div>
                </div>

                {rewards.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}><Trophy size={36} strokeWidth={1.5} /></div>
                    <h3 style={styles.emptyTitle}>No rewards yet</h3>
                    <p style={styles.emptyText}>Cook recipes and maintain streaks to earn badges and points.</p>
                  </div>
                ) : (
                  <div style={styles.rewardList}>
                    {rewards.map((r) => (
                      <div key={r.id} style={styles.rewardRow}>
                        <div style={styles.rewardDot}>
                          {r.event_type === 'cook_log' ? <ChefHat size={16} /> :
                           r.event_type === 'streak_bonus' ? <Flame size={16} /> :
                           r.event_type === 'healthy_week_badge' ? <Medal size={16} /> :
                           r.event_type === 'level_up' ? <Star size={16} /> :
                           <Trophy size={16} />}
                        </div>
                        <div style={styles.rewardInfo}>
                          <div style={styles.rewardTitle}>{r.title}</div>
                          {r.description && <div style={styles.rewardDesc}>{r.description}</div>}
                          <div style={styles.rewardMeta}>{r.reference_date} | {new Date(r.awarded_at).toLocaleDateString()}</div>
                        </div>
                        <div style={styles.rewardPoints}>+{r.points} pts</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  page: {
    width: '100vw',
    minHeight: '100vh',
    maxWidth: 'none',
    marginLeft: 'calc(50% - 50vw)',
    marginRight: 'calc(50% - 50vw)',
    padding: '1.35rem 1.5rem',
    position: 'relative',
    background: 'var(--gradient-primary)',
    overflow: 'hidden',
  },
  pageGlowA: {
    position: 'absolute',
    top: '-6%',
    left: '2%',
    width: '44%',
    height: '32%',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(225,29,46,0.14) 0%, rgba(225,29,46,0) 72%)',
    pointerEvents: 'none',
    filter: 'blur(8px)',
  },
  pageGlowB: {
    position: 'absolute',
    right: '3%',
    top: '10%',
    width: '30%',
    height: '24%',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(17,17,17,0.08) 0%, rgba(17,17,17,0) 76%)',
    pointerEvents: 'none',
    filter: 'blur(10px)',
  },
  pageShell: {
    position: 'relative',
    zIndex: 1,
    isolation: 'isolate',
    maxWidth: '1540px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
    padding: '1.55rem',
    borderRadius: 34,
    border: '1px solid var(--color-border)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(247,247,247,0.94))',
    boxShadow: 'var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.92)',
    backdropFilter: 'blur(18px)',
    overflow: 'hidden',
  },

  headerRow: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
    borderRadius: 30,
    border: '1px solid var(--color-border)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,247,247,0.99))',
    padding: '1.7rem 1.9rem',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), var(--shadow-sm)',
    overflow: 'hidden',
  },
  pageTitle: {
    margin: 0,
    fontSize: '3.2rem',
    fontWeight: 700,
    color: 'var(--color-text)',
    fontFamily: 'Georgia, "Times New Roman", serif',
    letterSpacing: '-0.03em',
  },
  pageSub: {
    margin: '0.42rem 0 0',
    color: 'var(--color-text-light)',
    fontSize: '1.02rem',
    maxWidth: '560px',
  },
  headerActions: {
    display: 'flex',
    gap: '0.85rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  headerControlShell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: 7,
    borderRadius: 999,
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
  },
  rangeWrap: {
    display: 'flex',
    gap: '0.35rem',
  },
  rangeBtn: {
    border: 'none',
    borderRadius: 999,
    background: 'transparent',
    color: 'var(--color-text-light)',
    fontWeight: 700,
    padding: '13px 22px',
    cursor: 'pointer',
    fontSize: '0.94rem',
    minWidth: 68,
  },
  rangeBtnActive: {
    background: 'rgba(225,29,46,0.12)',
    color: 'var(--color-primary)',
    boxShadow: '0 8px 18px rgba(225,29,46,0.12)',
  },
  refreshBtn: {
    border: 'none',
    width: 46,
    height: 46,
    borderRadius: '50%',
    background: 'transparent',
    color: 'var(--color-text-light)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
  cookBtn: {
    border: 'none',
    borderRadius: 999,
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)',
    color: '#fff',
    fontWeight: 700,
    padding: '14px 26px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    fontSize: '1rem',
    boxShadow: '0 18px 32px rgba(225,29,46,0.22)',
  },

  errorBanner: {
    background: 'rgba(239,68,68,0.09)',
    border: '1px solid rgba(239,68,68,0.22)',
    borderRadius: 20,
    color: '#b91c1c',
    padding: '13px 16px',
    fontSize: '0.9rem',
    boxShadow: '0 12px 22px rgba(120, 32, 32, 0.06)',
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    minHeight: 280,
    borderRadius: 30,
    border: '1px solid var(--color-border)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,247,247,0.99))',
    boxShadow: 'var(--shadow-md)',
  },
  loadingSpinner: {
    width: 32,
    height: 32,
    border: '3px solid rgba(225,29,46,0.14)',
    borderTopColor: 'var(--color-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.9rem',
    minHeight: 340,
    textAlign: 'center',
    padding: '2.6rem',
    borderRadius: 30,
    border: '1px solid var(--color-border)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,247,247,0.99))',
    boxShadow: 'var(--shadow-md)',
  },
  emptyIcon: {
    width: 92,
    height: 92,
    borderRadius: '50%',
    background: 'rgba(225,29,46,0.12)',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--color-primary)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92), 0 12px 24px rgba(225,29,46,0.1)',
  },
  emptyTitle: {
    margin: 0,
    fontSize: '1.45rem',
    fontWeight: 700,
    color: 'var(--color-text)',
    fontFamily: 'Georgia, "Times New Roman", serif',
  },
  emptyText: {
    margin: 0,
    maxWidth: 440,
    color: 'var(--color-text-light)',
    lineHeight: 1.7,
    fontSize: '0.95rem',
  },
  emptyBtn: {
    border: 'none',
    borderRadius: 999,
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)',
    color: '#fff',
    fontWeight: 700,
    padding: '11px 22px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    cursor: 'pointer',
    fontSize: '0.94rem',
    boxShadow: '0 14px 26px rgba(225,29,46,0.22)',
  },
  emptyCardText: {
    margin: 0,
    color: 'var(--color-text-light)',
    fontSize: '0.9rem',
    lineHeight: 1.6,
  },

  contentShell: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    padding: '0.15rem',
  },
  tabBar: {
    display: 'inline-flex',
    gap: '0.45rem',
    padding: '0.45rem',
    borderRadius: 999,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    overflowX: 'auto',
    boxShadow: 'var(--shadow-sm)',
  },
  tabBtn: {
    border: 'none',
    borderRadius: 999,
    background: 'transparent',
    color: 'var(--color-text-light)',
    padding: '13px 28px',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '0.98rem',
    whiteSpace: 'nowrap',
  },
  tabBtnActive: {
    color: 'var(--color-primary)',
    background: 'rgba(225,29,46,0.12)',
    boxShadow: '0 10px 18px rgba(225,29,46,0.12)',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
    gap: '1rem',
  },
  card: {
    borderRadius: 30,
    border: '1px solid var(--color-border)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,247,247,0.99))',
    padding: '1.45rem 1.45rem 1.35rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.95rem',
    boxShadow: 'var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.92)',
    minHeight: 380,
    position: 'relative',
    overflow: 'hidden',
  },
  scoreCard: {},
  cardLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--color-text-light)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },

  scoreRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.35rem',
    flexWrap: 'wrap',
  },
  scoreStats: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
    flex: 1,
    minWidth: 150,
  },
  scoreStatPrimary: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.3rem',
  },
  scoreStat: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.35rem',
  },
  scoreStatVal: {
    fontSize: '2.1rem',
    fontWeight: 800,
    color: 'var(--color-text)',
    lineHeight: 1,
  },
  scoreStatUnit: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--color-text-light)',
  },
  scoreStatMeta: {
    fontSize: '0.9rem',
    color: 'var(--color-text-light)',
  },
  scoreStatLabel: {
    fontSize: '0.88rem',
    color: 'var(--color-text-light)',
  },
  trendChip: {
    marginTop: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.9rem',
    fontWeight: 600,
    paddingTop: '0.85rem',
    borderTop: '1px solid var(--color-border)',
  },

  streakGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: 7,
  },
  streakDay: {
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    padding: '0.45rem 0.3rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.35rem',
  },
  streakDot: {
    height: 20,
    width: '100%',
    borderRadius: 7,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
  },
  streakDayLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--color-text-light)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  streakMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.8rem',
    fontSize: '0.92rem',
    color: 'var(--color-text-light)',
    alignItems: 'center',
  },
  streakHelper: {
    marginTop: '0.7rem',
    fontSize: '0.84rem',
    color: 'var(--color-text-light)',
  },
  streakInsight: {
    marginTop: 'auto',
    minHeight: 84,
    borderRadius: 22,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
    padding: '0.95rem 1rem',
  },
  streakInsightIcon: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(225,29,46,0.12)',
    color: 'var(--color-primary)',
  },
  streakInsightText: {
    color: 'var(--color-text-light)',
    fontSize: '0.92rem',
    fontWeight: 600,
  },

  fixPlateHero: {
    position: 'relative',
    height: 150,
    borderRadius: 24,
    background: 'var(--color-surface-2)',
    overflow: 'hidden',
    display: 'grid',
    placeItems: 'center',
  },
  fixPlateAura: {
    position: 'absolute',
    inset: '18px 22px auto',
    height: 92,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(225,29,46,0.14) 0%, rgba(225,29,46,0) 72%)',
  },
  fixPlatePlate: {
    position: 'relative',
    zIndex: 2,
    width: 94,
    height: 94,
    borderRadius: '50%',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,247,247,0.99))',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--color-primary)',
    boxShadow: '0 14px 30px rgba(17,17,17,0.08)',
  },
  fixPlateProduceTomato: {
    position: 'absolute',
    bottom: 28,
    left: 112,
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 35%, #ff8e98, var(--color-primary) 68%)',
    boxShadow: '0 8px 14px rgba(225,29,46,0.18)',
  },
  fixPlateProduceCarrot: {
    position: 'absolute',
    bottom: 32,
    right: 100,
    width: 58,
    height: 18,
    borderRadius: 20,
    background: 'linear-gradient(90deg, #313131, #111111)',
    transform: 'rotate(-28deg)',
    boxShadow: '0 8px 14px rgba(17,17,17,0.16)',
  },
  fixPlateProduceLeaf: {
    position: 'absolute',
    bottom: 36,
    right: 86,
    width: 28,
    height: 28,
    borderRadius: '60% 20% 60% 20%',
    background: 'linear-gradient(135deg, #4f9f57, #2d7f44)',
    transform: 'rotate(20deg)',
  },
  fixPlateText: {
    margin: 0,
    color: 'var(--color-text-light)',
    fontSize: '0.98rem',
    lineHeight: 1.55,
    minHeight: 64,
  },
  suggestionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
  suggestionItem: {
    paddingLeft: '0.75rem',
    paddingTop: '0.25rem',
    paddingBottom: '0.25rem',
  },
  suggestionTitle: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  suggestionAction: {
    fontSize: '0.82rem',
    color: 'var(--color-text-light)',
    marginTop: 2,
    lineHeight: 1.55,
  },
  softActionBtn: {
    marginTop: 'auto',
    alignSelf: 'flex-start',
    border: '1px solid rgba(225,29,46,0.18)',
    borderRadius: 999,
    background: 'rgba(225,29,46,0.08)',
    color: 'var(--color-primary)',
    fontWeight: 700,
    padding: '12px 22px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    boxShadow: '0 10px 18px rgba(225,29,46,0.1)',
  },

  trendLead: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  trendLeadValue: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '1.05rem',
    fontWeight: 700,
  },
  chartPanel: {
    marginTop: '0.2rem',
    padding: '0.9rem 0.85rem 0.7rem',
    borderRadius: 22,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
  },
  barChart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    height: 190,
    padding: '0.2rem 0.2rem 0',
  },
  barWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    gap: 10,
  },
  bar: {
    width: '100%',
    borderRadius: '14px 14px 8px 8px',
    minHeight: 20,
    transition: 'height 0.3s ease',
    background: 'linear-gradient(180deg, #84d17d 0%, #50bd62 45%, #2d9848 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)',
  },
  barLabel: {
    fontSize: '0.78rem',
    color: 'var(--color-text-light)',
  },

  fuelSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxWidth: 860,
  },
  fuelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.2rem 1.3rem',
    borderRadius: 28,
    border: '1px solid var(--color-border)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,247,247,0.99))',
    boxShadow: 'var(--shadow-md)',
  },
  fuelTitle: {
    fontWeight: 800,
    fontSize: '1.14rem',
    color: 'var(--color-text)',
  },
  fuelDate: {
    fontSize: '0.88rem',
    color: 'var(--color-text-light)',
    marginTop: 3,
  },
  balancedBadge: {
    display: 'inline-block',
    marginTop: '0.55rem',
    padding: '5px 12px',
    borderRadius: 999,
    fontSize: '0.78rem',
    fontWeight: 700,
  },
  progressList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
    padding: '1.2rem 1.25rem',
    borderRadius: 28,
    border: '1px solid var(--color-border)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,247,247,0.99))',
    boxShadow: 'var(--shadow-md)',
  },
  progressItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  progressHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.8rem',
  },
  progressLabel: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--color-text)',
    textTransform: 'capitalize',
  },
  progressValue: {
    fontSize: '0.8rem',
    color: 'var(--color-text-light)',
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    background: 'rgba(17,17,17,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 0.4s ease',
  },
  progressStatus: {
    fontSize: '0.75rem',
    fontWeight: 600,
  },

  historySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
  },
  historyGroup: {},
  historyGroupTitle: {
    margin: '0 0 0.75rem',
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--color-text-light)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.7rem',
  },
  historyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.95rem',
    padding: '0.95rem 1.05rem',
    borderRadius: 22,
    border: '1px solid var(--color-border)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,247,247,0.99))',
    boxShadow: 'var(--shadow-sm)',
  },
  historyInfo: {
    flex: 1,
  },
  historyDate: {
    fontSize: '0.96rem',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  historyNutrients: {
    display: 'flex',
    gap: '0.7rem',
    flexWrap: 'wrap',
    marginTop: 4,
    fontSize: '0.8rem',
    color: 'var(--color-text-light)',
  },
  balancedTag: {
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(22,163,74,0.12)',
    color: '#15803d',
  },
  recipeIcon: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'rgba(225,29,46,0.12)',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--color-primary)',
    flexShrink: 0,
  },

  rewardsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  rewardProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.15rem 1.2rem',
    borderRadius: 26,
    border: '1px solid var(--color-border)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,247,247,0.99))',
    boxShadow: 'var(--shadow-md)',
  },
  levelBadge: {
    width: 58,
    height: 58,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
    fontSize: '1rem',
    flexShrink: 0,
    boxShadow: '0 12px 24px rgba(225,29,46,0.22)',
  },
  rewardProfileName: {
    fontWeight: 700,
    color: 'var(--color-text)',
    fontSize: '1rem',
  },
  rewardProfileSub: {
    fontSize: '0.84rem',
    color: 'var(--color-text-light)',
    marginTop: 2,
  },
  rewardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  rewardRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.9rem',
    padding: '0.95rem 1rem',
    borderRadius: 22,
    border: '1px solid var(--color-border)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,247,247,0.99))',
    boxShadow: 'var(--shadow-sm)',
  },
  rewardDot: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'rgba(225,29,46,0.1)',
    border: '1px solid rgba(225,29,46,0.14)',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--color-primary)',
    flexShrink: 0,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: '0.92rem',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  rewardDesc: {
    fontSize: '0.8rem',
    color: 'var(--color-text-light)',
    marginTop: 2,
    lineHeight: 1.45,
  },
  rewardMeta: {
    fontSize: '0.74rem',
    color: 'var(--color-text-light)',
    marginTop: 4,
  },
  rewardPoints: {
    fontSize: '0.9rem',
    fontWeight: 800,
    color: 'var(--color-primary)',
    flexShrink: 0,
  },
};

export default Nutrition;

if (typeof document !== 'undefined' && !document.getElementById('nutrition-spin-style')) {
  const style = document.createElement('style');
  style.id = 'nutrition-spin-style';
  style.innerText = `@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 0.8s linear infinite; }`;
  document.head.appendChild(style);
}
