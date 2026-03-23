import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, RefreshCcw, Star, PackageCheck, AlertTriangle } from 'lucide-react';
import { adminService } from '../services/api';
import '../styles/global.css';
import '../styles/admin.css';

const AdminFeedback = () => {
  const [feedback, setFeedback] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminService.listFeedback(status ? { status } : {});
      setFeedback(res.data || []);
      if (!selected && res.data?.length) {
        handleSelect(res.data[0]);
      }
    } catch (err) {
      setError('Failed to load feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = feedback.length;
    const avg = total ? (feedback.reduce((sum, f) => sum + Number(f.rating || 0), 0) / total).toFixed(1) : 0;
    const open = feedback.filter((f) => f.status === 'OPEN').length;
    const resolved = feedback.filter((f) => f.status === 'RESOLVED').length;
    return { total, avg, open, resolved };
  }, [feedback]);

  const handleSelect = async (item) => {
    setSelected(item);
    setOrderDetail(null);
    if (!item?.order) return;
    setDetailLoading(true);
    try {
      const res = await adminService.getOrderDetail(item.order);
      setOrderDetail(res.data || null);
    } catch {
      setOrderDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Admin view-only for feedback

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Reviews & Feedback</h1>
        <span className="admin-badge">
          <MessageSquare size={16} /> Global Feedback
        </span>
      </div>

      <div className="admin-metrics">
        <div className="admin-metric-card">
          <div>
            <span>Total feedback</span>
            <strong>{stats.total}</strong>
          </div>
          <MessageSquare />
        </div>
        <div className="admin-metric-card">
          <div>
            <span>Average rating</span>
            <strong>{stats.avg}</strong>
          </div>
          <Star />
        </div>
        <div className="admin-metric-card">
          <div>
            <span>Open tickets</span>
            <strong>{stats.open}</strong>
          </div>
          <AlertTriangle />
        </div>
        <div className="admin-metric-card">
          <div>
            <span>Resolved</span>
            <strong>{stats.resolved}</strong>
          </div>
          <PackageCheck />
        </div>
      </div>

      <div className="admin-filters">
        <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
          <option value="HIDDEN">Hidden</option>
        </select>
        <button className="admin-action" onClick={load} disabled={loading}>
          <RefreshCcw size={14} /> {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-split">
        <div className="admin-panel">
          {feedback.length === 0 ? (
            <div className="admin-empty">No feedback found.</div>
          ) : (
            <div className="admin-feedback-grid">
              {feedback.map((f) => (
                <button
                  key={f.id}
                  className={`admin-feedback-card ${selected?.id === f.id ? 'admin-feedback-card-active' : ''}`}
                  onClick={() => handleSelect(f)}
                >
                  <div className="admin-feedback-head">
                    <div>
                      <strong>{f.user_name || 'User'}</strong>
                      <div className="admin-muted">{f.user_email}</div>
                    </div>
                    <span className={`admin-status ${f.status === 'OPEN' ? 'admin-status-warn' : 'admin-status-ok'}`}>
                      {f.status}
                    </span>
                  </div>
                  <div className="admin-feedback-rating">Rating: {f.rating}/5</div>
                  {f.title && <div className="admin-feedback-title">{f.title}</div>}
                  <p className="admin-feedback-message">{f.message}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="admin-panel">
          {!selected ? (
            <div className="admin-empty">Select feedback to view details.</div>
          ) : (
            <>
              <div className="admin-feedback-head">
                <div>
                  <strong>{selected.user_name || 'User'}</strong>
                  <div className="admin-muted">{selected.user_email}</div>
                </div>
                <span className={`admin-status ${selected.status === 'OPEN' ? 'admin-status-warn' : 'admin-status-ok'}`}>
                  {selected.status}
                </span>
              </div>
              <div className="admin-feedback-rating">Rating: {selected.rating}/5</div>
              {selected.title && <div className="admin-feedback-title">{selected.title}</div>}
              <p className="admin-feedback-message">{selected.message}</p>
              <div className="admin-section">
                <h4>Order details</h4>
                {detailLoading ? (
                  <div className="admin-muted">Loading order...</div>
                ) : orderDetail ? (
                  <div className="admin-order-detail">
                    <div>Status: {orderDetail.status}</div>
                    <div>Total: ${orderDetail.total_amount}</div>
                    <div>Address: {orderDetail.user_address || '--'}</div>
                    <div>Phone: {orderDetail.user_phone || '--'}</div>
                    <div className="admin-order-items">
                      {(orderDetail.items || []).map((item) => (
                        <div key={item.id} className="admin-order-item">
                          <span>{item.product?.name}</span>
                          <span>x{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="admin-muted">No order details available.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminFeedback;
