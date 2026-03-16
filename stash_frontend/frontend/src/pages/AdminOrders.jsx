import React, { useEffect, useMemo, useState } from 'react';
import { PackageCheck, RefreshCcw } from 'lucide-react';
import { adminService } from '../services/api';
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

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Order Oversight</h1>
        <span className="admin-badge">
          <PackageCheck size={16} /> Global Orders
        </span>
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
                <td>${Number(o.total_amount || 0).toFixed(2)}</td>
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
