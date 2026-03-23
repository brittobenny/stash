import React, { useEffect, useMemo, useState } from 'react';
import { PackageCheck, RefreshCcw, LineChart, TrendingUp, AlertTriangle } from 'lucide-react';
import { adminService } from '../services/api';
import { formatCurrency } from '../utils/currency';
import '../styles/global.css';
import '../styles/admin.css';

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
  }, []);

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

  const renderLineChart = (values = [], color = '#e11d48', accent = '#3b82f6') => {
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
          <linearGradient id="orderLine" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={accent} />
          </linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="url(#orderLine)" strokeWidth="3" />
        <polyline points={smoothPoints} fill="none" stroke={accent} strokeWidth="2" strokeDasharray="4 4" />
        <polyline points={`0,100 100,100`} fill="none" stroke="rgba(15,23,42,0.1)" strokeWidth="2" />
      </svg>
    );
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Order Oversight</h1>
        <span className="admin-badge">
          <PackageCheck size={16} /> Global Orders
        </span>
      </div>

      <div className="admin-metrics">
        <div className="admin-metric-card">
          <div>
            <span>Total orders</span>
            <strong>{metrics.total}</strong>
          </div>
          <PackageCheck />
        </div>
        <div className="admin-metric-card">
          <div>
            <span>Delivered</span>
            <strong>{metrics.delivered}</strong>
          </div>
          <TrendingUp />
        </div>
        <div className="admin-metric-card">
          <div>
            <span>Cancelled</span>
            <strong>{metrics.cancelled}</strong>
          </div>
          <AlertTriangle />
        </div>
        <div className="admin-metric-card">
          <div>
            <span>Revenue</span>
            <strong>{formatCurrency(metrics.revenue)}</strong>
          </div>
          <LineChart />
        </div>
      </div>

      <div className="admin-filters">
        <input
          className="admin-input"
          placeholder="Search order id or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="admin-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {statusOptions.map((s) => (
            <option key={s || 'all'} value={s}>{s || 'All Status'}</option>
          ))}
        </select>
        <button className="admin-action" onClick={load} disabled={loading}>
          <RefreshCcw size={14} /> {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-charts">
        <div className="admin-chart-card">
          <div className="admin-chart-head">
            <div>
              <h3>Daily order volume</h3>
              <p>Last 14 days order count.</p>
            </div>
            <LineChart size={16} />
          </div>
          <div className="admin-chart-body">
            {renderLineChart(dailySeries.counts, '#f59e0b', '#e11d48')}
            <div className="admin-chart-labels">
              {dailySeries.labels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="admin-chart-card">
          <div className="admin-chart-head">
            <div>
              <h3>Revenue trend</h3>
              <p>Daily revenue last 14 days.</p>
            </div>
            <LineChart size={16} />
          </div>
          <div className="admin-chart-body">
            {renderLineChart(dailySeries.revenue, '#16a34a', '#3b82f6')}
            <div className="admin-chart-labels">
              {dailySeries.labels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="admin-chart-card">
          <div className="admin-chart-head">
            <div>
              <h3>Status breakdown</h3>
              <p>Share of order statuses.</p>
            </div>
            <PackageCheck size={16} />
          </div>
          <div className="admin-bar-chart">
            {Object.entries(statusBreakdown).map(([statusKey, count]) => (
              <div key={statusKey} className="admin-bar-column">
                <div className="admin-bar-stack">
                  <div
                    className={`admin-bar ${['CANCELLED', 'REFUNDED'].includes(statusKey) ? 'admin-bar-cancel' : 'admin-bar-success'}`}
                    style={{ height: `${count * 6}px` }}
                  />
                </div>
                <span>{statusKey.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>#{o.id}</td>
                <td>{o.user_email || '--'}</td>
                <td>{formatCurrency(o.total_amount)}</td>
                <td>
                  <span className={`admin-status ${o.status === 'CANCELLED' || o.status === 'REFUNDED' ? 'admin-status-bad' : 'admin-status-ok'}`}>
                    {o.status}
                  </span>
                </td>
                <td>{o.created_at ? new Date(o.created_at).toLocaleString() : '--'}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5}>No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminOrders;
