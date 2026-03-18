import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ShoppingCart, Plus, Search } from 'lucide-react';
import { shopService, accountService } from '../services/api';
import { formatCurrency } from '../utils/currency';
import '../styles/global.css';

const Shop = () => {
    const location = useLocation();
    const [shopProducts, setShopProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [profileComplete, setProfileComplete] = useState(true);
    const [userLocation, setUserLocation] = useState('');

    useEffect(() => {
        fetchProducts();
        fetchCart();
        fetchProfile();
    }, []);

    useEffect(() => {
        const q = new URLSearchParams(location.search).get('q');
        if (q) setSearch(q);
    }, [location.search]);

    useEffect(() => {
        const prevBg = document.body.style.backgroundImage;
        const prevSize = document.body.style.backgroundSize;
        const prevRepeat = document.body.style.backgroundRepeat;
        const prevColor = document.body.style.backgroundColor;
        const prevAttachment = document.body.style.backgroundAttachment;
        const prevPosition = document.body.style.backgroundPosition;

        document.body.style.backgroundImage = [
            'radial-gradient(circle at 15% 58%, rgba(195, 218, 170, 0.18), transparent 14%)',
            'radial-gradient(circle at 85% 40%, rgba(195, 218, 170, 0.16), transparent 16%)',
            'linear-gradient(rgba(250,245,236,0.92), rgba(250,245,236,0.94))',
        ].join(', ');
        document.body.style.backgroundSize = 'auto, auto, auto';
        document.body.style.backgroundRepeat = 'no-repeat, no-repeat, no-repeat';
        document.body.style.backgroundAttachment = 'fixed, fixed, fixed';
        document.body.style.backgroundPosition = 'left bottom, right center, center';
        document.body.style.backgroundColor = '#faf5ec';

        return () => {
            document.body.style.backgroundImage = prevBg;
            document.body.style.backgroundSize = prevSize;
            document.body.style.backgroundRepeat = prevRepeat;
            document.body.style.backgroundColor = prevColor;
            document.body.style.backgroundAttachment = prevAttachment;
            document.body.style.backgroundPosition = prevPosition;
        };
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await accountService.getProfile();
            setProfileComplete(Boolean(res.data?.profile_completed));
            setUserLocation(String(res.data?.location || '').trim());
        } catch (err) {
            setProfileComplete(true);
        }
    };

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
        if (!profileComplete) {
            alert('Please complete your profile (address & location) to add items to cart.');
            return;
        }
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

    const sortedProducts = [...filteredProducts].sort((a, b) => {
        if (!userLocation) return 0;
        const aLoc = String(a.owner_location || '').toLowerCase();
        const bLoc = String(b.owner_location || '').toLowerCase();
        const target = userLocation.toLowerCase();
        const aMatch = aLoc && aLoc.includes(target);
        const bMatch = bLoc && bLoc.includes(target);
        if (aMatch === bMatch) return 0;
        return aMatch ? -1 : 1;
    });

    const resolveProductImage = (product) => {
        const raw = String(product?.image || '').trim();
        if (!raw) {
            return `https://placehold.co/600x400?text=${encodeURIComponent(product?.name || 'Product')}`;
        }
        if (raw.startsWith('http://') || raw.startsWith('https://')) {
            return raw;
        }
        let path = raw;
        if (!path.startsWith('/media/')) {
            path = `/media/${path.replace(/^\//, '')}`;
        }
        return `http://127.0.0.1:8000${path}`;
    };

    return (
        <div style={styles.page}>
            <div style={styles.decorLeft}>
                <div style={styles.branchStem} />
                <span style={{ ...styles.branchLeaf, top: '18px', left: '14px', transform: 'rotate(-34deg)' }} />
                <span style={{ ...styles.branchLeaf, top: '44px', left: '2px', transform: 'rotate(-62deg)' }} />
                <span style={{ ...styles.branchLeaf, top: '66px', left: '18px', transform: 'rotate(-18deg)' }} />
                <span style={{ ...styles.branchLeaf, top: '92px', left: '8px', transform: 'rotate(-44deg)' }} />
                <span style={{ ...styles.branchLeaf, top: '112px', left: '26px', transform: 'rotate(-8deg)' }} />
            </div>
            <div style={styles.decorRight}>
                <div style={styles.branchStem} />
                <span style={{ ...styles.branchLeaf, top: '18px', left: '16px', transform: 'rotate(36deg)' }} />
                <span style={{ ...styles.branchLeaf, top: '40px', left: '30px', transform: 'rotate(68deg)' }} />
                <span style={{ ...styles.branchLeaf, top: '68px', left: '12px', transform: 'rotate(18deg)' }} />
                <span style={{ ...styles.branchLeaf, top: '94px', left: '32px', transform: 'rotate(48deg)' }} />
                <span style={{ ...styles.branchLeaf, top: '120px', left: '18px', transform: 'rotate(12deg)' }} />
            </div>
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
                        <button style={{ ...styles.checkoutBtn, opacity: profileComplete ? 1 : 0.5 }} onClick={() => profileComplete && (window.location.href = '/customer/cart')}>
                            View Cart
                        </button>
                    )}
                    <button style={styles.ordersBtn} onClick={() => window.location.href = '/customer/orders'}>
                        Orders
                    </button>
                </div>
            </header>
            {!profileComplete && (
                <div style={styles.alert}>Complete your profile (address & location) to start shopping.</div>
            )}

            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>Loading products...</div>
            ) : (
                <div style={styles.grid}>
                    {filteredProducts.length === 0 ? (
                        <p style={{ gridColumn: '1/-1', textAlign: 'center' }}>No products available at the moment.</p>
                    ) : (
                        sortedProducts.map((product, index) => (
                            <div
                                key={product.id}
                                style={{ ...styles.card, animationDelay: `${index * 0.05}s` }}
                                className="fade-up hover-float"
                            >
                                {(() => {
                                    const img = resolveProductImage(product);
                                    return (
                                        <div style={styles.cardImage}>
                                            <img
                                                src={img}
                                                alt={product.name}
                                                style={styles.cardImg}
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
                                        <span style={styles.price}>{formatCurrency(product.price)}</span>
                                    </div>
                                    <p style={styles.category}>{product.category_name || product.category || 'General'}</p>
                                    {product.owner_location && (
                                        <div style={styles.locationTag}>Shop: {product.owner_location}</div>
                                    )}
                                    <div style={styles.stockInfo}>
                                        <span style={{ color: product.stock_quantity > 0 ? 'green' : 'red' }}>
                                            {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of Stock'}
                                        </span>
                                    </div>
                                    <button
                                        style={{ ...styles.actionBtn, opacity: product.stock_quantity > 0 && profileComplete ? 1 : 0.5 }}
                                        onClick={() => addToCart(product)}
                                        disabled={product.stock_quantity <= 0 || !profileComplete}
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
    page: { maxWidth: '1220px', margin: '0 auto', padding: '2.2rem 2rem 3rem', position: 'relative' },
    decorLeft: { position: 'absolute', left: '-120px', bottom: '40px', width: '160px', height: '220px', opacity: 0.48, filter: 'blur(0.4px)', pointerEvents: 'none' },
    decorRight: { position: 'absolute', right: '-70px', top: '210px', width: '180px', height: '240px', opacity: 0.42, filter: 'blur(0.5px)', pointerEvents: 'none', transform: 'scaleX(-1)' },
    branchStem: { position: 'absolute', left: '52px', top: '0', bottom: '0', width: '7px', borderRadius: '999px', background: 'linear-gradient(180deg, rgba(118,141,91,0.28), rgba(86,116,61,0.76))', transform: 'rotate(28deg)', transformOrigin: 'top center' },
    branchLeaf: { position: 'absolute', width: '56px', height: '18px', borderRadius: '999px 999px 999px 0', background: 'linear-gradient(90deg, rgba(190,208,168,0.94), rgba(112,140,84,0.98))', boxShadow: '0 0 18px rgba(180, 199, 158, 0.28)' },
    header: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', alignItems: 'center', marginBottom: '2rem', gap: '1.2rem' },
    title: { fontSize: '3rem', color: '#261814', fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '-0.03em', marginBottom: '0.2rem' },
    subtitle: { color: '#5f5448', fontSize: '1.08rem' },
    searchBar: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(198, 179, 145, 0.26)', borderRadius: '999px', padding: '12px 16px', minWidth: '240px', width: '100%', maxWidth: '420px', boxShadow: '0 12px 24px rgba(142, 119, 85, 0.08), inset 0 1px 0 rgba(255,255,255,0.82)' },
    searchInput: { border: 'none', outline: 'none', background: 'transparent', color: '#2d241d', width: '100%', fontSize: '1rem' },
    cartSummary: { display: 'flex', alignItems: 'center', gap: '0.9rem', background: 'linear-gradient(135deg, rgba(192, 113, 118, 0.94), rgba(160, 84, 86, 0.92) 45%, rgba(136, 68, 70, 0.92) 100%)', padding: '0.85rem 1.4rem', borderRadius: '999px', boxShadow: '0 18px 34px rgba(147, 76, 80, 0.24), inset 0 1px 0 rgba(255,255,255,0.22)', border: '1px solid rgba(130, 73, 75, 0.24)', color: '#fff' },
    checkoutBtn: { background: 'linear-gradient(135deg, #8f1717, #6d0e10)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.18)', padding: '8px 16px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, boxShadow: '0 8px 16px rgba(98, 12, 15, 0.18)' },
    ordersBtn: { background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.24)', padding: '8px 16px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.9rem', backdropFilter: 'blur(6px)' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' },
    card: { background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(250,245,236,0.96))', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 24px 42px rgba(145, 122, 86, 0.14)', border: '2px solid rgba(168, 138, 83, 0.72)', transition: 'transform 0.2s', position: 'relative' },
    cardImage: { height: '184px', backgroundColor: '#f4eee4', overflow: 'hidden', padding: '12px 12px 0' },
    cardImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    cardContent: { padding: '1.4rem 1.4rem 1.25rem' },
    productName: { fontSize: '1.1rem', margin: 0, color: '#2a1b14', fontFamily: 'Georgia, "Times New Roman", serif', textTransform: 'lowercase' },
    price: { fontWeight: 'bold', fontSize: '1.06rem', color: '#b38b44', fontFamily: 'Georgia, "Times New Roman", serif' },
    category: { fontSize: '0.88rem', color: '#554940', marginBottom: '0.45rem', textTransform: 'lowercase' },
    stockInfo: { fontSize: '0.85rem', marginBottom: '1rem', color: '#2c251f' },
    actionBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '13px', background: 'linear-gradient(135deg, #7b1717, #8f2220 45%, #a2362f 100%)', color: '#f5dfb1', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', border: '1px solid rgba(108, 26, 24, 0.48)', boxShadow: '0 10px 18px rgba(123, 23, 23, 0.2), inset 0 1px 0 rgba(255,255,255,0.14)', fontSize: '1rem', fontFamily: 'Georgia, "Times New Roman", serif' },
    alert: { background: 'rgba(194,46,63,0.08)', color: '#9c1f32', border: '1px solid rgba(194,46,63,0.16)', padding: '12px 16px', borderRadius: '14px', marginBottom: '1.5rem', fontWeight: '600' },
    locationTag: { fontSize: '0.88rem', color: '#554940', marginBottom: '0.4rem' },
};

export default Shop;
