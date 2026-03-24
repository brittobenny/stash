import React, { useState, useEffect } from 'react';
import { Heart, ShoppingCart, ChefHat, Package, Plus, Minus, Check, Loader } from 'lucide-react';
import { pantryService, shopService } from '../services/api';
import { formatCurrency } from '../utils/currency';
import '../styles/global.css';

const CustomerDashboard = () => {
    const [activeTab, setActiveTab] = useState('recommendations');
    const [pantry, setPantry] = useState([]);
    const [shopProducts, setShopProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(false);

    // Fetch Data on Mount
    useEffect(() => {
        fetchPantry();
        fetchProducts();
        fetchCart();
    }, []);

    const fetchPantry = async () => {
        try {
            const res = await pantryService.getItems();
            // Backend returns list of { id, ingredient: { name, ... }, quantity, ... } or similar.
            // Adjusting based on likely serializer output.
            if (res.data) setPantry(res.data);
        } catch (err) {
            console.error("Failed to fetch pantry", err);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await shopService.getProducts();
            if (res.data) setShopProducts(res.data);
        } catch (err) {
            console.error("Failed to fetch products", err);
        }
    };

    const fetchCart = async () => {
        try {
            const res = await shopService.getCart();
            // Assuming cart returns items list or similar structure
            if (res.data && res.data.items) setCart(res.data.items);
        } catch (err) {
            console.error("Failed to fetch cart", err);
        }
    };

    const addToCart = async (product) => {
        try {
            await shopService.addToCart(product.id, 1);
            alert(`${product.name} added to cart!`);
            fetchCart(); // Refresh cart
        } catch (err) {
            const msg = err.response?.data?.error;
            if (msg === 'profile_incomplete') {
                alert('Please complete your profile (address & location) to add items to cart.');
            } else {
                alert(msg || 'Failed to add to cart');
            }
        }
    };

    // Mock Recipes (since backend endpoint for recipes might be complex/ML based, we keep this mocked or try to fetch if endpoint exists)
    // inventory/urls.py has 'recommend/', let's try to use it if we can, otherwise mock for now to ensure UI stability.
    const recipes = [
        { id: 1, name: 'Tuna Poke Bowl', ingredients: [{ name: 'Rice', qty: 1 }, { name: 'Tuna', qty: 1 }, { name: 'Avocado', qty: 1 }], image: 'https://placehold.co/300x200?text=Poke+Bowl' },
        { id: 2, name: 'Avocado Toast', ingredients: [{ name: 'Avocado', qty: 1 }], image: 'https://placehold.co/300x200?text=Avo+Toast' },
    ];

    const handleCook = (recipe) => {
        // Simulation for now as 'cook/' endpoint requires specific payload
        alert(`Cook functionality would update pantry for ${recipe.name}`);
        // Real implementation would call pantryService.cook(recipe.id)
    };

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <div>
                    <h1 style={styles.title}>Customer Dashboard</h1>
                    <p style={styles.subtitle}>Manage your pantry, shop ingredients, and discover recipes.</p>
                </div>
                <div style={styles.cartSummary}>
                    <ShoppingCart size={20} /> <span style={{ fontWeight: 'bold' }}>{cart.length}</span> items
                </div>
            </header>

            {/* Tabs */}
            <div style={styles.tabs}>
                <button style={activeTab === 'recommendations' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('recommendations')}>
                    <ChefHat size={18} /> Recipes & Recommendations
                </button>
                <button style={activeTab === 'pantry' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('pantry')}>
                    <Package size={18} /> My Pantry
                </button>
                <button style={activeTab === 'shop' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('shop')}>
                    <ShoppingCart size={18} /> Shop Ingredients
                </button>
            </div>

            {/* Content Areas */}
            <main style={styles.content}>

                {/* RECIPES VIEW */}
                {activeTab === 'recommendations' && (
                    <div style={styles.grid}>
                        {recipes.map(recipe => (
                            <div key={recipe.id} style={styles.card}>
                                <div style={{ ...styles.cardImage, backgroundImage: `url(${recipe.image})` }}></div>
                                <div style={styles.cardContent}>
                                    <h3>{recipe.name}</h3>
                                    <div style={styles.ingList}>
                                        {recipe.ingredients.map((ing, i) => (
                                            <span key={i} style={styles.badge}>{ing.name} ({ing.qty})</span>
                                        ))}
                                    </div>
                                    <button style={styles.actionBtn} onClick={() => handleCook(recipe)}>
                                        <ChefHat size={16} /> Cook Recipe
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* PANTRY VIEW */}
                {activeTab === 'pantry' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={styles.sectionTitle}>Current Stock</h2>
                            <button style={styles.smBtn} onClick={fetchPantry}>Refresh</button>
                        </div>

                        {pantry.length === 0 ? (
                            <p>Your pantry is empty.</p>
                        ) : (
                            <div style={styles.list}>
                                {pantry.map(item => (
                                    <div key={item.id} style={styles.listItem}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={styles.iconBox}><Package size={20} /></div>
                                            <div>
                                                {/* Adjust based on actual API response structure */}
                                                <h4>{item.ingredient ? item.ingredient.name : item.name || 'Unknown Item'}</h4>
                                                <p style={{ color: '#666' }}>{item.quantity} {item.unit || 'units'}</p>
                                            </div>
                                        </div>
                                        <div style={styles.status}>
                                            <span style={{ color: 'green' }}>In Stock</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* SHOP VIEW */}
                {activeTab === 'shop' && (
                    <div style={styles.grid}>
                        {shopProducts.length === 0 ? <p>No products available.</p> : shopProducts.map(product => (
                            <div key={product.id} style={styles.card}>
                                {/* Using placeholder if no image field */}
                                <div style={{ ...styles.cardImage, backgroundImage: `url(${product.image || 'https://placehold.co/300x200?text=Product'})`, height: '150px' }}></div>
                                <div style={styles.cardContent}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <h3>{product.name}</h3>
                                        <span style={styles.price}>{formatCurrency(product.price)}</span>
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.5rem' }}>{product.category}</p>
                                    <button style={styles.actionBtn} onClick={() => addToCart(product)}>
                                        <Plus size={16} /> Add to Cart
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </main>
        </div>
    );
};

// Reusing styles from before
const styles = {
    page: { maxWidth: '1200px', margin: '0 auto', padding: '2rem' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
    title: { fontSize: '2rem', color: 'var(--color-primary)' },
    subtitle: { color: 'var(--color-text-light)' },
    cartSummary: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff', padding: '0.8rem 1.5rem', borderRadius: '50px', boxShadow: 'var(--shadow-sm)' },
    tabs: { display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' },
    tab: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', color: '#666', background: 'transparent' },
    activeTab: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#fff', background: 'var(--color-primary)', boxShadow: 'var(--shadow-sm)' },
    content: { minHeight: '400px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' },
    card: { background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', border: '1px solid #f0f0f0' },
    cardImage: { height: '180px', backgroundSize: 'cover', backgroundPosition: 'center' },
    cardContent: { padding: '1.5rem' },
    ingList: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '1rem 0' },
    badge: { fontSize: '0.8rem', background: '#f5f5f5', padding: '4px 8px', borderRadius: '4px', color: '#555' },
    actionBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '10px', marginTop: '1rem', background: 'var(--color-primary)', color: '#fff', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' },
    sectionTitle: { marginBottom: '1.5rem' },
    list: { display: 'flex', flexDirection: 'column', gap: '1rem' },
    listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '1rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' },
    iconBox: { width: '40px', height: '40px', background: '#f0f0f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    price: { fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--color-accent)' },
    smBtn: { padding: '6px 12px', fontSize: '0.9rem', cursor: 'pointer', background: '#eee', borderRadius: '6px' }
};

export default CustomerDashboard;
