import React, { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    Calendar,
    LineChart,
    Store,
    Users,
    DollarSign,
    ShoppingBag,
    ShieldCheck,
} from 'lucide-react';
import { adminService, shopService, socialService } from '../services/api';
import '../styles/global.css';
import '../styles/admin.css';

const AdminDashboard = () => {
    const [summary, setSummary] = useState(null);
    const [users, setUsers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [posts, setPosts] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [products, setProducts] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const loadAll = async () => {
        setLoading(true);
        setError('');
        try {
            const [
                summaryRes,
                usersRes,
                ordersRes,
                postsRes,
                feedbackRes,
                productsRes,
            ] = await Promise.all([
                adminService.getSummary(),
                adminService.listUsers(),
                adminService.listOrders(),
                socialService.getReviewQueue('ALL'),
                adminService.listFeedback(),
                shopService.getProducts(),
            ]);
            setSummary(summaryRes.data || null);
            setUsers(usersRes.data || []);
            setOrders(ordersRes.data || []);
            setPosts(postsRes.data || []);
            setFeedback(feedbackRes.data || []);
            setProducts(productsRes.data || []);
            setLastUpdated(new Date());
        } catch (err) {
            setError('Failed to load admin analytics.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
        const timer = setInterval(loadAll, 30000);
        return () => clearInterval(timer);
    }, []);

    const metrics = useMemo(() => {
        const totalUsers = users.length || summary?.total_users || 0;
        const totalOrders = orders.length || summary?.total_orders || 0;
        const totalRevenue = summary?.revenue ?? orders.reduce((sum, o) => {
            if (['CANCELLED', 'REFUNDED'].includes(o.status)) return sum;
            return sum + Number(o.total_amount || 0);
        }, 0);
        const activeUsers = users.filter((u) => {
            if (!u.last_login) return false;
            const last = new Date(u.last_login);
            const thirty = new Date();
            thirty.setDate(thirty.getDate() - 30);
            return last >= thirty;
        }).length;
        const successOrders = orders.filter((o) => ['DELIVERED', 'COMPLETED'].includes(o.status)).length;
        const successRate = totalOrders ? Math.round((successOrders / totalOrders) * 100) : 0;
        const lowStockCount = products.filter((p) => Number(p.stock_quantity || 0) <= Number(p.low_stock_threshold || 0)).length;
        const pendingApprovals = posts.filter((p) => p.status === 'PENDING').length;

        return {
            totalUsers,
            activeUsers,
            totalOrders,
            successRate,
            totalRevenue,
            totalShops: users.filter((u) => u.role === 'shopowner').length || summary?.shop_owners || 0,
            lowStockCount,
            pendingApprovals,
        };
    }, [orders, posts, products, summary, users]);

    const weekSeries = useMemo(() => {
        const now = new Date();
        const labels = [];
        const counts = [];
        for (let i = 6; i >= 0; i -= 1) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            labels.push(d.toLocaleDateString('default', { month: 'short', day: 'numeric' }));
            const count = users.filter((u) => {
                if (!u.date_joined) return false;
                const jd = new Date(u.date_joined);
                return jd.toISOString().slice(0, 10) === key;
            }).length;
            counts.push(count);
        }
        return { labels, counts };
    }, [users]);

    const revenueSeries = useMemo(() => {
        const now = new Date();
        const days = 14;
        const labels = [];
        const values = [];
        for (let i = days - 1; i >= 0; i -= 1) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            labels.push(d.toLocaleDateString('default', { month: 'short', day: 'numeric' }));
            const total = orders.reduce((sum, o) => {
                if (!o.created_at || ['CANCELLED', 'REFUNDED'].includes(o.status)) return sum;
                const orderDate = String(o.created_at).slice(0, 10);
                if (orderDate === key) return sum + Number(o.total_amount || 0);
                return sum;
            }, 0);
            values.push(total);
        }
        return { labels, values };
    }, [orders]);

    const statusSeries = useMemo(() => {
        const now = new Date();
        const days = 14;
        const points = [];
        for (let i = days - 1; i >= 0; i -= 1) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            const daily = orders.filter((o) => String(o.created_at || '').slice(0, 10) === key);
            points.push({
                label: d.getDate(),
                ok: daily.filter((o) => ['DELIVERED', 'COMPLETED'].includes(o.status)).length,
                cancel: daily.filter((o) => ['CANCELLED', 'REFUNDED'].includes(o.status)).length,
            });
        }
        return points;
    }, [orders]);

    const heatmap = useMemo(() => {
        const grid = Array.from({ length: 6 }, () => Array(7).fill(0));
        orders.forEach((o) => {
            if (!o.created_at) return;
            const d = new Date(o.created_at);
            const day = d.getDay();
            const hour = d.getHours();
            const block = Math.floor(hour / 4);
            grid[block][day] += 1;
        });
        const flat = grid.flat();
        const max = Math.max(1, ...flat);
        return { grid, max };
    }, [orders]);

    const shopPerf = useMemo(() => {
        const stats = {};
        orders.forEach((order) => {
            (order.items || []).forEach((item) => {
                const shop = item.product?.owner || 'Unknown';
                stats[shop] = (stats[shop] || 0) + Number(item.quantity || 1);
            });
        });
        return Object.entries(stats)
            .map(([shop, qty]) => ({ shop, qty }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5);
    }, [orders]);

    const activityFeed = useMemo(() => {
        const feed = [];
        users.forEach((u) => {
            if (u.date_joined) {
                feed.push({
                    type: 'user',
                    label: `New ${u.role} registered`,
                    detail: u.email,
                    date: new Date(u.date_joined),
                });
            }
        });
        orders.forEach((o) => {
            if (o.created_at) {
                feed.push({
                    type: 'order',
                    label: `Order #${o.id} ${o.status?.toLowerCase()}`,
                    detail: o.user_email || '',
                    date: new Date(o.created_at),
                });
            }
        });
        return feed.sort((a, b) => b.date - a.date).slice(0, 8);
    }, [orders, users]);

    const renderLineChart = (values = [], color = '#6366f1', accent = '#8b5cf6') => {
        if (!values.length) return null;
        const max = Math.max(...values, 1);
        const points = values
            .map((v, i) => `${(i / (values.length - 1)) * 100},${100 - (v / max) * 85}`)
            .join(' ');
        const smooth = values.map((v, i) => {
            const prev = values[i - 1] ?? v;
            const next = values[i + 1] ?? v;
            return (prev + v + next) / 3;
        });
        const smoothPoints = smooth
            .map((v, i) => `${(i / (smooth.length - 1)) * 100},${100 - (v / max) * 85}`)
            .join(' ');
        return (
            <svg viewBox="0 0 100 100" className="w-full h-56 overflow-visible mt-6">
                <defs>
                    <linearGradient id={`lineGrad-${color.slice(1)}`} x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor={color} />
                        <stop offset="100%" stopColor={accent} />
                    </linearGradient>
                    <linearGradient id={`fillGrad-${color.slice(1)}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                    </linearGradient>
                </defs>
                <polygon points={`0,100 ${points} 100,100`} fill={`url(#fillGrad-${color.slice(1)})`} />
                <polyline points={points} fill="none" stroke={`url(#lineGrad-${color.slice(1)})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={smoothPoints} fill="none" stroke={accent} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
                <polyline points={`0,100 100,100`} fill="none" stroke="#e2e8f0" strokeWidth="1" />
            </svg>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 sm:p-8 lg:p-10 font-sans text-slate-800">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-['Playfair_Display'] text-slate-900 tracking-tight">Admin Intelligence</h1>
                    <p className="text-slate-500 mt-1 font-medium text-sm">Real-time system health and core business metrics.</p>
                </div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm shadow-sm transition-all ${loading ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-emerald-100 text-emerald-700'}`}>
                    <AlertTriangle size={16} className={loading ? 'animate-spin' : ''} /> 
                    {loading ? 'Syncing...' : 'Live System'}
                </div>
            </header>

            {error && (
                <div className="mb-8 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-medium flex items-center gap-2 shadow-sm">
                    <AlertTriangle size={20} /> {error}
                </div>
            )}

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                            <Users size={24} />
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full">+{weekSeries.counts.slice(-1)[0] || 0} Today</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-500 text-sm font-medium mb-1">Total Users</span>
                        <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{metrics.totalUsers}</strong>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                            <Activity size={24} />
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full">{metrics.totalUsers ? Math.round((metrics.activeUsers / metrics.totalUsers) * 100) : 0}% Active</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-500 text-sm font-medium mb-1">Active Users (30d)</span>
                        <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{metrics.activeUsers}</strong>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-violet-50 text-violet-600 rounded-xl group-hover:scale-110 group-hover:bg-violet-600 group-hover:text-white transition-all duration-300">
                            <Store size={24} />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-500 text-sm font-medium mb-1">Total Shops</span>
                        <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{metrics.totalShops}</strong>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>
                    <div className="flex justify-between items-start mb-4 relative">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                            <DollarSign size={24} />
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full">All Time</span>
                    </div>
                    <div className="flex flex-col relative">
                        <span className="text-slate-500 text-sm font-medium mb-1">Total Revenue</span>
                        <strong className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">₹{metrics.totalRevenue.toFixed(2)}</strong>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-sky-50 text-sky-600 rounded-xl group-hover:scale-110 group-hover:bg-sky-600 group-hover:text-white transition-all duration-300">
                            <ShoppingBag size={24} />
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 bg-sky-50 text-sky-600 rounded-full">{metrics.successRate}% Success</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-500 text-sm font-medium mb-1">Total Orders</span>
                        <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{metrics.totalOrders}</strong>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-rose-100 shadow-[0_8px_30px_rgba(225,29,72,0.06)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(225,29,72,0.12)] transition-all duration-300 group relative">
                    {metrics.lowStockCount > 0 && <div className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full -mt-1 -mr-1 animate-ping"></div>}
                    {metrics.lowStockCount > 0 && <div className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full -mt-1 -mr-1"></div>}
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300">
                            <AlertTriangle size={24} />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-rose-600/80 text-sm font-bold mb-1">Low Stock Alerts</span>
                        <strong className="text-3xl font-extrabold text-rose-600 tracking-tight">{metrics.lowStockCount}</strong>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-amber-100 shadow-[0_8px_30px_rgba(217,119,6,0.05)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(217,119,6,0.1)] transition-all duration-300 group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                            <ShieldCheck size={24} />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-amber-700/80 text-sm font-bold mb-1">Pending Approvals</span>
                        <strong className="text-3xl font-extrabold text-amber-600 tracking-tight">{metrics.pendingApprovals}</strong>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-slate-100 text-slate-600 rounded-xl group-hover:scale-110 group-hover:bg-slate-700 group-hover:text-white transition-all duration-300">
                            <Calendar size={24} />
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full">{summary ? 'Online' : '-'}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-500 text-sm font-medium mb-1">Last Updated</span>
                        <strong className="text-sm font-bold text-slate-800 tracking-tight truncate">{lastUpdated ? lastUpdated.toLocaleTimeString() : '...'}</strong>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity duration-500 transform group-hover:scale-110">
                        <Users size={200} />
                    </div>
                    <div className="flex justify-between items-start mb-6 relative">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 tracking-tight">User Registrations</h3>
                            <p className="text-sm font-medium text-slate-500">Daily trend over the past week</p>
                        </div>
                    </div>
                    <div className="relative">
                        {renderLineChart(weekSeries.counts, '#6366f1', '#a855f7')}
                        <div className="flex justify-between text-xs font-semibold text-slate-400 mt-4 px-2">
                            {weekSeries.labels.map((label) => (
                                <span key={label}>{label}</span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity duration-500 transform group-hover:scale-110">
                        <DollarSign size={200} />
                    </div>
                    <div className="flex justify-between items-start mb-6 relative">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Revenue Trend</h3>
                            <p className="text-sm font-medium text-slate-500">Gross processing value (14 days)</p>
                        </div>
                    </div>
                    <div className="relative">
                        {renderLineChart(revenueSeries.values, '#10b981', '#3b82f6')}
                        <div className="flex justify-between text-xs font-semibold text-slate-400 mt-4 px-2 hidden sm:flex">
                            {revenueSeries.labels.filter((_, i) => i % 2 === 0).map((label) => (
                                <span key={label}>{label}</span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-500 col-span-1 lg:col-span-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Order Fulfillment (14 Days)</h3>
                            <p className="text-sm font-medium text-slate-500">Delivered vs Cancelled performance</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl shadow-sm">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-400 shadow-sm rounded-sm"></span> Delivered</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-400 shadow-sm rounded-sm"></span> Cancelled</span>
                        </div>
                    </div>
                    <div className="flex items-end justify-between gap-1 sm:gap-2 h-56 w-full px-2">
                        {statusSeries.map((point, idx) => (
                            <div key={`${point.label}-${idx}`} className="flex flex-col items-center justify-end w-full group/bar cursor-pointer h-full">
                                <div className="w-full max-w-[2.5rem] flex flex-col-reverse justify-start rounded-lg overflow-visible bg-slate-50 shadow-inner group-hover/bar:bg-slate-100 transition-colors relative">
                                    <div className="w-full bg-emerald-400 group-hover/bar:bg-emerald-500 transition-all duration-300 relative group" style={{ height: `${point.ok * 8}px`, minHeight: point.ok > 0 ? '4px' : '0' }}>
                                        {point.ok > 0 && <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">{point.ok}</span>}
                                    </div>
                                    <div className="w-full bg-rose-400 group-hover/bar:bg-rose-500 transition-all duration-300 relative group" style={{ height: `${point.cancel * 8}px`, minHeight: point.cancel > 0 ? '4px' : '0' }}>
                                        {point.cancel > 0 && <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">{point.cancel}</span>}
                                    </div>
                                </div>
                                <span className="text-[10px] sm:text-xs font-bold text-slate-400 mt-4">{point.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] xl:col-span-2 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-500">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Order Density Heatmap</h3>
                            <p className="text-sm font-medium text-slate-500">Frequency by day and time block</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 relative z-10">
                        {heatmap.grid.map((row, rIdx) => (
                            <div key={`row-${rIdx}`} className="flex gap-2 h-10 sm:h-12">
                                <div className="w-16 flex items-center justify-end text-xs font-bold text-slate-400 pr-3 shrink-0">
                                    {String(rIdx * 4).padStart(2,'0')}:00
                                </div>
                                {row.map((value, cIdx) => {
                                    const intensity = value / (heatmap.max || 1);
                                    let bgClass = "bg-slate-50 border border-slate-100";
                                    if (intensity > 0) bgClass = "bg-indigo-100 border border-indigo-200";
                                    if (intensity > 0.3) bgClass = "bg-indigo-300 border border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.2)]";
                                    if (intensity > 0.6) bgClass = "bg-indigo-500 border border-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.4)]";
                                    if (intensity > 0.8) bgClass = "bg-indigo-600 border border-indigo-700 shadow-[0_0_20px_rgba(79,70,229,0.5)]";
                                    return (
                                        <div
                                            key={`cell-${rIdx}-${cIdx}`}
                                            className={`flex-1 rounded-lg transition-all duration-300 hover:scale-[1.05] hover:-translate-y-1 hover:shadow-lg cursor-crosshair ${bgClass}`}
                                            title={`${value} orders at ${rIdx*4}:00, Day ${cIdx}`}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                        <div className="flex gap-2 h-6 mt-3 ml-16">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="flex-1 text-center text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">{day}</div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-8 w-full">
                    <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full w-full">
                        <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1">Top Shops</h3>
                        <p className="text-sm font-medium text-slate-500 mb-6">By items sold</p>
                        
                        {shopPerf.length === 0 ? (
                            <div className="text-sm text-slate-400 text-center py-6 font-medium bg-slate-50 rounded-xl">No sales data recorded.</div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {shopPerf.map((shop, i) => (
                                    <div key={shop.shop} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-200">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-8 h-8 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 group-hover:bg-white group-hover:text-indigo-600 transition-colors shadow-sm">{i + 1}</div>
                                            <span className="font-bold text-slate-800 text-sm truncate">{shop.shop}</span>
                                        </div>
                                        <div className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-indigo-600 shadow-sm shrink-0 ml-2">
                                            {shop.qty} items
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>
            
            <section className="mt-8">
                <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-500">
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1">Recent Activity</h3>
                    <p className="text-sm font-medium text-slate-500 mb-8">Latest events across the platform</p>

                    {activityFeed.length === 0 ? (
                        <div className="text-sm text-slate-400 text-center py-8 font-medium bg-slate-50 rounded-2xl">No recent activity detected.</div>
                    ) : (
                        <div className="space-y-4">
                            {activityFeed.map((item, idx) => (
                                <div key={`${item.type}-${idx}`} className="flex items-start sm:items-center justify-between p-4 sm:p-5 rounded-2xl border border-slate-100 hover:border-slate-300 hover:shadow-md transition-all duration-300 bg-slate-50/30 flex-col sm:flex-row gap-4 group">
                                    <div className="flex items-center gap-4.5">
                                        <div className={`p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300 ${item.type === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                            {item.type === 'user' ? <Users size={20} /> : <ShoppingBag size={20} />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm tracking-tight">{item.label}</div>
                                            <div className="text-xs font-medium text-slate-500 mt-0.5">{item.detail}</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            {item.date.toLocaleDateString()}
                                        </div>
                                        <div className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">
                                            {item.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default AdminDashboard;
