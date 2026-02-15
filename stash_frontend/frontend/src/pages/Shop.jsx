import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ShoppingCart, Plus, Search } from 'lucide-react';
import { shopService } from '../services/api';
import '../styles/global.css';

const Shop = () => {
    const location = useLocation();
    const [shopProducts, setShopProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchProducts();
        fetchCart();
    }, []);

    useEffect(() => {
        const q = new URLSearchParams(location.search).get('q');
        if (q) setSearch(q);
    }, [location.search]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await shopService.getProducts();
            if (res.data) setShopProducts(res.data);
        } catch (err) {
            console.error("Failed to fetch products", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCart = async () => {
        try {
            const res = await shopService.getCart();
            if (res.data && res.data.items) setCart(res.data.items);
        } catch (err) {
            console.error("Failed to fetch cart", err);
        }
    };

    const addToCart = async (product) => {
        try {
            await shopService.addToCart(product.id, 1);
            // Simple optimistic UI update or refetch
            fetchCart();
            alert(`${product.name} added to cart!`);
        } catch (err) {
            alert('Failed to add to cart: ' + err.message);
        }
    };

    const getCartCount = () => {
        return cart.reduce((total, item) => total + item.quantity, 0);
    };

    const filteredProducts = shopProducts.filter((product) => {
        const term = search.toLowerCase();
        if (!term) return true;
        return (
            String(product.name || '').toLowerCase().includes(term) ||
            String(product.ingredient_name || '').toLowerCase().includes(term) ||
            String(product.category_name || '').toLowerCase().includes(term)
        );
    });

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <div>
                    <h1 style={styles.title}>Shop Ingredients</h1>
                    <p style={styles.subtitle}>Browse and purchase fresh ingredients for your pantry.</p>
                </div>
                <div style={styles.searchBar}>
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={styles.searchInput}
                    />
                </div>
                <div style={styles.cartSummary}>
                    <ShoppingCart size={20} /> <span style={{ fontWeight: 'bold' }}>{getCartCount()}</span> items
                    {getCartCount() > 0 && (
                        <button style={styles.checkoutBtn} onClick={() => window.location.href = '/customer/cart'}>
                            View Cart
                        </button>
                    )}
                    <button style={styles.ordersBtn} onClick={() => window.location.href = '/customer/orders'}>
                        Orders
                    </button>
                </div>
            </header>

            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>Loading products...</div>
            ) : (
                <div style={styles.grid}>
                    {filteredProducts.length === 0 ? (
                        <p style={{ gridColumn: '1/-1', textAlign: 'center' }}>No products available at the moment.</p>
                    ) : (
                        filteredProducts.map((product, index) => (
                            <div
                                key={product.id}
                                style={{ ...styles.card, animationDelay: `${index * 0.05}s` }}
                                className="fade-up hover-float"
                            >
                                {(() => {
                                    const img = product.image
                                        ? (String(product.image).startsWith('http')
                                            ? product.image
                                            : `http://127.0.0.1:8000${product.image}`)
                                        : `https://placehold.co/600x400?text=${encodeURIComponent(product.name)}`;
                                    return (
                                        <div style={styles.cardImage}>
                                            <img
                                                src={img}
                                                alt={product.name}
                                                style={styles.cardImg}
                                                crossOrigin="anonymous"
                                                referrerPolicy="no-referrer"
                                                onError={(e) => {
                                                    e.currentTarget.src = `https://placehold.co/600x400?text=${encodeURIComponent(product.name)}`;
                                                }}
                                            />
                                        </div>
                                    );
                                })()}
                                <div style={styles.cardContent}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                        <h3 style={styles.productName}>{product.name}</h3>
                                        <span style={styles.price}>${Number(product.price).toFixed(2)}</span>
                                    </div>
                                    <p style={styles.category}>{product.category_name || product.category || 'General'}</p>
                                    <div style={styles.stockInfo}>
                                        <span style={{ color: product.stock_quantity > 0 ? 'green' : 'red' }}>
                                            {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of Stock'}
                                        </span>
                                    </div>
                                    <button
                                        style={{ ...styles.actionBtn, opacity: product.stock_quantity > 0 ? 1 : 0.5 }}
                                        onClick={() => addToCart(product)}
                                        disabled={product.stock_quantity <= 0}
                                    >
                                        <Plus size={16} /> Add to Cart
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const styles = {
    page: { maxWidth: '1200px', margin: '0 auto', padding: '2rem' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' },
    title: { fontSize: '2rem', color: 'var(--color-text)' },
    subtitle: { color: 'var(--color-text-light)' },
    searchBar: { display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '8px 14px', minWidth: '240px' },
    searchInput: { border: 'none', outline: 'none', background: 'transparent', color: 'var(--color-text)', width: '100%' },
    cartSummary: { display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-surface)', padding: '0.8rem 1.5rem', borderRadius: '50px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' },
    checkoutBtn: { background: 'var(--color-primary)', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem' },
    ordersBtn: { background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' },
    card: { background: 'var(--color-surface)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)', transition: 'transform 0.2s' },
    cardImage: { height: '180px', backgroundColor: 'var(--color-surface-2)', overflow: 'hidden' },
    cardImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    cardContent: { padding: '1.5rem' },
    productName: { fontSize: '1.2rem', margin: 0 },
    price: { fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--color-primary)' },
    category: { fontSize: '0.9rem', color: 'var(--color-text-light)', marginBottom: '0.5rem' },
    stockInfo: { fontSize: '0.85rem', marginBottom: '1rem' },
    actionBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '12px', background: 'var(--color-primary)', color: '#ffffff', borderRadius: '8px', fontWeight: '500', cursor: 'pointer', border: 'none' },
};

export default Shop;
