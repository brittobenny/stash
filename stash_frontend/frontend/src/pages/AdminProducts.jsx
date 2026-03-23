import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, Search } from 'lucide-react';
import { shopService } from '../services/api';
import { formatCurrency } from '../utils/currency';
import '../styles/global.css';
import '../styles/admin.css';

const AdminProducts = () => {
    const [products, setProducts] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [shopFilter, setShopFilter] = useState('All');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [lowStockOnly, setLowStockOnly] = useState(false);

    const loadProducts = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await shopService.getProducts();
            setProducts(res.data || []);
        } catch (err) {
            setError('Failed to load products.');
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProducts();
    }, []);

    const shopOptions = useMemo(() => {
        const unique = new Set();
        (products || []).forEach((p) => {
            if (p.owner) unique.add(p.owner);
        });
        return ['All', ...Array.from(unique)];
    }, [products]);

    const categoryOptions = useMemo(() => {
        const unique = new Set();
        (products || []).forEach((p) => {
            const name = p.category_name || p.category;
            if (name) unique.add(String(name));
        });
        return ['All', ...Array.from(unique)];
    }, [products]);

    const filteredProducts = useMemo(() => {
        const term = search.toLowerCase().trim();
        return (products || []).filter((p) => {
            const matchesSearch = !term || String(p.name || '').toLowerCase().includes(term);
            const matchesShop = shopFilter === 'All' || p.owner === shopFilter;
            const matchesCategory = categoryFilter === 'All' || String(p.category_name || p.category || '') === categoryFilter;
            const isLow = Number(p.stock_quantity || 0) <= Number(p.low_stock_threshold || 0);
            const matchesLow = !lowStockOnly || isLow;
            return matchesSearch && matchesShop && matchesCategory && matchesLow;
        });
    }, [products, search, shopFilter, categoryFilter, lowStockOnly]);

    return (
        <div className="admin-page">
            <div className="admin-header">
                <h1 className="admin-title">Products Management</h1>
                <span className="admin-badge">
                    <Boxes size={16} /> Shop inventory overview
                </span>
            </div>

            {error && <div className="admin-error">{error}</div>}

            <div className="admin-filters">
                <div className="admin-input admin-input-search">
                    <Search size={14} />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select className="admin-select" value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
                    {shopOptions.map((shop) => (
                        <option key={shop} value={shop}>{shop}</option>
                    ))}
                </select>
                <select className="admin-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
                <label className="admin-checkbox">
                    <input
                        type="checkbox"
                        checked={lowStockOnly}
                        onChange={(e) => setLowStockOnly(e.target.checked)}
                    />
                    Low stock only
                </label>
                <button className="admin-btn" onClick={loadProducts} disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            <div className="admin-table-wrap">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Shop</th>
                            <th>Category</th>
                            <th>Price</th>
                            <th>Stock</th>
                            <th>Low Stock</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProducts.map((p) => {
                            const isLow = Number(p.stock_quantity || 0) <= Number(p.low_stock_threshold || 0);
                            return (
                                <tr key={p.id}>
                                    <td>
                                        <strong>{p.name}</strong>
                                    </td>
                                    <td>{p.owner || '--'}</td>
                                    <td>{p.category_name || p.category || '--'}</td>
                                    <td>{formatCurrency(p.price)}</td>
                                    <td>{p.stock_quantity}</td>
                                    <td>
                                        <span className={`admin-status ${isLow ? 'admin-status-warn' : 'admin-status-ok'}`}>
                                            {isLow ? 'Low' : 'OK'}
                                        </span>
                                    </td>
                                    <td>{p.is_active ? 'Active' : 'Hidden'}</td>
                                </tr>
                            );
                        })}
                        {filteredProducts.length === 0 && (
                            <tr>
                                <td colSpan={7}>No products found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminProducts;
