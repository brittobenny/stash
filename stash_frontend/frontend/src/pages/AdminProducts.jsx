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
        <div className="min-h-screen bg-slate-50/50 p-6 sm:p-8 lg:p-10 font-sans text-slate-800">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-['Playfair_Display'] text-slate-900 tracking-tight">Products Management</h1>
                    <p className="text-slate-500 mt-1 font-medium text-sm">Global inventory and stock diagnostics.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm shadow-sm bg-indigo-100 text-indigo-700">
                    <Boxes size={16} /> Inventory Overview
                </div>
            </header>

            {error && (
                <div className="mb-8 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-medium flex items-center gap-2 shadow-sm">
                    <Boxes size={20} /> {error}
                </div>
            )}

            <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8">
                <div className="flex flex-col lg:flex-row gap-4 justify-between items-center mb-6">
                    <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                        <div className="relative w-full sm:w-72">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Search size={18} />
                            </div>
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:font-normal"
                                placeholder="Search products..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <select 
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all appearance-none min-w-[140px]"
                            value={shopFilter} 
                            onChange={(e) => setShopFilter(e.target.value)}
                        >
                            <option value="All" disabled hidden>Filter by Shop</option>
                            {shopOptions.map((shop) => (
                                <option key={shop} value={shop}>{shop === 'All' ? 'All Shops' : shop}</option>
                            ))}
                        </select>
                        <select 
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all appearance-none min-w-[140px]"
                            value={categoryFilter} 
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="All" disabled hidden>Filter by Category</option>
                            {categoryOptions.map((cat) => (
                                <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                        <label className="flex items-center gap-3 cursor-pointer group text-sm font-bold text-slate-600">
                            <div className="relative flex items-center">
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={lowStockOnly}
                                    onChange={(e) => setLowStockOnly(e.target.checked)}
                                />
                                <div className={`w-10 h-6 rounded-full transition-colors drop-shadow-sm ${lowStockOnly ? 'bg-amber-500' : 'bg-slate-200'}`}></div>
                                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${lowStockOnly ? 'translate-x-4' : 'translate-x-0'}`}></div>
                            </div>
                            <span className="group-hover:text-amber-600 transition-colors whitespace-nowrap">Low Stock Only</span>
                        </label>

                        <button 
                            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-500/30 hover:shadow-indigo-500/50 disabled:opacity-50 shrink-0"
                            onClick={loadProducts} 
                            disabled={loading}
                        >
                            {loading ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200/80">
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Product</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Shop</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Category</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Price</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Stock</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Health</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {filteredProducts.map((p) => {
                                const isLow = Number(p.stock_quantity || 0) <= Number(p.low_stock_threshold || 0);
                                return (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="p-4">
                                            <span className="font-bold text-slate-800 text-sm block max-w-[200px] truncate" title={p.name}>{p.name}</span>
                                        </td>
                                        <td className="p-4 text-sm font-medium text-slate-600 max-w-[150px] truncate" title={p.owner}>{p.owner || '--'}</td>
                                        <td className="p-4">
                                            <span className="inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                                                {p.category_name || p.category || '--'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-indigo-700">{formatCurrency(p.price)}</td>
                                        <td className="p-4 text-center">
                                            <span className={`text-sm font-bold ${isLow ? 'text-rose-600' : 'text-slate-700'}`}>{p.stock_quantity}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {isLow ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100 relative shadow-sm">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                                    Low
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                    OK
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                p.is_active ? 'text-indigo-600 bg-indigo-50 border border-indigo-100' : 'text-slate-500 bg-slate-100 border border-slate-200'
                                            }`}>
                                                {p.is_active ? 'Active' : 'Hidden'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredProducts.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-slate-500 font-medium bg-slate-50/50">
                                        <div className="flex flex-col items-center justify-center opacity-70">
                                            <Boxes size={32} className="mb-3 text-slate-400" />
                                            <span>No products found matching your criteria.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminProducts;
