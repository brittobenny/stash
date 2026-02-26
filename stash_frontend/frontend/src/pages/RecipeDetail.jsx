import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChefHat, Flame, Leaf, AlertTriangle, Save, Search } from 'lucide-react';
import { recipeService, shopService } from '../services/api';
import '../styles/global.css';

const RecipeDetail = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const [recipe, setRecipe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCookModal, setShowCookModal] = useState(false);
    const [cookList, setCookList] = useState([]);
    const [cooking, setCooking] = useState(false);
    const [cookResult, setCookResult] = useState(null);
    const [allowPartial, setAllowPartial] = useState(true);
    const [ingredientFilter, setIngredientFilter] = useState('');
    const [imageSrc, setImageSrc] = useState('');
    const [addingMissing, setAddingMissing] = useState(false);
    const [addMissingMsg, setAddMissingMsg] = useState('');
    const [scale, setScale] = useState(1);
    const backTo = location.state?.from || '/customer/cook';

    const getRecipeImage = (url) => {
        const localFallback = '/api/category-image/vegetable/';
        if (!url || !/^https?:\/\//i.test(url)) return localFallback;
        return `/api/image-proxy/?url=${encodeURIComponent(url.trim())}`;
    };

    useEffect(() => {
        const fetchDetail = async (scaleValue) => {
            setLoading(true);
            setError('');
            try {
                const res = await recipeService.getRecipeDetail(id, scaleValue);
                setRecipe(res.data);
                if (res.data?.scale && res.data.scale !== scaleValue) {
                    setScale(Number(res.data.scale));
                }
                setImageSrc(getRecipeImage(res.data?.image_url || ''));
                const baseList = (res.data?.ingredient_status || [])
                    .filter((item) => (item?.name || '').trim())
                    .map((item) => ({
                        name: item.name,
                        grams: Number(item.needed_g || 0),
                        have_g: Number(item.have_g || 0),
                        display: item.display,
                    }));
                setCookList(baseList);
            } catch (err) {
                setError('Failed to load recipe details.');
            } finally {
                setLoading(false);
            }
        };
        const timer = setTimeout(() => {
            fetchDetail(scale);
        }, 200);
        return () => clearTimeout(timer);
    }, [id, scale]);

    const nutrition = recipe?.nutrition || {};

    const totals = useMemo(() => {
        return cookList.reduce(
            (acc, item) => {
                acc.needed += Number(item.grams || 0);
                return acc;
            },
            { needed: 0 }
        );
    }, [cookList]);

    const handleCookQuantityChange = (index, value) => {
        const next = [...cookList];
        next[index] = { ...next[index], grams: Number(value) };
        setCookList(next);
    };

    const handleCookConfirm = async () => {
        setCooking(true);
        setCookResult(null);
        try {
            const ingredients = cookList
                .filter((i) => i.grams && i.grams > 0)
                .map((i) => ({ name: i.name, grams: i.grams }));
            const res = await recipeService.cookRecipe(recipe.id, allowPartial, ingredients, scale);
            setCookResult(res.data);
            if (res.data?.status === 'success' || res.data?.status === 'partial') {
                localStorage.setItem('pantry_refresh', Date.now().toString());
                setShowCookModal(false);
            }
        } catch (err) {
            const data = err.response?.data;
            if (data?.insufficient && !data.missing) {
                data.missing = data.insufficient;
            }
            setCookResult(data || { status: 'failed', reason: 'unknown' });
        } finally {
            setCooking(false);
        }
    };

    const handleDownloadPdf = () => {
        if (!recipe) return;
        const steps = (recipe.steps || []).filter((s) => s.trim());
        const ingredients = (recipe.ingredient_status || []).filter((item) => (item?.name || '').trim());
        const doodleSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'>
  <g stroke='#f3b9b9' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round' opacity='0.7'>
    <circle cx='26' cy='30' r='6'/>
    <line x1='26' y1='36' x2='26' y2='64'/>
    <line x1='90' y1='18' x2='90' y2='64'/>
    <line x1='82' y1='18' x2='82' y2='34'/>
    <line x1='98' y1='18' x2='98' y2='34'/>
    <path d='M120 40c-10 2-16 10-12 20 8 2 18-4 20-14-2-4-4-6-8-6z'/>
    <circle cx='54' cy='108' r='7'/>
    <path d='M48 120c10 8 22 8 32 0'/>
  </g>
</svg>`;
        const doodleBg = `data:image/svg+xml;utf8,${encodeURIComponent(doodleSvg)}`;
        const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${recipe.name} - Recipe</title>
  <style>
    :root { --accent: #e11d2e; --ink: #1b1b1b; --muted: #6b6b6b; --paper: #fff7f2; --card: #ffffff; }
    * { box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: var(--ink); margin: 0; padding: 28px; background: var(--paper); background-image: url("${doodleBg}"); background-size: 160px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { background: var(--card); border-radius: 18px; padding: 24px; border: 1px solid #f0e6e0; box-shadow: 0 10px 20px rgba(0,0,0,0.08); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #f0e6e0; padding-bottom: 16px; margin-bottom: 20px; }
    .title { font-size: 28px; margin: 0; }
    .meta { color: var(--muted); margin-top: 6px; }
    .badge { display: inline-block; background: var(--accent); color: #fff; padding: 4px 10px; border-radius: 999px; font-size: 12px; margin-top: 10px; letter-spacing: 0.08em; }
    .doodle { width: 64px; height: 64px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { border: 1px solid #f0e6e0; border-radius: 14px; padding: 14px; background: #fffaf6; }
    h3 { margin: 0 0 10px; font-size: 16px; }
    ul, ol { padding-left: 18px; margin: 0; }
    li { margin-bottom: 8px; }
    .steps { margin-top: 16px; }
    .footer { margin-top: 18px; color: var(--muted); font-size: 12px; text-align: right; }
    @media print {
      body { padding: 20px; }
      .card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <h1 class="title">${recipe.name}</h1>
        <div class="meta">${recipe.cuisine || 'General'} | ${recipe.difficulty} | ${recipe.minutes} mins</div>
        <div class="badge">STASH RECIPE</div>
      </div>
      <svg class="doodle" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#e11d2e" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.8">
          <circle cx="18" cy="18" r="6"/>
          <line x1="18" y1="24" x2="18" y2="48"/>
          <line x1="40" y1="12" x2="40" y2="48"/>
          <line x1="34" y1="12" x2="34" y2="28"/>
          <line x1="46" y1="12" x2="46" y2="28"/>
          <path d="M16 52c10 6 22 6 32 0"/>
        </g>
      </svg>
    </div>
    <div class="grid">
      <div class="card">
        <h3>Ingredients</h3>
        <ul>
          ${ingredients.map(i => `<li>${i.name}: ${i.display || (i.needed_g + ' g')}</li>`).join('')}
        </ul>
      </div>
      <div class="card">
        <h3>Nutrition</h3>
        <ul>
          <li>Calories: ${Math.round(nutrition.calories || 0)} kcal</li>
          <li>Protein: ${Math.round(nutrition.protein || 0)} g</li>
          <li>Carbs: ${Math.round(nutrition.carbs || 0)} g</li>
          <li>Fat: ${Math.round(nutrition.fat || 0)} g</li>
        </ul>
      </div>
    </div>
    <div class="card steps">
      <h3>Steps</h3>
      <ol>
        ${steps.map(s => `<li>${s}</li>`).join('')}
      </ol>
    </div>
    <div class="footer">Generated from Stash &bull; Save as PDF from the print dialog</div>
  </div>
</body>
</html>`;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => {
            win.print();
        }, 500);
    };


    const handleAddMissingToCart = async () => {
        setAddingMissing(true);
        setAddMissingMsg('');
        try {
            const res = await shopService.getProducts();
            const products = res.data || [];
            const missing = recipe?.missing_ingredients || [];
            let added = 0;
            for (const item of missing) {
                const lower = String(item).toLowerCase();
                const product = products.find((p) =>
                    String(p.ingredient_name || '').toLowerCase().includes(lower) ||
                    String(p.name || '').toLowerCase().includes(lower)
                );
                if (product) {
                    await shopService.addToCart(product.id, 1);
                    added += 1;
                }
            }
            setAddMissingMsg(added > 0 ? `Added ${added} items to cart.` : 'No matching products found.');
        } catch (err) {
            setAddMissingMsg('Failed to add missing items.');
        } finally {
            setAddingMissing(false);
        }
    };

    if (loading) {
        return <div style={styles.loading}>Loading recipe...</div>;
    }

    if (error || !recipe) {
        return (
            <div style={styles.errorState}>
                <p>{error || 'Recipe not found.'}</p>
                <button style={styles.backBtn} onClick={() => navigate(backTo)}>
                    <ArrowLeft size={16} /> Back to Cook
                </button>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <button style={styles.backBtn} onClick={() => navigate(backTo)}>
                <ArrowLeft size={16} /> Back to Cook
            </button>

            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>{recipe.name}</h1>
                    <p style={styles.meta}>
                        {recipe.cuisine || 'General'} | {recipe.difficulty} | {recipe.minutes} mins
                    </p>
                    {recipe.seasonal_hint && (
                        <span style={styles.seasonalBadge}>{recipe.seasonal_hint}</span>
                    )}
                </div>
                <div style={styles.headerActions}>
                    <div style={styles.scaleControl}>
                        <span style={styles.scaleLabel}>Portion</span>
                        <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.25"
                            value={scale}
                            onChange={(e) => setScale(Number(e.target.value))}
                            style={styles.scaleRange}
                        />
                        <span style={styles.scaleValue}>{scale.toFixed(2)}x</span>
                    </div>
                    <button style={styles.secondaryBtn} onClick={handleDownloadPdf}>
                        Download PDF
                    </button>
                    <button style={styles.cookBtn} onClick={() => { setShowCookModal(true); setCookResult(null); }}>
                        <ChefHat size={18} /> Cook Recipe
                    </button>
                </div>
            </div>

            {imageSrc && (
                <div style={styles.heroImage}>
                    <img
                        src={imageSrc}
                        alt={recipe.name}
                        style={styles.heroImg}
                        onError={() => {
                            setImageSrc('/api/category-image/vegetable/');
                        }}
                    />
                </div>
            )}

            <section style={styles.section} className="fade-up">
                <h2 style={styles.sectionTitle}>Nutrition</h2>
                <div style={styles.nutritionGrid}>
                    <div style={styles.nutritionCard} className="hover-float"><Flame size={18} /> {Math.round(nutrition.calories || 0)} kcal</div>
                    <div style={styles.nutritionCard} className="hover-float"><Leaf size={18} /> {Math.round(nutrition.protein || 0)} g protein</div>
                    <div style={styles.nutritionCard} className="hover-float">Carbs {Math.round(nutrition.carbs || 0)} g</div>
                    <div style={styles.nutritionCard} className="hover-float">Fat {Math.round(nutrition.fat || 0)} g</div>
                </div>
            </section>

            <section style={styles.section} className="fade-up">
                <h2 style={styles.sectionTitle}>Ingredients</h2>
                <div style={styles.searchRow}>
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search ingredient..."
                        value={ingredientFilter}
                        onChange={(e) => setIngredientFilter(e.target.value)}
                        style={styles.searchInput}
                    />
                </div>
                <div style={styles.ingredientTable}>
                    <div style={styles.ingredientHeader}>
                        <span>Ingredient</span>
                        <span>Need</span>
                        <span>Have (g)</span>
                        <span>Status</span>
                    </div>
                    {(recipe.ingredient_status || [])
                        .filter((item) => {
                            const name = (item?.name || '').trim();
                            return name && name.toLowerCase().includes(ingredientFilter.toLowerCase());
                        })
                        .map((item, idx) => (
                            <div key={idx} style={styles.ingredientRow}>
                                <span style={styles.ingredientName}>{item.name}</span>
                                <span style={styles.ingredientValue}>{item.display || `${item.needed_g} g`}</span>
                                <span style={styles.ingredientValue}>{item.have_g}</span>
                                {item.status === 'have' && <span style={styles.haveBadge}>Available</span>}
                                {item.status === 'partial' && <span style={styles.partialBadge}>Low stock</span>}
                                {item.status === 'missing' && <span style={styles.missingBadge}>Missing</span>}
                            </div>
                        ))}
                </div>
            </section>

            {recipe.insufficient_ingredients?.length > 0 && (
                <section style={styles.section} className="fade-up">
                    <h2 style={styles.sectionTitle}>Low Stock Ingredients</h2>
                    <div style={styles.availableList}>
                        {recipe.insufficient_ingredients.map((item, idx) => (
                            <span key={idx} style={styles.partialTag}>{item}</span>
                        ))}
                    </div>
                </section>
            )}

            {recipe.missing_ingredients?.length > 0 && (
                <section style={styles.section} className="fade-up">
                    <h2 style={styles.sectionTitle}><AlertTriangle size={18} /> Missing Ingredients</h2>
                    <div style={styles.missingList}>
                        {(recipe.missing_ingredients || []).filter(Boolean).map((item, idx) => (
                            <span key={idx} style={styles.missingTag}>{item}</span>
                        ))}
                    </div>
                    {recipe.substitution_suggestions?.length > 0 && (
                        <div style={styles.substitutionPanel}>
                            <div style={styles.substitutionTitle}>Substitution suggestions</div>
                            {recipe.substitution_suggestions.map((suggestion, idx) => (
                                <div key={`${suggestion.ingredient}-${idx}`} style={styles.substitutionRow}>
                                    <div style={styles.substitutionIngredient}>{suggestion.ingredient}</div>
                                    <div style={styles.substitutionOptions}>
                                        {suggestion.options.map((opt, optIdx) => (
                                            <span
                                                key={`${suggestion.ingredient}-${optIdx}`}
                                                style={opt.pantry_has ? styles.subOptionActive : styles.subOption}
                                            >
                                                {opt.name}{opt.note ? ` (${opt.note})` : ''}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <button style={styles.missingBtn} onClick={handleAddMissingToCart} disabled={addingMissing}>
                        {addingMissing ? 'Adding...' : 'Add Missing to Cart'}
                    </button>
                    {addMissingMsg && <div style={styles.missingMsg}>{addMissingMsg}</div>}
                </section>
            )}

            {recipe.available_ingredients?.length > 0 && (
                <section style={styles.section} className="fade-up">
                    <h2 style={styles.sectionTitle}>Ingredients You Have</h2>
                    <div style={styles.availableList}>
                        {(recipe.available_ingredients || []).filter(Boolean).map((item, idx) => (
                            <span key={idx} style={styles.haveTag}>{item}</span>
                        ))}
                    </div>
                </section>
            )}

            <section style={styles.section} className="fade-up">
                <h2 style={styles.sectionTitle}>Steps</h2>
                <ol style={styles.stepList}>
                    {(recipe.steps || []).filter((s) => s.trim()).slice(0, 12).map((step, idx) => (
                        <li key={idx} style={styles.stepItem}>{step}</li>
                    ))}
                </ol>
            </section>

            {cookResult && (
                <div style={styles.cookResult}>
                    <div style={styles.cookResultTitle}>
                        {cookResult.status === 'success' && 'Cooked successfully'}
                        {cookResult.status === 'partial' && 'Cooked partially'}
                        {(!cookResult.status || cookResult.status === 'failed') && 'Could not cook'}
                    </div>
                    {cookResult.missing?.length > 0 && (
                        <div style={styles.cookLine}>
                            Missing: {cookResult.missing.map((m) => m.ingredient || m).join(', ')}
                        </div>
                    )}
                    {cookResult.deducted?.length > 0 && (
                        <div style={styles.cookLine}>
                            Deducted: {cookResult.deducted.map((d) => `${d.ingredient} (${d.used_g} g)`).join(', ')}
                        </div>
                    )}
                    {cookResult.nutrition_scoring && (
                        <div style={styles.cookLine}>
                            Score: {cookResult.nutrition_scoring.daily_score} today · Weekly avg {Math.round(cookResult.nutrition_scoring.weekly_score || 0)} · L{cookResult.nutrition_scoring.level} ({cookResult.nutrition_scoring.points} pts)
                        </div>
                    )}
                </div>
            )}

            {showCookModal && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <h3>Confirm Pantry Deduction</h3>
                            <button style={styles.closeBtn} onClick={() => setShowCookModal(false)}>X</button>
                        </div>
                        <p style={styles.modalHint}>
                            Adjust quantities before cooking. This will deduct from your pantry.
                        </p>
                        <div style={styles.modalList}>
                            {cookList.map((item, idx) => (
                                <div key={idx} style={styles.modalRow}>
                                    <div>
                                        <div style={styles.modalName}>{item.name}</div>
                                        <div style={styles.modalMeta}>Need {item.display || `${item.grams} g`} | Have {item.have_g} g</div>
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={item.grams}
                                        onChange={(e) => handleCookQuantityChange(idx, e.target.value)}
                                        style={styles.modalInput}
                                    />
                                </div>
                            ))}
                        </div>
                        {cookResult && cookResult.status === 'failed' && (
                            <div style={styles.modalError}>
                                {cookResult.missing?.length > 0
                                    ? `Missing: ${cookResult.missing.map((m) => m.ingredient || m).join(', ')}`
                                    : 'Unable to cook with current quantities.'}
                            </div>
                        )}
                        <label style={styles.allowPartial}>
                            <input
                                type="checkbox"
                                checked={allowPartial}
                                onChange={(e) => setAllowPartial(e.target.checked)}
                            />
                            Allow partial cook if ingredients are missing
                        </label>
                        <div style={styles.modalFooter}>
                            <div style={styles.modalTotal}>Total to deduct: {Math.round(totals.needed)} g</div>
                            <button style={styles.confirmBtn} onClick={handleCookConfirm} disabled={cooking}>
                                <Save size={16} /> {cooking ? 'Cooking...' : 'Confirm Cook'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    page: { maxWidth: '1100px', margin: '0 auto', padding: '2rem' },
    loading: { padding: '4rem', textAlign: 'center', color: 'var(--color-text-light)' },
    errorState: { padding: '3rem', textAlign: 'center', color: 'var(--color-text-light)' },
    backBtn: { background: 'none', border: 'none', color: 'var(--color-text-light)', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', cursor: 'pointer' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' },
    headerActions: { display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' },
    title: { fontSize: '2.2rem', color: 'var(--color-text)' },
    meta: { color: 'var(--color-text-light)' },
    seasonalBadge: { display: 'inline-block', marginTop: '0.4rem', background: 'rgba(16,185,129,0.15)', color: '#0f766e', padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '700' },
    cookBtn: { background: 'var(--color-primary)', color: '#ffffff', border: 'none', padding: '10px 16px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: '700', cursor: 'pointer' },
    secondaryBtn: { background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: '10px 16px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' },
    scaleControl: { display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '8px 12px', borderRadius: '999px' },
    scaleLabel: { fontSize: '0.85rem', color: 'var(--color-text-light)' },
    scaleRange: { accentColor: 'var(--color-primary)', width: '140px' },
    scaleValue: { fontWeight: '700', color: 'var(--color-text)' },
    heroImage: { height: '260px', borderRadius: '20px', marginBottom: '2rem', border: '1px solid var(--color-border)', overflow: 'hidden', background: 'var(--color-surface-2)' },
    heroImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    section: { marginBottom: '2rem' },
    sectionTitle: { fontSize: '1.4rem', marginBottom: '0.8rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' },
    nutritionGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' },
    nutritionCard: { background: 'var(--color-surface)', borderRadius: '12px', padding: '12px', border: '1px solid var(--color-border)', display: 'flex', gap: '8px', alignItems: 'center' },
    searchRow: { display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '8px 14px', marginBottom: '1rem' },
    searchInput: { border: 'none', outline: 'none', background: 'transparent', color: 'var(--color-text)', flex: 1 },
    ingredientTable: { display: 'grid', gap: '0.6rem' },
    ingredientHeader: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', color: 'var(--color-text-light)', fontSize: '0.85rem', padding: '0 6px' },
    ingredientRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface)', borderRadius: '12px', padding: '10px', border: '1px solid var(--color-border)' },
    ingredientName: { fontWeight: '700', color: 'var(--color-text)' },
    ingredientValue: { color: 'var(--color-text-light)', fontSize: '0.9rem' },
    haveBadge: { background: 'rgba(17,17,17,0.08)', color: 'var(--color-text)', padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '700' },
    partialBadge: { background: 'rgba(245,158,11,0.18)', color: '#b45309', padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '700' },
    missingBadge: { background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '700' },
    missingList: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.8rem' },
    availableList: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
    missingTag: { background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '6px 10px', borderRadius: '999px', fontSize: '0.85rem' },
    haveTag: { background: 'rgba(17,17,17,0.08)', color: 'var(--color-text)', padding: '6px 10px', borderRadius: '999px', fontSize: '0.85rem' },
    partialTag: { background: 'rgba(245,158,11,0.16)', color: '#b45309', padding: '6px 10px', borderRadius: '999px', fontSize: '0.85rem' },
    missingBtn: { marginTop: '1rem', background: 'var(--color-primary)', color: '#ffffff', border: 'none', padding: '10px 14px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' },
    missingMsg: { marginTop: '0.6rem', color: 'var(--color-text-light)' },
    substitutionPanel: { background: 'var(--color-surface-2)', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '1rem', marginBottom: '1rem' },
    substitutionTitle: { fontWeight: '700', marginBottom: '0.6rem', color: 'var(--color-text)' },
    substitutionRow: { display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.8rem', alignItems: 'start', padding: '8px 0', borderTop: '1px dashed var(--color-border)' },
    substitutionIngredient: { fontWeight: '700', color: 'var(--color-text)' },
    substitutionOptions: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
    subOption: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '6px 10px', fontSize: '0.8rem', color: 'var(--color-text-light)' },
    subOptionActive: { background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#15803d', borderRadius: '999px', padding: '6px 10px', fontSize: '0.8rem' },
    stepList: { paddingLeft: '1.2rem', color: 'var(--color-text)' },
    stepItem: { marginBottom: '0.6rem' },
    cookResult: { marginTop: '1.5rem', background: 'var(--color-surface)', borderRadius: '12px', padding: '12px', border: '1px solid var(--color-border)' },
    cookResultTitle: { fontWeight: '700', marginBottom: '0.4rem' },
    cookLine: { color: 'var(--color-text-light)', fontSize: '0.95rem' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
    modal: { background: 'var(--color-surface)', borderRadius: '16px', padding: '1.5rem', width: '90%', maxWidth: '520px', border: '1px solid var(--color-border)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' },
    closeBtn: { background: 'none', border: 'none', color: 'var(--color-text-light)', cursor: 'pointer', fontSize: '1.1rem' },
    modalHint: { color: 'var(--color-text-light)', marginBottom: '1rem' },
    modalList: { display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '300px', overflowY: 'auto' },
    modalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: 'var(--color-surface-2)', padding: '10px', borderRadius: '12px' },
    modalName: { fontWeight: '700' },
    modalMeta: { fontSize: '0.85rem', color: 'var(--color-text-light)' },
    modalInput: { width: '90px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)' },
    modalFooter: { marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' },
    modalTotal: { color: 'var(--color-text-light)' },
    confirmBtn: { background: 'var(--color-primary)', color: '#ffffff', border: 'none', padding: '10px 16px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' },
    allowPartial: { marginTop: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-light)' },
    modalError: { marginTop: '0.8rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' },
};

export default RecipeDetail;
