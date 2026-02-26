import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChefHat,
    RefreshCw,
    Sparkles,
    Flame,
    Gauge,
    Salad,
    CheckCircle2,
    Search,
} from 'lucide-react';
import { recipeService, pantryService } from '../services/api';
import '../styles/global.css';

let cookPageMemory = null;
const getUserCacheKey = () => {
    try {
        const rawUser = localStorage.getItem('user');
        if (rawUser) {
            const parsed = JSON.parse(rawUser);
            if (parsed?.id) return `u:${parsed.id}`;
            if (parsed?.email) return `e:${parsed.email}`;
        }
    } catch (err) {
        // ignore malformed local user cache
    }
    const token = localStorage.getItem('token') || '';
    return token ? `t:${token.slice(-16)}` : 'anon';
};

const Cook = () => {
    const navigate = useNavigate();
    const cacheKey = getUserCacheKey();
    const [recommendations, setRecommendations] = useState([]);
    const [recsLoading, setRecsLoading] = useState(false);
    const [recsError, setRecsError] = useState('');
    const [pantryItems, setPantryItems] = useState([]);
    const [selectedIngredients, setSelectedIngredients] = useState([]);
    const [ingredientSearch, setIngredientSearch] = useState('');

    const fetchRecommendations = async (selection = null) => {
        setRecsError('');
        setRecsLoading(true);
        try {
            const res = await recipeService.getRecommendations(selection, { top_k: 10, min_match_percent: 25 });
            setRecommendations(res.data?.recommendations || []);
        } catch (err) {
            setRecsError('Unable to load recommendations. Try again.');
        } finally {
            setRecsLoading(false);
        }
    };

    useEffect(() => {
        const hasValidMemory = Boolean(cookPageMemory && cookPageMemory.cacheKey === cacheKey);
        if (hasValidMemory) {
            setRecommendations(cookPageMemory.recommendations || []);
            setPantryItems(cookPageMemory.pantryItems || []);
            setSelectedIngredients(cookPageMemory.selectedIngredients || []);
            setIngredientSearch(cookPageMemory.ingredientSearch || '');
        }

        const loadPantry = async () => {
            try {
                const res = await pantryService.getItems();
                const items = res.data || [];
                setPantryItems(items);
                const names = items.map((i) => i.ingredient_name).filter(Boolean);
                if (hasValidMemory) {
                    setSelectedIngredients((prev) => prev.filter((name) => names.includes(name)));
                } else {
                    setSelectedIngredients(names);
                    fetchRecommendations(names);
                }
            } catch (err) {
                if (!hasValidMemory) {
                    setPantryItems([]);
                    fetchRecommendations();
                }
            }
        };
        loadPantry();
    }, [cacheKey]);

    useEffect(() => {
        cookPageMemory = {
            cacheKey,
            recommendations,
            pantryItems,
            selectedIngredients,
            ingredientSearch,
        };
    }, [cacheKey, recommendations, pantryItems, selectedIngredients, ingredientSearch]);

    const availableNames = useMemo(
        () => pantryItems.map((i) => i.ingredient_name).filter(Boolean),
        [pantryItems]
    );

    const filteredNames = useMemo(() => {
        const q = ingredientSearch.trim().toLowerCase();
        if (!q) return availableNames;
        return availableNames.filter((name) => name.toLowerCase().includes(q));
    }, [availableNames, ingredientSearch]);

    const selectedSet = useMemo(() => new Set(selectedIngredients), [selectedIngredients]);

    const avgMatch = useMemo(() => {
        if (!recommendations.length) return 0;
        const sum = recommendations.reduce((acc, r) => acc + Number(r.match_percent || 0), 0);
        return Math.round(sum / recommendations.length);
    }, [recommendations]);

    const avgNutritionScore = useMemo(() => {
        if (!recommendations.length) return 0;
        const sum = recommendations.reduce((acc, r) => acc + Number(r.nutrition_score || 0), 0);
        return Math.round((sum / recommendations.length) * 100);
    }, [recommendations]);

    const emptyMessage = useMemo(() => {
        if (availableNames.length === 0) {
            return 'Add pantry items to start getting recommendations.';
        }
        if (selectedIngredients.length === 0) {
            return 'Select at least one ingredient and then click Get AI Recipes.';
        }
        return 'No matching recipes found for the selected ingredients.';
    }, [availableNames.length, selectedIngredients.length]);

    const toggleIngredient = (name) => {
        setSelectedIngredients((prev) =>
            prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
        );
    };

    const handleSelectAll = () => {
        setSelectedIngredients(availableNames);
    };

    const handleClearAll = () => {
        setSelectedIngredients([]);
    };

    const getRecipeImage = (url) => {
        const localFallback = '/api/category-image/vegetable/';
        if (!url || !/^https?:\/\//i.test(url)) return localFallback;
        return `/api/image-proxy/?url=${encodeURIComponent(url.trim())}`;
    };

    const getMatchTone = (percent) => {
        const p = Number(percent || 0);
        if (p >= 70) return styles.matchHigh;
        if (p >= 45) return styles.matchMid;
        return styles.matchLow;
    };

    return (
        <div style={styles.page}>
            <div style={styles.container}>
                <section style={styles.headerCard} className="fade-up">
                    <div style={styles.headerText}>
                        <p style={styles.eyebrow}>COOK STUDIO</p>
                        <h1 style={styles.title}>Find recipes from your pantry</h1>
                        <p style={styles.subtitle}>
                            Pick specific ingredients or use everything in stock. We rank recipes by pantry match and nutrition fit.
                        </p>
                    </div>
                    <div style={styles.metricGrid}>
                        <div style={styles.metricCard}>
                            <Gauge size={16} />
                            <div>
                                <p style={styles.metricLabel}>Avg Match</p>
                                <p style={styles.metricValue}>{avgMatch}%</p>
                            </div>
                        </div>
                        <div style={styles.metricCard}>
                            <Salad size={16} />
                            <div>
                                <p style={styles.metricLabel}>Nutrition Fit</p>
                                <p style={styles.metricValue}>{avgNutritionScore}%</p>
                            </div>
                        </div>
                        <div style={styles.metricCard}>
                            <CheckCircle2 size={16} />
                            <div>
                                <p style={styles.metricLabel}>Recipes</p>
                                <p style={styles.metricValue}>{recommendations.length}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {recsError && <div style={styles.errorBanner}>{recsError}</div>}

                <section style={styles.filterCard} className="fade-up">
                    <div style={styles.filterTop}>
                        <div style={styles.searchBox}>
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Search pantry ingredients..."
                                value={ingredientSearch}
                                onChange={(e) => setIngredientSearch(e.target.value)}
                                style={styles.searchInput}
                            />
                        </div>
                        <div style={styles.actions}>
                            <button style={styles.softBtn} onClick={handleSelectAll}>Select All</button>
                            <button style={styles.softBtn} onClick={handleClearAll}>Clear</button>
                            <button
                                style={styles.softBtn}
                                onClick={() => fetchRecommendations(selectedIngredients)}
                                disabled={recsLoading}
                            >
                                <RefreshCw size={16} className={recsLoading ? 'spin' : ''} />
                                Refresh
                            </button>
                            <button
                                style={styles.primaryBtn}
                                onClick={() => fetchRecommendations(selectedIngredients)}
                                disabled={recsLoading}
                            >
                                <Sparkles size={16} />
                                Get AI Recipes
                            </button>
                        </div>
                    </div>

                    <div style={styles.selectionInfo}>
                        Selected {selectedIngredients.length} / {availableNames.length}
                    </div>

                    <div style={styles.chipGrid}>
                        {filteredNames.map((name) => {
                            const active = selectedSet.has(name);
                            return (
                                <label
                                    key={name}
                                    style={active ? { ...styles.chip, ...styles.chipActive } : styles.chip}
                                    className="hover-float"
                                >
                                    <input
                                        type="checkbox"
                                        checked={active}
                                        onChange={() => toggleIngredient(name)}
                                        style={styles.hiddenCheckbox}
                                    />
                                    <span>{name}</span>
                                </label>
                            );
                        })}
                        {availableNames.length === 0 && (
                            <div style={styles.selectorEmpty}>No pantry ingredients available yet.</div>
                        )}
                        {availableNames.length > 0 && filteredNames.length === 0 && (
                            <div style={styles.selectorEmpty}>No ingredients match your search.</div>
                        )}
                    </div>
                </section>

                <section style={styles.resultsSection}>
                    {recsLoading ? (
                        <div style={styles.aiLoadingStage} className="fade-up">
                            <div style={styles.aiOrbitalWrap}>
                                <div style={styles.aiCore} className="cook-ai-pulse">
                                    <Sparkles size={24} />
                                </div>
                                <div style={styles.aiOrbitRing} className="cook-ai-spin">
                                    <span style={{ ...styles.aiOrbitDot, ...styles.aiDotOne }} />
                                    <span style={{ ...styles.aiOrbitDot, ...styles.aiDotTwo }} />
                                    <span style={{ ...styles.aiOrbitDot, ...styles.aiDotThree }} />
                                </div>
                            </div>
                            <div style={styles.aiTextBlock}>
                                <div style={styles.aiTitle}>Preparing your recommendations...</div>
                                <div style={styles.aiSub}>Matching pantry inventory, checking substitutions, and ranking top 10 recipes.</div>
                                <div style={styles.aiSteps}>
                                    <span style={styles.aiStepPill}>Analyzing ingredients</span>
                                    <span style={styles.aiStepPill}>Scoring nutrition fit</span>
                                    <span style={styles.aiStepPill}>Finalizing best matches</span>
                                </div>
                            </div>
                        </div>
                    ) : recommendations.length === 0 ? (
                        <div style={styles.emptyState}>{emptyMessage}</div>
                    ) : (
                        <div style={styles.recipeGrid}>
                            {recommendations.map((recipe, index) => {
                                const imgSrc = getRecipeImage(recipe.image_url);
                                return (
                                    <article
                                        key={recipe.id}
                                        style={{ ...styles.recipeCard, animationDelay: `${index * 0.05}s` }}
                                        className="fade-up hover-float"
                                    >
                                        <div style={styles.recipeThumb}>
                                            <img
                                                src={imgSrc}
                                                alt={recipe.name}
                                                style={styles.recipeImg}
                                                onError={(e) => {
                                                    e.currentTarget.src = '/api/category-image/vegetable/';
                                                }}
                                            />
                                            <span style={{ ...styles.recipeMatch, ...getMatchTone(recipe.match_percent) }}>
                                                {recipe.match_percent}% match
                                            </span>
                                        </div>

                                        <div style={styles.recipeBody}>
                                            <h3 style={styles.recipeTitle}>{recipe.name}</h3>

                                            <div style={styles.metaRow}>
                                                <span style={styles.metaBadge}><Flame size={14} /> {Math.round(recipe.nutrition?.calories || 0)} kcal</span>
                                                <span style={styles.metaBadge}>{recipe.minutes} min</span>
                                                <span style={styles.metaBadge}>{recipe.difficulty}</span>
                                                {recipe.nutrition_score !== undefined && (
                                                    <span style={styles.metaBadge}>Nutrition {Math.round((recipe.nutrition_score || 0) * 100)}%</span>
                                                )}
                                            </div>

                                            <div style={styles.progressTrack}>
                                                <div
                                                    style={{
                                                        ...styles.progressFill,
                                                        width: `${Math.min(100, Number(recipe.match_percent || 0))}%`,
                                                    }}
                                                />
                                            </div>

                                            <button
                                                style={styles.detailBtn}
                                                onClick={() => navigate(`/customer/recipes/${recipe.id}`, { state: { from: '/customer/cook' } })}
                                            >
                                                <ChefHat size={16} />
                                                View Details
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

const styles = {
    page: {
        width: '100%',
        minHeight: '100vh',
        padding: '1.25rem 1.5rem 2rem',
        background: 'linear-gradient(180deg, #faf9f8 0%, #f5f3f2 100%)',
    },
    container: {
        width: '100%',
        maxWidth: '1500px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    headerCard: {
        borderRadius: '18px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        padding: '1.1rem 1.2rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1rem',
        alignItems: 'center',
    },
    headerText: { minWidth: 0 },
    eyebrow: {
        marginBottom: '0.25rem',
        fontSize: '0.78rem',
        fontWeight: 700,
        letterSpacing: '0.14em',
        color: 'var(--color-primary)',
    },
    title: {
        fontFamily: 'var(--font-heading)',
        fontSize: '2rem',
        color: 'var(--color-text)',
        marginBottom: '0.35rem',
    },
    subtitle: { color: 'var(--color-text-light)', maxWidth: '720px' },
    metricGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '0.6rem',
    },
    metricCard: {
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-2)',
        padding: '0.7rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.55rem',
        minHeight: '70px',
    },
    metricLabel: { fontSize: '0.78rem', color: 'var(--color-text-light)' },
    metricValue: { fontWeight: 700, color: 'var(--color-text)', fontSize: '1.05rem' },
    errorBanner: {
        background: 'rgba(225,29,46,0.1)',
        color: 'var(--color-primary)',
        border: '1px solid rgba(225,29,46,0.2)',
        borderRadius: '12px',
        padding: '10px 14px',
    },
    filterCard: {
        borderRadius: '18px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
    },
    filterTop: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '0.8rem',
        alignItems: 'center',
    },
    searchBox: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-2)',
        minWidth: 0,
    },
    searchInput: {
        flex: 1,
        minWidth: 0,
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: 'var(--color-text)',
        fontSize: '0.95rem',
    },
    actions: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
    },
    softBtn: {
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        background: 'var(--color-surface-2)',
        color: 'var(--color-text)',
        padding: '9px 12px',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
    },
    primaryBtn: {
        border: '1px solid transparent',
        borderRadius: '10px',
        background: 'var(--color-primary)',
        color: '#fff',
        padding: '9px 14px',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
        boxShadow: '0 8px 18px rgba(225,29,46,0.22)',
    },
    selectionInfo: { color: 'var(--color-text-light)', fontSize: '0.88rem' },
    chipGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '170px', overflowY: 'auto', paddingRight: '2px' },
    chip: {
        borderRadius: '999px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-2)',
        color: 'var(--color-text)',
        padding: '7px 12px',
        fontSize: '0.88rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    chipActive: {
        border: '1px solid rgba(225,29,46,0.34)',
        background: 'rgba(225,29,46,0.1)',
        color: 'var(--color-primary)',
        boxShadow: '0 4px 12px rgba(225,29,46,0.15)',
    },
    hiddenCheckbox: { display: 'none' },
    selectorEmpty: {
        color: 'var(--color-text-light)',
        fontSize: '0.9rem',
        border: '1px dashed var(--color-border)',
        borderRadius: '12px',
        padding: '10px 12px',
        width: '100%',
    },
    resultsSection: { minHeight: '280px' },
    aiLoadingStage: {
        minHeight: '320px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.2rem',
        padding: '1.4rem',
        borderRadius: '18px',
        border: '1px solid rgba(225,29,46,0.2)',
        background: 'var(--color-surface)',
        position: 'relative',
        overflow: 'hidden',
    },
    aiOrbitalWrap: {
        position: 'relative',
        width: '140px',
        height: '140px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiCore: {
        width: '66px',
        height: '66px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        background: 'linear-gradient(145deg, #e11d2e, #f97316)',
        boxShadow: '0 16px 30px rgba(225,29,46,0.35)',
        zIndex: 2,
    },
    aiOrbitRing: {
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        border: '2px dashed rgba(225,29,46,0.3)',
    },
    aiOrbitDot: {
        position: 'absolute',
        width: '12px',
        height: '12px',
        borderRadius: '50%',
    },
    aiDotOne: { top: '-6px', left: '50%', marginLeft: '-6px', background: '#ef4444' },
    aiDotTwo: { left: '-6px', top: '50%', marginTop: '-6px', background: '#f59e0b' },
    aiDotThree: { right: '-6px', top: '50%', marginTop: '-6px', background: '#22c55e' },
    aiTextBlock: { textAlign: 'center', maxWidth: '620px' },
    aiTitle: { fontWeight: 800, fontSize: '1.18rem', color: 'var(--color-text)' },
    aiSub: { color: 'var(--color-text-light)', marginTop: '0.3rem' },
    aiSteps: { marginTop: '0.9rem', display: 'flex', gap: '0.45rem', justifyContent: 'center', flexWrap: 'wrap' },
    aiStepPill: {
        borderRadius: '999px',
        padding: '6px 10px',
        fontSize: '0.78rem',
        background: 'linear-gradient(90deg, rgba(225,29,46,0.12), rgba(249,115,22,0.15))',
        color: 'var(--color-text)',
        border: '1px solid rgba(225,29,46,0.2)',
    },
    emptyState: {
        borderRadius: '16px',
        border: '1px dashed var(--color-border)',
        background: 'var(--color-surface)',
        padding: '2.2rem 1.2rem',
        textAlign: 'center',
        color: 'var(--color-text-light)',
    },
    recipeGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(275px, 1fr))',
        gap: '0.9rem',
    },
    recipeCard: {
        borderRadius: '16px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
    },
    recipeThumb: {
        position: 'relative',
        height: '170px',
        overflow: 'hidden',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface-2)',
    },
    recipeImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
    },
    recipeMatch: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        borderRadius: '999px',
        padding: '5px 10px',
        color: '#fff',
        fontSize: '0.8rem',
        fontWeight: 700,
    },
    matchHigh: { background: '#16a34a' },
    matchMid: { background: '#ca8a04' },
    matchLow: { background: '#dc2626' },
    recipeBody: { padding: '0.9rem' },
    recipeTitle: {
        fontSize: '1.08rem',
        color: 'var(--color-text)',
        lineHeight: 1.35,
        marginBottom: '0.55rem',
    },
    metaRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.45rem',
    },
    metaBadge: {
        borderRadius: '999px',
        background: 'var(--color-surface-2)',
        color: 'var(--color-text-light)',
        padding: '4px 9px',
        fontSize: '0.79rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
    },
    progressTrack: {
        marginTop: '0.75rem',
        height: '6px',
        borderRadius: '999px',
        overflow: 'hidden',
        background: '#ececec',
    },
    progressFill: {
        height: '100%',
        borderRadius: '999px',
        background: 'linear-gradient(90deg, #f97316 0%, #e11d2e 70%, #991b1b 100%)',
    },
    detailBtn: {
        width: '100%',
        marginTop: '0.8rem',
        borderRadius: '10px',
        border: 'none',
        background: 'var(--color-primary)',
        color: '#fff',
        padding: '10px 12px',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        cursor: 'pointer',
    },
};

if (typeof document !== 'undefined' && !document.getElementById('cook-ai-loader-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'cook-ai-loader-styles';
    styleSheet.innerText = `
      @keyframes cookAiSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes cookAiPulse {
        0%, 100% { transform: scale(1); box-shadow: 0 14px 26px rgba(225,29,46,0.26); }
        50% { transform: scale(1.06); box-shadow: 0 20px 34px rgba(249,115,22,0.34); }
      }
      .cook-ai-spin { animation: cookAiSpin 4.8s linear infinite; }
      .cook-ai-pulse { animation: cookAiPulse 1.8s ease-in-out infinite; }
    `;
    document.head.appendChild(styleSheet);
}

export default Cook;
