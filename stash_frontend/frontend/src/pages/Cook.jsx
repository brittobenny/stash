import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChefHat,
    Download,
    RefreshCw,
    Sparkles,
    Flame,
    Gauge,
    Salad,
    CheckCircle2,
    Search,
} from 'lucide-react';
import { recipeService, pantryService } from '../services/api';
import { downloadRecipePdf } from '../utils/recipePdf';
import cookLoaderPrimary from '../assets/cook-loader-primary.mp4';
import cookLoaderSecondary from '../assets/cook-loader-secondary.mp4';
import '../styles/global.css';

let cookPageMemory = null;
const LOADING_PHASES = [
    { label: 'Scanning pantry', detail: 'Reading ingredient quantities and freshness.' },
    { label: 'Finding matches', detail: 'Comparing your pantry with recipe requirements.' },
    { label: 'Scoring nutrition', detail: 'Ranking meals by quality and balance.' },
    { label: 'Building cards', detail: 'Preparing the best recipes for display.' },
];

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
    const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0);
    const [downloadingRecipeId, setDownloadingRecipeId] = useState(null);

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

    useEffect(() => {
        if (!recsLoading) {
            setLoadingPhaseIndex(0);
            return;
        }
        const timer = setInterval(() => {
            setLoadingPhaseIndex((prev) => (prev + 1) % LOADING_PHASES.length);
        }, 1050);
        return () => clearInterval(timer);
    }, [recsLoading]);

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

    const handleDownloadRecipe = async (recipeId) => {
        setRecsError('');
        setDownloadingRecipeId(recipeId);
        try {
            const res = await recipeService.getRecipeDetail(recipeId);
            const ok = downloadRecipePdf(res.data);
            if (!ok) {
                setRecsError('Popup blocked. Allow popups to download the recipe as PDF.');
            }
        } catch (err) {
            setRecsError('Unable to prepare the recipe PDF. Try again.');
        } finally {
            setDownloadingRecipeId(null);
        }
    };

    const buildFallbackSourceUrl = (recipeName) => {
        const name = String(recipeName || '').trim().toLowerCase();
        const query = encodeURIComponent(name ? `${name} indian food recipe` : 'indian food recipe');
        return `/api/live-recipe-image/?q=${query}&fallback=${encodeURIComponent('/api/category-image/vegetable/')}`;
    };

    const buildRecipeFallback = (recipeName) => {
        return `/api/image-proxy/?fallback=${encodeURIComponent(buildFallbackSourceUrl(recipeName))}`;
    };

    const getRecipeImage = (recipe) => {
        const rawUrl = String(recipe?.image_url || '').trim();
        const fallbackProxy = buildRecipeFallback(recipe?.name);
        if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return fallbackProxy;
        return `/api/image-proxy/?url=${encodeURIComponent(rawUrl)}&fallback=${encodeURIComponent(buildFallbackSourceUrl(recipe?.name))}`;
    };

    const getMatchTone = (percent) => {
        const p = Number(percent || 0);
        if (p >= 70) return styles.matchHigh;
        if (p >= 45) return styles.matchMid;
        return styles.matchLow;
    };

    const activeLoaderVideo = loadingPhaseIndex % 2 === 0 ? cookLoaderPrimary : cookLoaderSecondary;
    const previewLoaderVideo = loadingPhaseIndex % 2 === 0 ? cookLoaderSecondary : cookLoaderPrimary;

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
                            <div style={styles.aiVideoBackdrop}>
                                <video
                                    key={activeLoaderVideo}
                                    style={styles.aiVideo}
                                    src={activeLoaderVideo}
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                />
                                <div style={styles.aiVideoOverlay} />
                            </div>

                            <div style={styles.aiLoaderContent}>
                                <div style={styles.aiHeaderRow}>
                                    <div style={styles.aiPulseDot} className="cook-loader-breathe" />
                                    <div style={styles.aiTextBlock}>
                                        <div style={styles.aiTitle}>{LOADING_PHASES[loadingPhaseIndex].label}</div>
                                        <div style={styles.aiSub}>{LOADING_PHASES[loadingPhaseIndex].detail}</div>
                                    </div>
                                    <div style={styles.aiPercent}>
                                        {Math.round(((loadingPhaseIndex + 1) / LOADING_PHASES.length) * 100)}%
                                    </div>
                                </div>

                                <div style={styles.aiProgressTrack}>
                                    <div
                                        style={{
                                            ...styles.aiProgressFill,
                                            width: `${((loadingPhaseIndex + 1) / LOADING_PHASES.length) * 100}%`,
                                        }}
                                        className="cook-loader-progress"
                                    />
                                </div>

                                <div style={styles.aiSteps}>
                                    {LOADING_PHASES.map((step, idx) => (
                                        <span
                                            key={step.label}
                                            style={
                                                idx <= loadingPhaseIndex
                                                    ? { ...styles.aiStepPill, ...styles.aiStepPillActive }
                                                    : styles.aiStepPill
                                            }
                                        >
                                            {step.label}
                                        </span>
                                    ))}
                                </div>

                                <div style={styles.aiCinemaRow} className="cook-ai-cinema-row">
                                    <div style={styles.aiCinemaCard}>
                                        <div style={styles.aiCinemaLabel}>Kitchen preview</div>
                                        <video
                                            key={previewLoaderVideo}
                                            style={styles.aiPreviewVideo}
                                            src={previewLoaderVideo}
                                            autoPlay
                                            muted
                                            loop
                                            playsInline
                                        />
                                    </div>
                                    <div style={styles.aiCinemaCopy}>
                                        <div style={styles.aiCinemaHeadline}>Building your recipe board</div>
                                        <div style={styles.aiFooterNote}>
                                            Preparing recipe cards with live image lookups, ingredient checks, and nutrition scores.
                                        </div>
                                        <div style={styles.aiCinemaMiniNotes}>
                                            <span style={styles.aiMiniNote}>Real pantry quantities</span>
                                            <span style={styles.aiMiniNote}>Hero ingredient checks</span>
                                            <span style={styles.aiMiniNote}>Balanced nutrition scoring</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : recommendations.length === 0 ? (
                        <div style={styles.emptyState}>{emptyMessage}</div>
                    ) : (
                        <div style={styles.recipeGrid}>
                            {recommendations.map((recipe, index) => {
                                const imgSrc = getRecipeImage(recipe);
                                const fallbackSrc = buildRecipeFallback(recipe.name);
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
                                                data-fallback={fallbackSrc}
                                                onError={(e) => {
                                                    const fallback = e.currentTarget.dataset.fallback;
                                                    if (fallback && e.currentTarget.dataset.triedFallback !== '1') {
                                                        e.currentTarget.dataset.triedFallback = '1';
                                                        e.currentTarget.src = fallback;
                                                        return;
                                                    }
                                                    e.currentTarget.onerror = null;
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
                                            {(recipe.nutrition_badges || []).length > 0 && (
                                                <div style={styles.badgeRow}>
                                                    {(recipe.nutrition_badges || []).slice(0, 3).map((badge, idx) => (
                                                        <span key={`${recipe.id}-badge-${idx}`} style={styles.nutritionBadge}>
                                                            {badge}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <div style={styles.progressTrack}>
                                                <div
                                                    style={{
                                                        ...styles.progressFill,
                                                        width: `${Math.min(100, Number(recipe.match_percent || 0))}%`,
                                                    }}
                                                />
                                            </div>

                                            <div style={styles.actionRow}>
                                                <button
                                                    style={styles.secondaryBtn}
                                                    onClick={() => handleDownloadRecipe(recipe.id)}
                                                    disabled={downloadingRecipeId === recipe.id}
                                                >
                                                    <Download size={16} />
                                                    {downloadingRecipeId === recipe.id ? 'Preparing PDF...' : 'Download PDF'}
                                                </button>
                                                <button
                                                    style={styles.detailBtn}
                                                    onClick={() => navigate(`/customer/recipes/${recipe.id}`, { state: { from: '/customer/cook' } })}
                                                >
                                                    <ChefHat size={16} />
                                                    View Details
                                                </button>
                                            </div>
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
        minHeight: '360px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.95rem',
        padding: '1.4rem',
        borderRadius: '18px',
        border: '1px solid rgba(225,29,46,0.2)',
        background: 'var(--color-surface)',
        position: 'relative',
        overflow: 'hidden',
    },
    aiVideoBackdrop: {
        position: 'absolute',
        inset: 0,
    },
    aiVideo: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
    },
    aiVideoOverlay: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(15,15,15,0.72), rgba(15,15,15,0.48) 45%, rgba(120,24,24,0.44))',
        backdropFilter: 'blur(2px)',
    },
    aiLoaderContent: {
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.95rem',
        height: '100%',
    },
    aiHeaderRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.9rem',
    },
    aiPulseDot: {
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: 'linear-gradient(145deg, #e11d2e, #f97316)',
        boxShadow: '0 0 0 0 rgba(225,29,46,0.45)',
        flexShrink: 0,
    },
    aiTextBlock: { flex: 1, minWidth: 0 },
    aiTitle: { fontWeight: 800, fontSize: '1.05rem', color: '#fff' },
    aiSub: { color: 'rgba(255,255,255,0.8)', marginTop: '0.15rem', fontSize: '0.9rem' },
    aiPercent: {
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,0.18)',
        background: 'rgba(255,255,255,0.12)',
        color: '#fff',
        fontWeight: 700,
        fontSize: '0.82rem',
        padding: '6px 10px',
        flexShrink: 0,
    },
    aiProgressTrack: {
        width: '100%',
        height: '7px',
        borderRadius: '999px',
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.18)',
    },
    aiProgressFill: {
        height: '100%',
        borderRadius: '999px',
        background: 'linear-gradient(90deg, #f97316 0%, #e11d2e 70%, #991b1b 100%)',
    },
    aiSteps: { display: 'flex', gap: '0.45rem', flexWrap: 'wrap' },
    aiStepPill: {
        borderRadius: '999px',
        padding: '6px 10px',
        fontSize: '0.78rem',
        background: 'rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.78)',
        border: '1px solid rgba(255,255,255,0.14)',
    },
    aiStepPillActive: {
        background: 'linear-gradient(90deg, rgba(225,29,46,0.28), rgba(249,115,22,0.24))',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.16)',
    },
    aiCinemaRow: {
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 300px) 1fr',
        gap: '0.75rem',
        width: '100%',
        marginTop: '0.15rem',
        alignItems: 'stretch',
    },
    aiCinemaCard: {
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
    },
    aiCinemaLabel: {
        padding: '0.75rem 0.85rem 0.35rem',
        color: 'rgba(255,255,255,0.82)',
        fontSize: '0.76rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
    },
    aiPreviewVideo: {
        width: '100%',
        height: '190px',
        objectFit: 'cover',
        display: 'block',
    },
    aiCinemaCopy: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        gap: '0.55rem',
        padding: '0.9rem 0.2rem 0.2rem',
    },
    aiCinemaHeadline: {
        fontSize: '1.35rem',
        lineHeight: 1.15,
        fontWeight: 800,
        color: '#fff',
        maxWidth: '460px',
    },
    aiFooterNote: { fontSize: '0.88rem', color: 'rgba(255,255,255,0.78)', maxWidth: '520px' },
    aiCinemaMiniNotes: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.15rem' },
    aiMiniNote: {
        borderRadius: '999px',
        padding: '6px 10px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.84)',
        fontSize: '0.76rem',
        fontWeight: 600,
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
    badgeRow: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.55rem' },
    nutritionBadge: {
        borderRadius: '999px',
        background: 'rgba(22,163,74,0.12)',
        color: '#166534',
        border: '1px solid rgba(22,163,74,0.28)',
        padding: '3px 8px',
        fontSize: '0.74rem',
        fontWeight: 700,
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
        flex: 1,
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
    actionRow: {
        marginTop: '0.8rem',
        display: 'flex',
        gap: '0.55rem',
    },
    secondaryBtn: {
        flex: 1,
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-2)',
        color: 'var(--color-text)',
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
      @keyframes cookLoaderBreathe {
        0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(225,29,46,0.45); }
        50% { transform: scale(1.15); box-shadow: 0 0 0 8px rgba(249,115,22,0.14); }
      }
      @keyframes cookLoaderShimmer {
        0% { background-position: 180% 0; }
        100% { background-position: -180% 0; }
      }
      .cook-loader-breathe { animation: cookLoaderBreathe 1.7s ease-in-out infinite; }
      .cook-loader-progress { transition: width 320ms ease; }
      .cook-loader-shimmer {
        background-image: linear-gradient(90deg, #e6dfdf 8%, #f3efef 50%, #e6dfdf 92%);
        background-size: 220% 100%;
        animation: cookLoaderShimmer 1.45s ease-in-out infinite;
      }
      @media (max-width: 760px) {
        .cook-ai-cinema-row {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(styleSheet);
}

export default Cook;
