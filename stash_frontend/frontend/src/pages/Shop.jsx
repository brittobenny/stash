import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ShoppingCart, Plus, Search, SlidersHorizontal, BadgePercent } from 'lucide-react';
import { shopService, accountService } from '../services/api';
import { formatCurrency } from '../utils/currency';
import '../styles/global.css';
import '../styles/shop.css';

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
            console.error('Failed to fetch products', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCart = async () => {
        try {
            const res = await shopService.getCart();
            if (res.data && res.data.items) setCart(res.data.items);
        } catch (err) {
            console.error('Failed to fetch cart', err);
        }
    };

    const addToCart = async (product) => {
        if (!profileComplete) {
            alert('Please complete your profile (address & location) to add items to cart.');
            return;
        }
        try {
            await shopService.addToCart(product.id, 1);
            fetchCart();
            alert(`${product.name} added to cart!`);
        } catch (err) {
            alert('Failed to add to cart: ' + err.message);
        }
    };

    const getCartCount = () => cart.reduce((total, item) => total + item.quantity, 0);

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
        <div className="shop-mall">
            <section className="shop-mall__topbar">
                <div>
                    <div className="shop-mall__eyebrow">STASH MARKETPLACE</div>
                    <h1>Shop Ingredients</h1>
                    <p>Discover fresh, pantry‑friendly ingredients with quick delivery.</p>
                </div>
                <div className="shop-mall__cart">
                    <ShoppingCart size={18} />
                    <span>{getCartCount()} items</span>
                    <button className="shop-mall__cart-btn" onClick={() => profileComplete && (window.location.href = '/customer/cart')}>
                        View Cart
                    </button>
                    <button className="shop-mall__cart-ghost" onClick={() => window.location.href = '/customer/orders'}>
                        Orders
                    </button>
                </div>
            </section>

            {!profileComplete && (
                <div className="shop-mall__alert">Complete your profile (address & location) to start shopping.</div>
            )}

            <section className="shop-mall__banner">
                <div>
                    <div className="shop-mall__banner-chip">
                        <BadgePercent size={14} /> Weekend pantry deals
                    </div>
                    <h2>Save big on weekly essentials.</h2>
                    <p>Bundles updated daily for your location. Auto‑adds to pantry after delivery.</p>
                    <div className="shop-mall__banner-actions">
                        <button className="btn btn-primary">Explore bundles</button>
                        <button className="shop-mall__ghost">View recommendations</button>
                    </div>
                </div>
                <div className="shop-mall__banner-card">
                    <div>
                        <strong>Veggie starter kit</strong>
                        <span>$18.00</span>
                    </div>
                    <div>
                        <strong>Weekly grains pack</strong>
                        <span>$24.00</span>
                    </div>
                    <div>
                        <strong>Dairy essentials</strong>
                        <span>$12.00</span>
                    </div>
                </div>
            </section>

            <section className="shop-mall__layout">
                <aside className="shop-mall__filters">
                    <div className="shop-mall__filters-title">
                        <SlidersHorizontal size={18} /> Filters
                    </div>
                    <div className="shop-mall__filter-group">
                        <h4>Category</h4>
                        <div className="shop-mall__chips">
                            <button className="shop-mall__chip active">All</button>
                            <button className="shop-mall__chip">Vegetables</button>
                            <button className="shop-mall__chip">Grains</button>
                            <button className="shop-mall__chip">Dairy</button>
                            <button className="shop-mall__chip">Spices</button>
                        </div>
                    </div>
                    <div className="shop-mall__filter-group">
                        <h4>Price Range</h4>
                        <div className="shop-mall__range">
                            <span>$10</span>
                            <div className="shop-mall__range-bar" />
                            <span>$120</span>
                        </div>
                    </div>
                    <div className="shop-mall__filter-group">
                        <h4>Availability</h4>
                        <label className="shop-mall__toggle">
                            <input type="checkbox" defaultChecked />
                            <span>In stock only</span>
                        </label>
                    </div>
                    <div className="shop-mall__promo">
                        <strong>Free delivery</strong>
                        <span>Orders above $40</span>
                    </div>
                </aside>

                <div className="shop-mall__content">
                    <div className="shop-mall__toolbar">
                        <div className="shop-mall__search">
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <select className="shop-mall__sort">
                            <option>Sort: Popular</option>
                            <option>Price: Low to High</option>
                            <option>Price: High to Low</option>
                        </select>
                    </div>

                    {loading ? (
                        <div className="shop-mall__loading">Loading products...</div>
                    ) : (
                        <div className="shop-mall__grid">
                            {filteredProducts.length === 0 ? (
                                <p className="shop-mall__empty">No products available at the moment.</p>
                            ) : (
                                sortedProducts.map((product, index) => (
                                    <div key={product.id} className="shop-mall__card fade-up" style={{ animationDelay: `${index * 0.05}s` }}>
                                        <div className="shop-mall__card-img">
                                            <img
                                                src={resolveProductImage(product)}
                                                alt={product.name}
                                                onError={(e) => {
                                                    e.currentTarget.src = `https://placehold.co/600x400?text=${encodeURIComponent(product.name)}`;
                                                }}
                                            />
                                            <span className="shop-mall__tag">Trending</span>
                                        </div>
                                        <div className="shop-mall__card-body">
                                            <div className="shop-mall__card-row">
                                                <h3>{product.name}</h3>
                                                <span>{formatCurrency(product.price)}</span>
                                            </div>
                                            <p>{product.category_name || product.category || 'General'}</p>
                                            {product.owner_location && (
                                                <p className="shop-mall__muted">Shop: {product.owner_location}</p>
                                            )}
                                            <div className="shop-mall__stock">
                                                <span className={product.stock_quantity > 0 ? 'in' : 'out'}>
                                                    {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of Stock'}
                                                </span>
                                            </div>
                                            <button
                                                className="shop-mall__cta"
                                                disabled={product.stock_quantity <= 0 || !profileComplete}
                                                onClick={() => addToCart(product)}
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
            </section>
        </div>
    );
};

export default Shop;
