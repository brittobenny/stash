import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Archive, Search, Plus, X, Sparkles, Minus, Save } from 'lucide-react';
import { pantryService } from '../services/api';
import '../styles/global.css';

const doodleBackground = '/api/doodle/';

const Pantry = () => {
    const navigate = useNavigate();
    const [pantry, setPantry] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [expandedCategories, setExpandedCategories] = useState({});

    // Add Item Modal State
    const [showModal, setShowModal] = useState(false);
    const [ingredients, setIngredients] = useState([]);
    const [ingredientSearch, setIngredientSearch] = useState('');
    const [selectedIngredient, setSelectedIngredient] = useState(null);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [newItem, setNewItem] = useState({ ingredient: '', quantity: '', expiry_date: '' });
    const [adding, setAdding] = useState(false);
    const [editQuantities, setEditQuantities] = useState({});
    const [savingItem, setSavingItem] = useState(null);

    useEffect(() => {
        fetchPantry();
        fetchIngredients();
    }, []);

    useEffect(() => {
        const prevBg = document.body.style.backgroundImage;
        const prevSize = document.body.style.backgroundSize;
        const prevRepeat = document.body.style.backgroundRepeat;
        const prevColor = document.body.style.backgroundColor;
        const prevAttachment = document.body.style.backgroundAttachment;
        const prevPosition = document.body.style.backgroundPosition;
        document.body.style.backgroundImage = `linear-gradient(rgba(245,246,251,0.6), rgba(245,246,251,0.6)), url(${doodleBackground})`;
        document.body.style.backgroundSize = 'auto, 500px';
        document.body.style.backgroundRepeat = 'repeat, repeat';
        document.body.style.backgroundAttachment = 'fixed, fixed';
        document.body.style.backgroundPosition = 'center, center';
        document.body.style.backgroundColor = '#f5f6fb';
        return () => {
            document.body.style.backgroundImage = prevBg;
            document.body.style.backgroundSize = prevSize;
            document.body.style.backgroundRepeat = prevRepeat;
            document.body.style.backgroundColor = prevColor;
            document.body.style.backgroundAttachment = prevAttachment;
            document.body.style.backgroundPosition = prevPosition;
        };
    }, []);

    useEffect(() => {
        const handleFocus = () => {
            const refreshFlag = sessionStorage.getItem('pantry_refresh');
            if (refreshFlag) {
                fetchPantry();
            }
        };
        const handleRefreshEvent = () => fetchPantry();
        const handleStorage = (e) => {
            if (e.key === 'pantry_refresh') {
                fetchPantry();
            }
        };
        window.addEventListener('focus', handleFocus);
        window.addEventListener('pantry_refresh', handleRefreshEvent);
        window.addEventListener('storage', handleStorage);
        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('pantry_refresh', handleRefreshEvent);
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    const fetchPantry = async () => {
        setLoading(true);
        try {
            const res = await pantryService.getItems();
            if (res.data) setPantry(res.data);
        } catch (err) {
            console.error('Failed to fetch pantry', err);
        } finally {
            setLoading(false);
            sessionStorage.removeItem('pantry_refresh');
        }
    };

    const fetchIngredients = async () => {
        try {
            const res = await pantryService.listIngredients();
            if (res.data) setIngredients(res.data);
        } catch (err) {
            console.error('Failed to fetch ingredients', err);
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        let ingredientId = newItem.ingredient;
        if (!ingredientId && ingredientSearch) {
            const match = ingredients.find((ing) =>
                ing.name.toLowerCase() === ingredientSearch.trim().toLowerCase()
            );
            if (match) {
                ingredientId = match.id;
                setSelectedIngredient(match);
            }
        }
        if (!ingredientId) {
            alert('Please select an ingredient from the suggestions.');
            return;
        }
        setAdding(true);
        try {
            await pantryService.addItem({
                ...newItem,
                ingredient: ingredientId,
                quantity: newItem.quantity || 0,
                expiry_date: newItem.expiry_date || null,
            });
            setShowModal(false);
            setNewItem({ ingredient: '', quantity: '', expiry_date: '' });
            setIngredientSearch('');
            setSelectedIngredient(null);
            setShowSuggestions(true);
            fetchPantry();
            alert('Item added successfully!');
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to add item';
            alert(msg);
        } finally {
            setAdding(false);
        }
    };

    const getDefaultQuantity = (unit) => {
        const u = (unit || '').toLowerCase();
        if (u.includes('g') || u.includes('gram')) return 100;
        if (u.includes('ml')) return 100;
        if (u.includes('pcs') || u.includes('piece')) return 1;
        return 1;
    };

    const filteredSuggestions = ingredients.filter((ing) =>
        ing.name.toLowerCase().includes(ingredientSearch.toLowerCase())
    );

    const handleIngredientPick = (ing) => {
        setSelectedIngredient(ing);
        setIngredientSearch(ing.name);
        setShowSuggestions(false);
        setNewItem((prev) => ({
            ...prev,
            ingredient: ing.id,
            quantity: getDefaultQuantity(ing.default_unit),
        }));
    };

    const normalizeCategory = (item) => {
        const raw = (item.category || '').toLowerCase();
        const name = (item.ingredient_name || item.name || '').toLowerCase();
        if (name.includes('egg')) return 'Dairy';
        if (
            name.includes('wheat') ||
            name.includes('rice') ||
            name.includes('oat') ||
            name.includes('barley') ||
            name.includes('millet') ||
            name.includes('quinoa') ||
            name.includes('corn') ||
            name.includes('maize') ||
            name.includes('flour') ||
            name.includes('pasta') ||
            name.includes('noodle')
        ) {
            return 'Grain';
        }
        if (['grains', 'grain'].includes(raw)) return 'Grain';
        if (['dairy'].includes(raw) || name.includes('milk') || name.includes('cheese')) return 'Dairy';
        if (['meat', 'seafood'].includes(raw)) return 'Meat';
        if (['greens', 'vegetables', 'vegetable', 'mushrooms'].includes(raw)) return 'Vegetable';
        if (['fruits', 'fruit'].includes(raw)) return 'Fruit';
        if (['spices', 'spice'].includes(raw)) return 'Spice';
        if (['oils and sauces', 'oil'].includes(raw)) return 'Oil';
        const fallback = String(item.category || '').trim();
        return fallback || 'Other';
    };

    const normalizeCategoryKey = (value) => String(value || '').toLowerCase().trim();
    const filteredItems = pantry.filter(item => {
        const matchesText = (item.ingredient_name || item.name || '').toLowerCase().includes(filter.toLowerCase());
        if (!matchesText) return false;
        if (!selectedCategory || selectedCategory === 'All') return true;
        return normalizeCategoryKey(normalizeCategory(item)) === normalizeCategoryKey(selectedCategory);
    });

    const groupedByCategory = filteredItems.reduce((acc, item) => {
        const key = normalizeCategory(item);
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    const allGroupedByCategory = pantry.reduce((acc, item) => {
        const key = normalizeCategory(item);
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    const preferredCategories = [
        'Vegetable',
        'Fruit',
        'Grain',
        'Dairy',
        'Meat',
        'Spice',
        'Oil',
        'Other'
    ];
    const dynamicCategories = Object.keys(allGroupedByCategory).filter(
        (c) => !preferredCategories.includes(c)
    );
    const orderedCategories = [
        ...preferredCategories.filter((c) => allGroupedByCategory[c]?.length),
        ...dynamicCategories.sort(),
    ];

    const handleAdjust = (item, delta) => {
        const current = editQuantities[item.id] ?? item.quantity ?? 0;
        const next = Math.max(0, Number(current) + delta);
        setEditQuantities((prev) => {
            const updated = { ...prev };
            if (Number(next) === Number(item.quantity ?? 0)) {
                delete updated[item.id];
            } else {
                updated[item.id] = next;
            }
            return updated;
        });
    };

    const handleSaveQuantity = async (item) => {
        const qty = editQuantities[item.id] ?? item.quantity;
        if (!qty || qty <= 0) {
            alert('Quantity must be greater than 0');
            return;
        }
        setSavingItem(item.id);
        try {
            await pantryService.updateItem(item.id, { quantity: qty, expiry_date: item.expiry_date });
            await fetchPantry();
            setEditQuantities((prev) => {
                const updated = { ...prev };
                delete updated[item.id];
                return updated;
            });
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to update item';
            alert(msg);
        } finally {
            setSavingItem(null);
        }
    };

    const emojiSvg = (emoji) =>
        `data:image/svg+xml;utf8,${encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='120' height='120' rx='60' ry='60' fill='#f7f7f7'/><text x='60' y='74' font-family='Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif' font-size='44' text-anchor='middle'>${emoji}</text></svg>`
        )}`;

    const placeholderSvg = (letter) =>
        `data:image/svg+xml;utf8,${encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='120' height='120' rx='60' ry='60' fill='#f1f1f1'/><text x='60' y='70' font-family='Arial' font-size='36' text-anchor='middle' fill='#999'>${letter}</text></svg>`
        )}`;

    const pickEmojiForItem = (item) => {
        const name = (item.ingredient_name || item.name || '').toLowerCase();
        const category = normalizeCategory(item).toLowerCase();
        const map = {
            onion: '🧅',
            tomato: '🍅',
            potato: '🥔',
            carrot: '🥕',
            garlic: '🧄',
            ginger: '🫚',
            pepper: '🫑',
            chili: '🌶️',
            cauliflower: '🥦',
            broccoli: '🥦',
            spinach: '🥬',
            lettuce: '🥬',
            cabbage: '🥬',
            cucumber: '🥒',
            corn: '🌽',
            rice: '🍚',
            wheat: '🌾',
            oats: '🌾',
            flour: '🌾',
            pasta: '🍝',
            noodle: '🍜',
            milk: '🥛',
            cheese: '🧀',
            butter: '🧈',
            yogurt: '🥛',
            egg: '🥚',
            chicken: '🍗',
            beef: '🥩',
            pork: '🍖',
            fish: '🐟',
            shrimp: '🦐',
            prawn: '🦐',
            salt: '🧂',
            sugar: '🧂',
            oil: '🫒',
            olive: '🫒',
            lemon: '🍋',
            lime: '🍋',
            apple: '🍎',
            banana: '🍌',
            orange: '🍊',
            grape: '🍇',
            strawberry: '🍓',
        };
        const key = Object.keys(map).find((k) => name.includes(k));
        if (key) return map[key];
        if (category.includes('vegetable')) return '🥦';
        if (category.includes('fruit')) return '🍎';
        if (category.includes('grain')) return '🌾';
        if (category.includes('dairy')) return '🧀';
        if (category.includes('meat')) return '🍖';
        if (category.includes('spice')) return '🌶️';
        if (category.includes('oil')) return '🫒';
        return '';
    };

    const getItemImage = (item) => {
        const raw = item.image_url ? String(item.image_url).trim() : '';
        const lower = raw.toLowerCase();
        const isValidRaw =
            raw &&
            !['null', 'none', 'nan', 'undefined'].includes(lower) &&
            (raw.startsWith('/media/') || raw.startsWith('/api/'));

        if (isValidRaw) return raw;

        const emoji = pickEmojiForItem(item);
        if (emoji) return emojiSvg(emoji);

        const name = item.ingredient_name || item.name || 'ingredient';
        const initial = (name[0] || 'S').toUpperCase();
        return placeholderSvg(initial);
    };

    const getCategoryImage = (category) => {
        const key = String(category || '').toLowerCase();
        const map = {
            vegetable: '/api/category-image/vegetable/',
            vegetables: '/api/category-image/vegetable/',
            grain: '/api/category-image/grain/',
            grains: '/api/category-image/grain/',
            dairy: '/api/category-image/dairy/',
            diary: '/api/category-image/dairy/',
            meat: '/api/category-image/meat/',
            spice: '/api/category-image/spice/',
            spices: '/api/category-image/spice/',
        };
        return map[key] || '/api/category-image/vegetable/';
    };

    const categorySummary = orderedCategories.map((category) => {
        const items = allGroupedByCategory[category] || [];
        const totalCount = items.length;
        return { category, totalCount };
    });

    return (
        <div style={styles.page}>
            <div style={styles.pageLayout}>
                <aside style={styles.sidebar}>
                    <div style={styles.sidebarCard}>
                        <div style={styles.sidebarTitle}>Pantry Overview</div>
                        <div style={styles.sidebarSubtitle}>Categories & counts</div>
                        <div style={styles.sidebarList}>
                            {categorySummary.map((item) => (
                                <div key={item.category} style={styles.sidebarItem}>
                                    <span style={styles.sidebarLabel}>{item.category}</span>
                                    <span style={styles.sidebarValue}>{item.totalCount}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                <section style={styles.main}>
                    <div style={styles.header}>
                        <div>
                            <h1 style={styles.title}>Inventory</h1>
                            <p style={styles.subtitle}>Manage your ingredients and track stock levels.</p>
                        </div>
                        <div style={styles.actions}>
                            <div style={styles.searchBox}>
                                <Search size={18} color="#888" />
                                <input
                                    type="text"
                                    placeholder="Search pantry..."
                                    style={styles.searchInput}
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                />
                            </div>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                style={styles.filterSelect}
                            >
                                <option value="All">All Categories</option>
                                {orderedCategories.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <button style={styles.secondaryBtn} onClick={() => navigate('/customer/cook')}>
                                <Sparkles size={18} /> Cook with AI
                            </button>
                            <button style={styles.primaryBtn} onClick={() => { setShowModal(true); setShowSuggestions(true); }}>
                                <Plus size={18} /> Add Item
                            </button>
                            <button style={styles.refreshBtn} onClick={fetchPantry} disabled={loading}>
                                <RefreshCw size={18} className={loading ? 'spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '4rem', color: '#888' }}>Updating pantry...</div>
                    ) : filteredItems.length === 0 ? (
                        <div style={styles.emptyState}>
                            <div style={styles.emptyIcon}><Archive size={48} color="#ccc" /></div>
                            <h3>Whoops, it's empty!</h3>
                            <p>Your pantry looks a bit bare. Head to the Shop to stock up or add items manually.</p>
                            {filter && <p style={{ fontSize: '0.9rem', color: 'orange' }}>No results for "{filter}"</p>}
                        </div>
                    ) : (
                        <div style={styles.categoryGrid}>
                            {orderedCategories.map((category) => {
                                const items = groupedByCategory[category] || [];
                                if (items.length === 0) return null;
                                const isExpanded = !!expandedCategories[category];
                                const visibleItems = isExpanded ? items : items.slice(0, 12);
                                const useGrid = items.length > 4;
                                const listStyle = useGrid ? styles.categoryListGrid : styles.categoryList;
                                const itemStyle = useGrid ? styles.categoryItemGrid : styles.categoryItem;
                                const rowStyle = useGrid ? styles.categoryRowGrid : styles.categoryRow;
                                const qtyStyle = useGrid ? styles.categoryQtyGrid : styles.categoryQty;
                                const nameStyle = useGrid ? styles.categoryNameGrid : styles.categoryName;
                                const metaStyle = useGrid ? styles.categoryMetaGrid : styles.categoryMeta;
                                const columnStyle = useGrid ? { ...styles.categoryColumn, ...styles.categoryColumnWide } : styles.categoryColumn;
                                return (
                                <div key={category} style={columnStyle}>
                                    <div style={styles.categoryImageWrap}>
                                          <img
                                              src={getCategoryImage(category)}
                                              alt={`${category} category`}
                                              style={styles.categoryImage}
                                              loading="lazy"
                                              onError={(e) => {
                                                  e.currentTarget.src = '/api/category-image/vegetable/';
                                              }}
                                          />
                                        <div style={styles.categoryOverlay}>
                                            <span style={styles.categoryOverlayText}>{category.toUpperCase()}</span>
                                        </div>
                                    </div>
                                    <div style={listStyle}>
                                        {visibleItems.map((item, index) => (
                                            <div
                                                key={item.id || index}
                                                style={{ ...itemStyle, animationDelay: `${index * 0.03}s` }}
                                                className="fade-up"
                                            >
                                                <div style={styles.categoryIcon}>
                                                    <img
                                                        src={getItemImage(item)}
                                                        alt={item.ingredient_name || item.name}
                                                        style={styles.itemImg}
                                                        loading="lazy"
                                                        onError={(e) => {
                                                            const name = item.ingredient_name || item.name || 'ingredient';
                                                            const initial = (name[0] || 'S').toUpperCase();
                                                            e.currentTarget.src = placeholderSvg(initial);
                                                        }}
                                                    />
                                                </div>
                                                <div style={styles.categoryInfo}>
                                                    <div style={rowStyle}>
                                                        <h4 style={nameStyle}>{item.ingredient_name || item.name || 'Unknown Item'}</h4>
                                                        <span style={qtyStyle}>
                                                            {editQuantities[item.id] ?? item.quantity} {item.unit || 'units'}
                                                        </span>
                                                    </div>
                                                    <div style={metaStyle}>
                                                        {item.expiry_date ? `Expires ${item.expiry_date}` : 'No expiry date'}
                                                    </div>
                                                    <div style={styles.editRow}>
                                                        <button style={styles.editBtn} onClick={() => handleAdjust(item, -1)}>
                                                            <Minus size={14} />
                                                        </button>
                                                        <button style={styles.editBtn} onClick={() => handleAdjust(item, 1)}>
                                                            <Plus size={14} />
                                                        </button>
                                                        {editQuantities[item.id] !== undefined && Number(editQuantities[item.id]) !== Number(item.quantity ?? 0) && (
                                                            <button
                                                                style={{ ...styles.saveBtn, opacity: savingItem === item.id ? 0.7 : 1 }}
                                                                onClick={() => handleSaveQuantity(item)}
                                                                disabled={savingItem === item.id}
                                                                title="Save changes"
                                                            >
                                                                <Save size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                        </div>
                                    ))}
                                    </div>
                                    {items.length > 12 && (
                                        <button
                                            type="button"
                                            style={styles.expandBtn}
                                            onClick={() =>
                                                setExpandedCategories((prev) => ({
                                                    ...prev,
                                                    [category]: !prev[category],
                                                }))
                                            }
                                        >
                                            {isExpanded ? 'Show Less' : 'Show More'}
                                        </button>
                                    )}
                                </div>
                            );
                            })}
                        </div>
                    )}
                </section>
            </div>

            {showModal && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <h2>Add to Pantry</h2>
                            <button onClick={() => { setShowModal(false); setIngredientSearch(''); setSelectedIngredient(null); setShowSuggestions(true); }} style={styles.closeBtn}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddItem} style={styles.form}>
                            <div style={styles.formGroup}>
                                <label>Ingredient</label>
                                <div style={styles.modalSearchRow}>
                                    <Search size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search ingredient..."
                                        style={styles.modalSearchInput}
                                        value={ingredientSearch}
                                        onChange={(e) => { setIngredientSearch(e.target.value); setShowSuggestions(true); }}
                                        onFocus={() => setShowSuggestions(true)}
                                    />
                                </div>
                                {showSuggestions && (
                                    <div style={styles.suggestionList}>
                                        {(ingredientSearch ? filteredSuggestions : ingredients)
                                            .slice(0, 8)
                                            .map((ing) => (
                                                <button
                                                    type="button"
                                                    key={ing.id}
                                                    style={styles.suggestionItem}
                                                    onClick={() => handleIngredientPick(ing)}
                                                >
                                                    <span>{ing.name}</span>
                                                    <span style={styles.suggestionUnit}>{ing.default_unit}</span>
                                                </button>
                                            ))}
                                        {ingredientSearch && filteredSuggestions.length === 0 && (
                                            <div style={styles.suggestionEmpty}>No matching ingredient</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div style={styles.formGroup}>
                                <label>Quantity {selectedIngredient?.default_unit ? `(${selectedIngredient.default_unit})` : ''}</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    style={styles.input}
                                    value={newItem.quantity}
                                    onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                                    required
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label>Expiry Date</label>
                                <input
                                    type="date"
                                    style={styles.input}
                                    value={newItem.expiry_date}
                                    onChange={(e) => setNewItem({ ...newItem, expiry_date: e.target.value })}
                                />
                            </div>
                            <button type="submit" style={styles.submitBtn} disabled={adding}>
                                {adding ? 'Adding...' : 'Add Item'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    page: { width: '100%', margin: 0, padding: '1.6rem 2.4rem 2.4rem', background: 'rgba(255,255,255,0.6)', borderRadius: '0', minHeight: 'calc(100vh - 80px)', boxShadow: 'none' },
    pageLayout: { display: 'grid', gridTemplateColumns: '260px 1fr', gap: '2rem', alignItems: 'start' },
    sidebar: { position: 'sticky', top: '120px', height: 'fit-content' },
    sidebarCard: { background: 'var(--color-surface)', borderRadius: '20px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', padding: '1.2rem 1.4rem' },
    sidebarTitle: { fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.2rem' },
    sidebarSubtitle: { color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: '1rem' },
    sidebarList: { display: 'flex', flexDirection: 'column', gap: '0.7rem' },
    sidebarItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.7rem', borderRadius: '12px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' },
    sidebarLabel: { fontWeight: '600', fontSize: '0.9rem' },
    sidebarValue: { fontWeight: '700', color: 'var(--color-primary)' },
    main: { minWidth: 0 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', flexWrap: 'wrap', gap: '1rem' },
    title: { fontSize: '2.5rem', fontWeight: '800', color: 'var(--color-text)', letterSpacing: '-0.02em', marginBottom: '0.5rem' },
    subtitle: { color: 'var(--color-text-light)', fontSize: '1.1rem' },
    actions: { display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' },
    searchBox: { display: 'flex', alignItems: 'center', background: 'var(--color-surface)', padding: '8px 16px', borderRadius: '50px', border: '1px solid var(--color-border)', width: '250px', boxShadow: 'var(--shadow-sm)' },
    searchInput: { border: 'none', outline: 'none', marginLeft: '8px', width: '100%', fontSize: '0.95rem', background: 'transparent', color: 'var(--color-text)' },
    filterSelect: {
        background: 'var(--color-surface)',
        border: '1px solid rgba(225,29,46,0.2)',
        borderRadius: '999px',
        padding: '10px 36px 10px 16px',
        fontSize: '0.92rem',
        fontWeight: '600',
        color: 'var(--color-text)',
        boxShadow: 'var(--shadow-sm)',
        appearance: 'none',
        outline: 'none',
        cursor: 'pointer',
        minWidth: '170px',
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%23111' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 14px center'
    },
    refreshBtn: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-primary)', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s' },
    primaryBtn: { background: 'var(--color-primary)', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', boxShadow: 'var(--shadow-md)' },
    secondaryBtn: { background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: '10px 16px', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', boxShadow: 'var(--shadow-sm)' },

    emptyState: { textAlign: 'center', padding: '6rem 2rem', color: 'var(--color-text-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', background: 'var(--color-surface)', borderRadius: '24px', border: '2px dashed var(--color-border)' },
    emptyIcon: { background: 'var(--color-surface-2)', padding: '2rem', borderRadius: '50%', marginBottom: '1rem' },

    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modal: { background: 'var(--color-surface)', padding: '2rem', borderRadius: '16px', width: '90%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border)', backdropFilter: 'blur(12px)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)' },
    form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
    modalSearchRow: { display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px 10px' },
    modalSearchInput: { border: 'none', outline: 'none', background: 'transparent', color: 'var(--color-text)', width: '100%' },
    suggestionList: { marginTop: '0.6rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '10px', maxHeight: '180px', overflowY: 'auto' },
    suggestionItem: { width: '100%', textAlign: 'left', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', color: 'var(--color-text)', border: 'none', cursor: 'pointer' },
    suggestionUnit: { color: 'var(--color-text-light)', fontSize: '0.85rem' },
    suggestionEmpty: { padding: '10px 12px', color: 'var(--color-text-light)' },
    input: { padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '1rem', background: 'var(--color-surface-2)', color: 'var(--color-text)' },
    submitBtn: { padding: '12px', background: 'var(--color-primary)', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', marginTop: '1rem' },

    categoryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(280px, 1fr))', gap: '1.8rem', gridAutoFlow: 'row dense' },
    categoryColumn: { background: 'var(--color-surface)', borderRadius: '26px', border: '1px solid rgba(225,29,46,0.3)', padding: '1.2rem 1.6rem 1.6rem', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' },
    categoryColumnWide: { gridColumn: 'span 2' },
    categoryImageWrap: { width: 'calc(100% + 3.2rem)', height: '130px', margin: '-1.2rem -1.6rem 1.2rem -1.6rem', borderRadius: '26px 26px 0 0', overflow: 'hidden', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)', position: 'relative' },
    categoryImage: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    categoryOverlay: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' },
    categoryOverlayText: { color: '#fff', fontWeight: '800', letterSpacing: '0.14em', fontSize: '0.95rem' },
    categoryList: { display: 'flex', flexDirection: 'column', gap: '1.4rem' },
    categoryListGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem', alignItems: 'start' },
    categoryItem: { display: 'grid', gridTemplateColumns: '72px 1fr', gap: '1rem', alignItems: 'center', paddingBottom: '1.2rem', borderBottom: '1px dashed var(--color-border)' },
    categoryItemGrid: { display: 'grid', gridTemplateColumns: '52px 1fr', gap: '0.75rem', alignItems: 'start', padding: '0.8rem', border: '1px dashed var(--color-border)', borderRadius: '14px', background: 'rgba(255,255,255,0.9)', minWidth: 0 },
    categoryIcon: { width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-border)', overflow: 'hidden' },
    itemImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    categoryInfo: { display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 0 },
    categoryRow: { display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '0.8rem' },
    categoryRowGrid: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' },
    categoryName: { margin: 0, fontSize: '1.05rem', fontWeight: '600' },
    categoryNameGrid: { margin: 0, fontSize: '0.95rem', fontWeight: '600', lineHeight: '1.2', wordBreak: 'break-word' },
    categoryQty: { color: 'var(--color-primary)', fontWeight: '700', fontSize: '0.95rem' },
    categoryQtyGrid: { color: 'var(--color-primary)', fontWeight: '700', fontSize: '0.85rem' },
    categoryMeta: { color: 'var(--color-text-light)', fontSize: '0.85rem' },
    categoryMetaGrid: { color: 'var(--color-text-light)', fontSize: '0.78rem' },
    editRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' },
    editBtn: { width: '30px', height: '30px', borderRadius: '8px', border: '1px solid var(--color-border)', background: '#fff', color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
    saveBtn: { background: 'var(--color-primary)', color: '#fff', border: 'none', width: '34px', height: '30px', borderRadius: '999px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
    expandBtn: { marginTop: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', padding: '8px 16px', borderRadius: '999px', fontWeight: '600', cursor: 'pointer' },
};

export default Pantry;
