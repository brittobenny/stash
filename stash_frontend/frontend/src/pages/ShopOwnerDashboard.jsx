import React, { useEffect, useMemo, useState } from 'react';
import {
    IndianRupee,
    Package,
    Layers,
    TrendingUp,
    Calendar,
    AlertTriangle,
    Download,
    CheckCircle,
    PackageOpen,
    AlertCircle,
    ArrowUpRight
} from 'lucide-react';
import { shopOwnerService } from '../services/api';
import { formatCurrency } from '../utils/currency';
import '../styles/global.css';

const isoDate = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const defaultTo = isoDate(today);
const defaultFrom = isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29));

const ShopOwnerDashboard = () => {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [chartMode, setChartMode] = useState('day');
    const [filters, setFilters] = useState({
        date_from: defaultFrom,
        date_to: defaultTo,
    });

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const res = await shopOwnerService.getAnalytics(filters);
            setAnalytics(res.data || null);
        } catch (err) {
            setAnalytics(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAnalytics();
    }, []);

    const summary = analytics?.summary || {};
    const salesByDay = analytics?.sales_by_day || [];
    const salesByWeek = analytics?.sales_by_week || [];
    const salesByMonth = analytics?.sales_by_month || [];
    const chartSource = chartMode === 'week' ? salesByWeek : chartMode === 'month' ? salesByMonth : salesByDay;
    const chartRows = chartSource.slice(-10);
    const topProducts = analytics?.top_products || [];
    const lowStockAlerts = analytics?.low_stock_alerts || [];

    const maxRevenue = useMemo(() => {
        const m = chartRows.reduce((acc, row) => Math.max(acc, Number(row.revenue || 0)), 0);
        return m || 1;
    }, [chartRows]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const res = await shopOwnerService.exportAnalytics(filters);
            const blob = new Blob([res.data], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shop_owner_analytics_${filters.date_from}_${filters.date_to}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Failed to export report.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 lg:p-10 font-sans text-slate-800">
            {/* HERO SECTION */}
            <section className="mb-10 relative overflow-hidden rounded-[2rem] bg-slate-900 border border-slate-800 text-white shadow-2xl p-8 lg:p-12">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-rose-600/20 z-0"></div>
                <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"></div>
                
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div className="flex flex-col gap-6">
                        <div>
                            <span className="uppercase tracking-widest text-xs font-bold text-indigo-300 mb-2 block">Shop Owner Dashboard</span>
                            <h1 className="text-4xl lg:text-5xl font-serif font-bold text-white mb-4">Operations Command Center</h1>
                            <p className="text-slate-300 text-lg max-w-lg leading-relaxed">
                                Live sales analytics, low-stock alerts, and export-ready reporting for your store.
                            </p>
                        </div>
                        
                        <div className="flex flex-wrap items-end gap-4 mt-2">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">From</label>
                                <input
                                    type="date"
                                    value={filters.date_from}
                                    onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value }))}
                                    className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">To</label>
                                <input
                                    type="date"
                                    value={filters.date_to}
                                    onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                                    className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <button 
                                onClick={loadAnalytics} 
                                disabled={loading}
                                className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold transition-colors duration-200 mt-2 lg:mt-0 shadow-lg shadow-indigo-500/30"
                            >
                                {loading ? 'Refreshing...' : 'Apply Filter'}
                            </button>
                            <button 
                                onClick={handleExport} 
                                disabled={exporting}
                                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white rounded-xl font-semibold transition-colors duration-200 flex items-center gap-2"
                            >
                                <Download size={18} /> {exporting ? 'Exporting...' : 'Export'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 lg:gap-6">
                        <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex items-center gap-4 hover:bg-white/15 transition-colors">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                                <IndianRupee size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-400 font-medium mb-1">Revenue</p>
                                <p className="text-2xl font-bold text-white">{formatCurrency(summary.total_revenue || 0)}</p>
                            </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex items-center gap-4 hover:bg-white/15 transition-colors">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                                <Package size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-400 font-medium mb-1">Orders</p>
                                <p className="text-2xl font-bold text-white">{summary.total_orders || 0}</p>
                            </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex items-center gap-4 hover:bg-white/15 transition-colors">
                            <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0">
                                <Layers size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-400 font-medium mb-1">Items Sold</p>
                                <p className="text-2xl font-bold text-white">{summary.total_items_sold || 0}</p>
                            </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex items-center gap-4 hover:bg-white/15 transition-colors">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                                <TrendingUp size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-400 font-medium mb-1">AOV</p>
                                <p className="text-2xl font-bold text-white">{formatCurrency(summary.avg_order_value || 0)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* MAIN DASHBOARD CONTENT */}
            <div className="space-y-8">
                
                {/* Sales Trend Section - Redesigned precisely matching screenshot structure */}
                <div className="flex flex-col lg:flex-row gap-6">
                    
                    {/* Metrics List Panel */}
                    <div className="lg:w-1/3 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl p-8 flex flex-col justify-center">
                        <div className="mb-8">
                            <h2 className="text-2xl font-serif font-bold text-slate-900 mb-2">Sales trend</h2>
                            <p className="text-slate-500 text-sm">Daily revenue for the selected period.</p>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                                <div className="flex items-center gap-3 text-slate-600">
                                    <CheckCircle size={18} className="text-emerald-500" />
                                    <span className="font-medium">Delivered orders</span>
                                </div>
                                <span className="text-xl font-bold text-slate-800">{summary.delivered_orders || 0}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                                <div className="flex items-center gap-3 text-slate-600">
                                    <PackageOpen size={18} className="text-amber-500" />
                                    <span className="font-medium">Low stock products</span>
                                </div>
                                <span className="text-xl font-bold text-slate-800">{summary.low_stock_count || 0}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-slate-600">
                                    <AlertCircle size={18} className="text-rose-500" />
                                    <span className="font-medium">Out of stock</span>
                                </div>
                                <span className="text-xl font-bold text-slate-800">{summary.out_of_stock_count || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Chart Panel */}
                    <div className="flex-1 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl p-8 flex flex-col">
                        <div className="flex items-end justify-between mb-8 pb-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Revenue trend</h3>
                                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-rose-50 border border-rose-100 rounded-full text-xs font-semibold text-rose-600">
                                    <Calendar size={12} /> {filters.date_from} to {filters.date_to}
                                </div>
                            </div>
                            
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                {['day', 'week', 'month'].map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setChartMode(mode)}
                                        className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${chartMode === mode ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 flex items-end gap-3 min-h-[220px]">
                            {chartRows.length === 0 ? (
                                <div className="w-full flex items-center justify-center text-slate-400 font-medium">No sales data in this period.</div>
                            ) : (
                                chartRows.map((item, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-3 group relative h-full justify-end">
                                        <div 
                                            className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-lg transition-all duration-300 relative"
                                            style={{ height: `${Math.max(8, (Number(item.revenue || 0) / maxRevenue) * 100)}%` }}
                                        >
                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
                                                {formatCurrency(item.revenue)}
                                            </div>
                                            <div className="absolute inset-x-0 bottom-0 top-0 bg-white/0 group-hover:bg-white/20 transition-colors pointer-events-none rounded-t-lg"></div>
                                        </div>
                                        <span className="text-[10px] md:text-xs font-medium text-slate-400">
                                            {chartMode === 'day' && item.date?.slice(5)}
                                            {chartMode === 'week' && item.week?.slice(5)}
                                            {chartMode === 'month' && item.month?.slice(5)}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Row - Data Tables */}
                <div className="flex flex-col lg:flex-row gap-6">
                    
                    {/* Top Products Table */}
                    <div className="lg:w-2/3 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl p-8 overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800 font-serif">Top products</h3>
                            <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                View all <ArrowUpRight size={16} />
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr>
                                        <th className="pb-4 pt-2 border-b border-slate-100 font-bold text-xs uppercase tracking-wider text-slate-500">Product</th>
                                        <th className="pb-4 pt-2 border-b border-slate-100 font-bold text-xs uppercase tracking-wider text-slate-500">Units</th>
                                        <th className="pb-4 pt-2 border-b border-slate-100 font-bold text-xs uppercase tracking-wider text-slate-500">Revenue</th>
                                        <th className="pb-4 pt-2 border-b border-slate-100 font-bold text-xs uppercase tracking-wider text-slate-500">Stock</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topProducts.length === 0 ? (
                                        <tr><td colSpan="4" className="py-8 text-center text-slate-400 text-sm">No product sales yet.</td></tr>
                                    ) : (
                                        topProducts.map((p) => (
                                            <tr key={p.product_id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-0">
                                                <td className="py-4 pr-4 font-medium text-slate-800">{p.name}</td>
                                                <td className="py-4 px-4 text-slate-600 font-medium">{p.units_sold}</td>
                                                <td className="py-4 px-4 text-slate-800 font-bold">{formatCurrency(p.revenue)}</td>
                                                <td className="py-4 pl-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-700 font-medium">{p.stock_quantity}</span>
                                                        {p.low_stock && (
                                                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider border border-amber-200">Low</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Alerts Log */}
                    <div className="flex-1 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl p-8 flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                                <AlertTriangle size={20} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 font-serif">Inventory alerts</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {lowStockAlerts.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 py-10">
                                    <Package size={32} className="opacity-40" />
                                    <p className="text-sm font-medium">No low-stock alerts.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {lowStockAlerts.map((item) => (
                                        <div key={item.product_id} className={`p-4 rounded-2xl border ${item.is_out_of_stock ? 'bg-rose-50/50 border-rose-100' : 'bg-amber-50/50 border-amber-100'} flex items-center justify-between`}>
                                            <div>
                                                <p className="font-bold text-slate-800 text-base">{item.name}</p>
                                                <p className="text-xs text-slate-500 mt-1 font-medium">
                                                    Stock: <span className="text-slate-700">{item.stock_quantity}</span> / Min: {item.low_stock_threshold}
                                                </p>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${item.is_out_of_stock ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {item.is_out_of_stock ? 'Out' : 'Low'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
            
        </div>
    );
};

export default ShopOwnerDashboard;
