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

    const renderLineChart = (values = [], color = '#e11d48', accent = '#f59e0b') => {
        if (!values.length) return null;
        const max = Math.max(...values, 1);
        const points = values
            .map((v, i) => `${(i / (values.length - 1)) * 100},${100 - (v / max) * 80}`)
            .join(' ');
        const smooth = values.map((v, i) => {
            const prev = values[i - 1] ?? v;
            const next = values[i + 1] ?? v;
            return (prev + v + next) / 3;
        });
        const smoothPoints = smooth
            .map((v, i) => `${(i / (smooth.length - 1)) * 100},${100 - (v / max) * 80}`)
            .join(' ');
        return (
            <svg viewBox="0 0 100 100" className="admin-chart-svg">
                <defs>
                    <linearGradient id="adminLineGrad" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor={color} />
                        <stop offset="100%" stopColor={accent} />
                    </linearGradient>
                    <linearGradient id="adminFillGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.05" />
                    </linearGradient>
                </defs>
                <polygon points={`0,100 ${points} 100,100`} fill="url(#adminFillGrad)" />
                <polyline points={points} fill="none" stroke="url(#adminLineGrad)" strokeWidth="3" />
                <polyline points={smoothPoints} fill="none" stroke={accent} strokeWidth="2" strokeDasharray="4 4" />
                <polyline points={`0,100 100,100`} fill="none" stroke="rgba(15,23,42,0.1)" strokeWidth="2" />
            </svg>
        );
    };

    return (
        <div className="admin-page admin-dashboard">
            <header className="admin-header">
                <div>
                    <h1 className="admin-title">Admin Analytics</h1>
                    <p className="admin-subtitle">Live system health and business performance.</p>
                </div>
                <div className="admin-badge">
                    <AlertTriangle size={16} /> {loading ? 'Syncing...' : 'Live'}
                </div>
            </header>

            {error && <div className="admin-error">{error}</div>}

            <section className="admin-metrics">
                <div className="admin-metric-card">
                    <div>
                        <span>Total Users</span>
                        <strong>{metrics.totalUsers}</strong>
                        <small>+{weekSeries.counts.slice(-1)[0] || 0} today</small>
                    </div>
                    <Users />
                </div>
                <div className="admin-metric-card">
                    <div>
                        <span>Active Users (30d)</span>
                        <strong>{metrics.activeUsers}</strong>
                        <small>{metrics.totalUsers ? Math.round((metrics.activeUsers / metrics.totalUsers) * 100) : 0}% active</small>
                    </div>
                    <Activity />
                </div>
                <div className="admin-metric-card">
                    <div>
                        <span>Total Shops</span>
                        <strong>{metrics.totalShops}</strong>
                        <small>Across regions</small>
                    </div>
                    <Store />
                </div>
                <div className="admin-metric-card">
                    <div>
                        <span>Total Orders</span>
                        <strong>{metrics.totalOrders}</strong>
                        <small>{metrics.successRate}% success rate</small>
                    </div>
                    <ShoppingBag />
                </div>
                <div className="admin-metric-card">
                    <div>
                        <span>Total Revenue</span>
                        <strong>${metrics.totalRevenue.toFixed(2)}</strong>
                        <small>All time</small>
                    </div>
                    <DollarSign />
                </div>
                <div className="admin-metric-card">
                    <div>
                        <span>Low Stock Alerts</span>
                        <strong>{metrics.lowStockCount}</strong>
                        <small>Items below threshold</small>
                    </div>
                    <AlertTriangle />
                </div>
                <div className="admin-metric-card">
                    <div>
                        <span>Pending Approvals</span>
                        <strong>{metrics.pendingApprovals}</strong>
                        <small>Social posts</small>
                    </div>
                    <ShieldCheck />
                </div>
                <div className="admin-metric-card">
                    <div>
                        <span>System Status</span>
                        <strong>{summary ? 'Online' : '-'}</strong>
                        <small>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : ''}</small>
                    </div>
                    <Calendar />
                </div>
            </section>

            <section className="admin-charts">
                <div className="admin-chart-card">
                    <div className="admin-chart-head">
                        <div>
                        <h3>New Users (Last 7 Days)</h3>
                        <p>Daily registration trend for the past week.</p>
                        </div>
                        <LineChart size={16} />
                    </div>
                    <div className="admin-chart-body">
                        {renderLineChart(weekSeries.counts, '#e11d48', '#3b82f6')}
                        <div className="admin-chart-labels">
                            {weekSeries.labels.map((label) => (
                                <span key={label}>{label}</span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="admin-chart-card">
                    <div className="admin-chart-head">
                        <div>
                            <h3>Order Status (14 days)</h3>
                            <p>Delivered vs cancelled daily trend.</p>
                        </div>
                        <LineChart size={16} />
                    </div>
                    <div className="admin-bar-chart">
                        {statusSeries.map((point, idx) => (
                            <div key={`${point.label}-${idx}`} className="admin-bar-column">
                                <div className="admin-bar-stack">
                                    <div className="admin-bar admin-bar-success" style={{ height: `${point.ok * 6}px` }} />
                                    <div className="admin-bar admin-bar-cancel" style={{ height: `${point.cancel * 6}px` }} />
                                </div>
                                <span>{point.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="admin-chart-card">
                    <div className="admin-chart-head">
                        <div>
                            <h3>Revenue Trend</h3>
                            <p>Daily revenue over last 14 days.</p>
                        </div>
                        <LineChart size={16} />
                    </div>
                    <div className="admin-chart-body">
                        {renderLineChart(revenueSeries.values, '#16a34a', '#0ea5e9')}
                        <div className="admin-chart-labels">
                            {revenueSeries.labels.map((label) => (
                                <span key={label}>{label}</span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="admin-chart-card">
                    <div className="admin-chart-head">
                        <div>
                            <h3>User Activity Heatmap</h3>
                            <p>Orders by day/time block.</p>
                        </div>
                        <Activity size={16} />
                    </div>
                    <div className="admin-heatmap">
                        {heatmap.grid.map((row, rIdx) => (
                            <div key={`row-${rIdx}`} className="admin-heatmap-row">
                                {row.map((value, cIdx) => {
                                    const intensity = value / heatmap.max;
                                    return (
                                        <span
                                            key={`cell-${rIdx}-${cIdx}`}
                                            className="admin-heatmap-cell"
                                            style={{ background: `rgba(225, 29, 46, ${0.12 + intensity * 0.6})` }}
                                            title={`${value} orders`}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="admin-split">
                <div className="admin-panel">
                    <div className="admin-panel-head">
                        <h3>Top Performing Shops</h3>
                        <p>By total items sold.</p>
                    </div>
                    {shopPerf.length === 0 ? (
                        <div className="admin-empty">No sales yet.</div>
                    ) : (
                        <ul className="admin-list">
                            {shopPerf.map((shop) => (
                                <li key={shop.shop}>
                                    <span>{shop.shop}</span>
                                    <strong>{shop.qty} items</strong>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="admin-panel">
                    <div className="admin-panel-head">
                        <h3>Recent Activity</h3>
                        <p>Latest system events.</p>
                    </div>
                    {activityFeed.length === 0 ? (
                        <div className="admin-empty">No recent activity.</div>
                    ) : (
                        <ul className="admin-activity">
                            {activityFeed.map((item, idx) => (
                                <li key={`${item.type}-${idx}`}>
                                    <div>
                                        <strong>{item.label}</strong>
                                        <span>{item.detail}</span>
                                    </div>
                                    <span className="admin-muted">{item.date.toLocaleDateString()}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>
        </div>
    );
};

export default AdminDashboard;
