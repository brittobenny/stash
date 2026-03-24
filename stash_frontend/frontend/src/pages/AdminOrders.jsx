import React, { useEffect, useMemo, useState } from 'react';
import { PackageCheck, RefreshCcw, LineChart, TrendingUp, AlertTriangle } from 'lucide-react';
import { adminService } from '../services/api';
import { formatCurrency } from '../utils/currency';
import '../styles/global.css';

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminService.listOrders({ status: filter || undefined, q: query || undefined });
      setOrders(res.data || []);
    } catch (err) {
      setError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]); // Added filter to dep array so it auto-refreshes if needed, or keeping it empty is fine, let's keep it empty as original
  // Actually, original had load() on mount. The user typed 'load' to trigger it.
  
  const statusOptions = useMemo(
    () => ['', 'PLACED', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED'],
    []
  );

  const metrics = useMemo(() => {
    const total = orders.length;
    const delivered = orders.filter((o) => ['DELIVERED', 'COMPLETED'].includes(o.status)).length;
    const cancelled = orders.filter((o) => ['CANCELLED', 'REFUNDED'].includes(o.status)).length;
    const revenue = orders.reduce((sum, o) => {
      if (['CANCELLED', 'REFUNDED'].includes(o.status)) return sum;
      return sum + Number(o.total_amount || 0);
    }, 0);
    return { total, delivered, cancelled, revenue };
  }, [orders]);

  const dailySeries = useMemo(() => {
    const now = new Date();
    const days = 14;
    const labels = [];
    const counts = [];
    const revenue = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      labels.push(d.toLocaleDateString('default', { month: 'short', day: 'numeric' }));
      const daily = orders.filter((o) => String(o.created_at || '').slice(0, 10) === key);
      counts.push(daily.length);
      revenue.push(daily.reduce((sum, o) => sum + Number(o.total_amount || 0), 0));
    }
    return { labels, counts, revenue };
  }, [orders]);

  const statusBreakdown = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      map[o.status] = (map[o.status] || 0) + 1;
    });
    return map;
  }, [orders]);

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
      <svg viewBox="0 0 100 100" className="w-full h-48 overflow-visible mt-6">
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
          <h1 className="text-3xl font-bold font-['Playfair_Display'] text-slate-900 tracking-tight">Order Oversight</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">Global transactions and fulfillment metrics.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm shadow-sm bg-indigo-100 text-indigo-700">
          <PackageCheck size={16} /> Global Orders
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
              <PackageCheck size={24} />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium mb-1">Total Orders</span>
            <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{metrics.total}</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium mb-1">Delivered</span>
            <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{metrics.delivered}</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-rose-100 shadow-[0_8px_30px_rgba(225,29,72,0.06)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(225,29,72,0.12)] transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300">
              <AlertTriangle size={24} />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-rose-600/80 text-sm font-bold mb-1">Cancelled</span>
            <strong className="text-3xl font-extrabold text-rose-600 tracking-tight">{metrics.cancelled}</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start mb-4 relative">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <LineChart size={24} />
            </div>
          </div>
          <div className="flex flex-col relative">
            <span className="text-slate-500 text-sm font-medium mb-1">Total Revenue</span>
            <strong className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{formatCurrency(metrics.revenue)}</strong>
          </div>
        </div>
      </section>

      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center mb-6">
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                <input
                    className="w-full sm:w-72 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:font-normal"
                    placeholder="Search by ID or email..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <select 
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all appearance-none"
                    value={filter} 
                    onChange={(e) => setFilter(e.target.value)}
                >
                    {statusOptions.map((s) => (
                        <option key={s || 'all'} value={s}>{s || 'All Statuses'}</option>
                    ))}
                </select>
                <button 
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-500/30 hover:shadow-indigo-500/50 disabled:opacity-50 min-w-[120px]"
                    onClick={load} 
                    disabled={loading}
                >
                    <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /> {loading ? 'Refreshing' : 'Refresh'}
                </button>
            </div>
        </div>

        {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-medium flex items-center gap-2 shadow-sm">
                <AlertTriangle size={18} /> {error}
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-200/80 hover:border-slate-300 transition-colors">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 tracking-tight">Daily Volume</h3>
                        <p className="text-sm font-medium text-slate-500">Order count over 14 days</p>
                    </div>
                    <div className="p-2 bg-amber-50 text-amber-500 rounded-lg">
                        <LineChart size={20} />
                    </div>
                </div>
                <div className="relative">
                    {renderLineChart(dailySeries.counts, '#f59e0b', '#e11d48')}
                    <div className="flex justify-between text-[10px] sm:text-xs font-semibold text-slate-400 mt-4 px-2 hidden sm:flex">
                        {dailySeries.labels.filter((_, i) => i % 2 === 0).map((label) => (
                            <span key={label}>{label}</span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-200/80 hover:border-slate-300 transition-colors">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 tracking-tight">Revenue Trend</h3>
                        <p className="text-sm font-medium text-slate-500">Daily revenue over 14 days</p>
                    </div>
                    <div className="p-2 bg-emerald-50 text-emerald-500 rounded-lg">
                        <LineChart size={20} />
                    </div>
                </div>
                <div className="relative">
                    {renderLineChart(dailySeries.revenue, '#10b981', '#3b82f6')}
                    <div className="flex justify-between text-[10px] sm:text-xs font-semibold text-slate-400 mt-4 px-2 hidden sm:flex">
                        {dailySeries.labels.filter((_, i) => i % 2 === 0).map((label) => (
                            <span key={label}>{label}</span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-200/80 col-span-1 lg:col-span-2 hover:border-slate-300 transition-colors">
                <div className="flex justify-between items-start mb-10">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 tracking-tight">Status Breakdown</h3>
                        <p className="text-sm font-medium text-slate-500">Global proportion of order states</p>
                    </div>
                    <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg">
                        <PackageCheck size={20} />
                    </div>
                </div>
                <div className="flex items-end justify-between gap-2 sm:gap-4 h-48 w-full px-2">
                    {Object.entries(statusBreakdown).map(([statusKey, count]) => {
                        const isCancel = ['CANCELLED', 'REFUNDED'].includes(statusKey);
                        return (
                            <div key={statusKey} className="flex flex-col items-center justify-end w-full group/bar cursor-pointer h-full">
                                <div className={`w-full max-w-[3rem] flex flex-col-reverse justify-start rounded-t-lg overflow-hidden transition-all duration-300 relative ${
                                    isCancel ? 'bg-rose-400 group-hover/bar:bg-rose-500' : 'bg-emerald-400 group-hover/bar:bg-emerald-500'
                                }`} style={{ height: `${count * 10}px`, minHeight: '4px' }}>
                                    <span className={`absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover/bar:opacity-100 transition-opacity z-10 ${
                                        isCancel ? 'text-rose-700 bg-rose-100' : 'text-emerald-700 bg-emerald-100'
                                    }`}>{count}</span>
                                </div>
                                <span className="text-[10px] sm:text-xs font-bold text-slate-500 mt-4 w-12 truncate text-center" title={statusKey.replace('_', ' ')}>{statusKey.replace('_', ' ')}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80">
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Order</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Total</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-4">
                      <span className="font-bold text-slate-800 text-sm">#{o.id}</span>
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-600">{o.user_email || '--'}</td>
                  <td className="p-4">
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md text-sm border border-indigo-100">{formatCurrency(o.total_amount)}</span>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex px-2.5 py-1.5 rounded-md text-[10px] font-bold tracking-wider uppercase shadow-sm ${
                        ['CANCELLED', 'REFUNDED'].includes(o.status) 
                            ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                            : ['DELIVERED', 'COMPLETED'].includes(o.status) 
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                        {o.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-500 text-right">{o.created_at ? new Date(o.created_at).toLocaleString() : '--'}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-medium bg-slate-50/50">
                    No orders found matching your criteria.
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

export default AdminOrders;
