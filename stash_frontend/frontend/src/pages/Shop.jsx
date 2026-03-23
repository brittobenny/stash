import React, { useEffect, useMemo, useState } from 'react';
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
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [priceCap, setPriceCap] = useState(null);
    const [inStockOnly, setInStockOnly] = useState(true);
    const [sortBy, setSortBy] = useState('popular');

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
        } catch {
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

    const categoryOptions = useMemo(() => {
        const seen = new Set();
        const categories = shopProducts
            .map((product) => String(product.category_name || product.category || '').trim())
            .filter((name) => {
                const key = name.toLowerCase();
                if (!name || seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .sort((a, b) => a.localeCompare(b));
        return ['All', ...categories];
    }, [shopProducts]);

    const priceBounds = useMemo(() => {
        if (!shopProducts.length) return { min: 0, max: 0 };
        const prices = shopProducts
            .map((product) => Number(product.price || 0))
            .filter((price) => Number.isFinite(price));
        if (!prices.length) return { min: 0, max: 0 };
        return {
            min: Math.floor(Math.min(...prices)),
            max: Math.ceil(Math.max(...prices)),
        };
    }, [shopProducts]);

    useEffect(() => {
        if (priceCap === null || priceCap > priceBounds.max) {
            setPriceCap(priceBounds.max);
        }
    }, [priceBounds.max, priceCap]);

    const visibleProducts = useMemo(() => {
        const term = search.toLowerCase().trim();
        const maxPrice = priceCap ?? priceBounds.max;
        const filtered = shopProducts.filter((product) => {
            const productCategory = String(product.category_name || product.category || '').trim();
            const price = Number(product.price || 0);
            const isInStock = Number(product.stock_quantity || 0) > 0;
            const matchesSearch = !term || (
                String(product.name || '').toLowerCase().includes(term) ||
                String(product.ingredient_name || '').toLowerCase().includes(term) ||
                productCategory.toLowerCase().includes(term)
            );
            const matchesCategory = selectedCategory === 'All' || productCategory.toLowerCase() === selectedCategory.toLowerCase();
            const matchesPrice = !Number.isFinite(maxPrice) || price <= maxPrice;
            const matchesStock = !inStockOnly || isInStock;
            return matchesSearch && matchesCategory && matchesPrice && matchesStock;
        });

        filtered.sort((a, b) => {
            if (userLocation) {
                const target = userLocation.toLowerCase();
                const aMatch = String(a.owner_location || '').toLowerCase().includes(target);
                const bMatch = String(b.owner_location || '').toLowerCase().includes(target);
                if (aMatch !== bMatch) {
                    return aMatch ? -1 : 1;
                }
            }

            if (sortBy === 'price_low') return Number(a.price || 0) - Number(b.price || 0);
            if (sortBy === 'price_high') return Number(b.price || 0) - Number(a.price || 0);
            if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''));

            return Number(b.stock_quantity || 0) - Number(a.stock_quantity || 0);
        });

        return filtered;
    }, [inStockOnly, priceBounds.max, priceCap, search, selectedCategory, shopProducts, sortBy, userLocation]);

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
                            {categoryOptions.map((category) => (
                                <button
                                    key={category}
                                    type="button"
                                    className={`shop-mall__chip${selectedCategory === category ? ' active' : ''}`}
                                    onClick={() => setSelectedCategory(category)}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="shop-mall__filter-group">
                        <h4>Price Range</h4>
                        <div className="shop-mall__range">
                            <span>{formatCurrency(priceBounds.min)}</span>
                            <input
                                type="range"
                                min={priceBounds.min}
                                max={priceBounds.max || 0}
                                step="1"
                                value={priceCap ?? priceBounds.max}
                                onChange={(e) => setPriceCap(Number(e.target.value))}
                                className="shop-mall__range-input"
                                aria-label="Maximum price"
                                disabled={priceBounds.max <= priceBounds.min}
                            />
                            <span>{formatCurrency(priceCap ?? priceBounds.max)}</span>
                        </div>
                        <div className="shop-mall__range-caption">
                            Showing items up to {formatCurrency(priceCap ?? priceBounds.max)}
                        </div>
                    </div>
                    <div className="shop-mall__filter-group">
                        <h4>Availability</h4>
                        <label className="shop-mall__toggle">
                            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
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
                        <select className="shop-mall__sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                            <option value="popular">Sort: Popular</option>
                            <option value="price_low">Price: Low to High</option>
                            <option value="price_high">Price: High to Low</option>
                            <option value="name">Name: A to Z</option>
                        </select>
                    </div>

                    {loading ? (
                        <div className="shop-mall__loading">Loading products...</div>
                    ) : (
                        <div className="shop-mall__grid">
                            {visibleProducts.length === 0 ? (
                                <p className="shop-mall__empty">No products available at the moment.</p>
                            ) : (
                                visibleProducts.map((product, index) => (
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
