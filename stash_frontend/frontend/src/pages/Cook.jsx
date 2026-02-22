import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, RefreshCw, Sparkles, Flame } from 'lucide-react';
import { recipeService, pantryService } from '../services/api';
import '../styles/global.css';

const Cook = () => {
    const navigate = useNavigate();
    const [recommendations, setRecommendations] = useState([]);
    const [recsLoading, setRecsLoading] = useState(false);
    const [recsError, setRecsError] = useState('');
    const [pantryItems, setPantryItems] = useState([]);
    const [selectedIngredients, setSelectedIngredients] = useState([]);

    const fetchRecommendations = async (selection = null) => {
        setRecsError('');
        setRecsLoading(true);
        try {
            const res = await recipeService.getRecommendations(selection);
            const recs = res.data?.recommendations || [];
            setRecommendations(recs);
        } catch (err) {
            setRecsError('Unable to load recommendations. Try again.');
        } finally {
            setRecsLoading(false);
        }
    };

    useEffect(() => {
        const loadPantry = async () => {
            try {
                const res = await pantryService.getItems();
                const items = res.data || [];
                setPantryItems(items);
                const names = items.map((i) => i.ingredient_name).filter(Boolean);
                setSelectedIngredients(names);
            } catch (err) {
                setPantryItems([]);
            }
        };
        loadPantry();
        fetchRecommendations();
    }, []);

    const availableNames = useMemo(
        () => pantryItems.map((i) => i.ingredient_name).filter(Boolean),
        [pantryItems]
    );

    const emptyMessage = useMemo(() => {
        if (availableNames.length === 0) {
            return 'Add items to your pantry to see recommendations.';
        }
        if (selectedIngredients.length === 0) {
            return 'Select at least one ingredient and click "Get AI Recipes".';
        }
        return 'No matching recipes found for the selected ingredients. Try Select All or different ingredients.';
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
        const encoded = encodeURIComponent(url.trim());
        return `/api/image-proxy/?url=${encoded}`;
    };

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Cook</h1>
                    <p style={styles.subtitle}>AI recommendations based on your pantry.</p>
                </div>
                <button style={styles.refreshBtn} onClick={fetchRecommendations} disabled={recsLoading}>
                    <RefreshCw size={18} className={recsLoading ? 'spin' : ''} />
                    Refresh
                </button>
            </div>

            <div style={styles.selectorCard}>
                <div style={styles.selectorHeader}>
                    <div>
                        <h3 style={styles.selectorTitle}>Choose Ingredients</h3>
                        <p style={styles.selectorSubtitle}>Select specific pantry items to tailor recommendations.</p>
                    </div>
                    <div style={styles.selectorActions}>
                        <button style={styles.secondaryBtn} onClick={handleSelectAll}>Select All</button>
                        <button style={styles.secondaryBtn} onClick={handleClearAll}>Clear</button>
                        <button
                            style={styles.primaryBtn}
                            onClick={() => fetchRecommendations(selectedIngredients)}
                            disabled={recsLoading}
                        >
                            <Sparkles size={16} /> Get AI Recipes
                        </button>
                    </div>
                </div>
                <div style={styles.selectorGrid}>
                    {availableNames.map((name) => (
                        <label key={name} style={styles.selectorItem}>
                            <input
                                type="checkbox"
                                checked={selectedIngredients.includes(name)}
                                onChange={() => toggleIngredient(name)}
                            />
                            <span>{name}</span>
                        </label>
                    ))}
                    {availableNames.length === 0 && (
                        <div style={styles.selectorEmpty}>Add pantry items to enable selection.</div>
                    )}
                </div>
            </div>

            {recsError && <div style={styles.errorBanner}>{recsError}</div>}

            {recsLoading ? (
                <div style={styles.aiLoading}>
                    <div className="ai-loader"></div>
                    <div>
                        <div style={styles.aiTitle}><Sparkles size={18} /> AI is preparing your meals</div>
                        <div style={styles.aiSub}>Matching ingredients, nutrition, and freshness...</div>
                    </div>
                </div>
            ) : recommendations.length === 0 ? (
                <div style={styles.emptyState}>
                    {emptyMessage}
                </div>
            ) : (
                <div style={styles.recipeGrid}>
                    {recommendations.map((recipe, index) => {
                        const imgSrc = getRecipeImage(recipe.image_url);
                        return (
                            <div
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
                                </div>
                                <div style={styles.recipeCardHeader}>
                                    <h3 style={styles.recipeCardTitle}>{recipe.name}</h3>
                                    <span style={styles.recipeMatch}>{recipe.match_percent}% match</span>
                                </div>
                                <div style={styles.recipeMeta}>
                                    <span style={styles.metaBadge}><Flame size={14} /> {Math.round(recipe.nutrition?.calories || 0)} kcal</span>
                                    <span style={styles.metaBadge}>{recipe.minutes} min</span>
                                    <span style={styles.metaBadge}>{recipe.difficulty}</span>
                                </div>
                                <button style={styles.detailBtn} onClick={() => navigate(`/customer/recipes/${recipe.id}`)}>
                                    <ChefHat size={16} /> View Details
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const styles = {
    page: { maxWidth: '1200px', margin: '0 auto', padding: '2rem' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' },
    title: { fontSize: '2.5rem', fontWeight: '700', color: 'var(--color-text)' },
    subtitle: { color: 'var(--color-text-light)' },
    refreshBtn: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '10px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
    errorBanner: { background: 'rgba(225,29,46,0.1)', color: 'var(--color-primary)', padding: '10px 14px', borderRadius: '10px', marginBottom: '1rem', border: '1px solid rgba(225,29,46,0.2)' },
    selectorCard: { background: 'var(--color-surface)', borderRadius: '20px', border: '1px solid var(--color-border)', padding: '1.5rem', marginBottom: '2rem', boxShadow: 'var(--shadow-sm)' },
    selectorHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' },
    selectorTitle: { margin: 0 },
    selectorSubtitle: { color: 'var(--color-text-light)', marginTop: '0.3rem' },
    selectorActions: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' },
    selectorGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' },
    selectorItem: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface-2)', borderRadius: '999px', padding: '8px 12px', border: '1px solid var(--color-border)', fontSize: '0.9rem' },
    selectorEmpty: { color: 'var(--color-text-light)', padding: '0.6rem' },
    primaryBtn: { background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '999px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' },
    secondaryBtn: { background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: '8px 12px', borderRadius: '999px', cursor: 'pointer' },
    aiLoading: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '2rem', borderRadius: '20px', background: 'var(--color-surface)', border: '1px dashed var(--color-border)' },
    aiTitle: { fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' },
    aiSub: { color: 'var(--color-text-light)', marginTop: '0.4rem' },
    emptyState: { padding: '3rem', textAlign: 'center', color: 'var(--color-text-light)', background: 'var(--color-surface)', borderRadius: '20px', border: '1px dashed var(--color-border)' },
    recipeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem' },
    recipeCard: { background: 'var(--color-surface)', borderRadius: '18px', padding: '1.2rem', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' },
    recipeThumb: { height: '150px', borderRadius: '12px', overflow: 'hidden', marginBottom: '0.8rem', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)' },
    recipeImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    recipeCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' },
    recipeCardTitle: { fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-text)' },
    recipeMatch: { fontSize: '0.85rem', color: 'var(--color-primary)' },
    recipeMeta: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', color: 'var(--color-text-light)', fontSize: '0.85rem' },
    metaBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--color-surface-2)', padding: '4px 8px', borderRadius: '999px' },
    detailBtn: { marginTop: '1rem', width: '100%', background: 'var(--color-primary)', color: '#ffffff', border: 'none', padding: '10px 14px', borderRadius: '999px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' },
};

export default Cook;
