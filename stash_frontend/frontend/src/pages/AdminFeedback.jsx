import React, { useEffect, useState } from 'react';
import { MessageSquare, RefreshCcw } from 'lucide-react';
import { adminService } from '../services/api';
import '../styles/global.css';
import '../styles/admin.css';

const AdminFeedback = () => {
  const [feedback, setFeedback] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminService.listFeedback(status ? { status } : {});
      setFeedback(res.data || []);
    } catch (err) {
      setError('Failed to load feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id, next) => {
    try {
      const res = await adminService.updateFeedback(id, { status: next });
      setFeedback((prev) => prev.map((f) => (f.id === id ? res.data : f)));
    } catch (err) {
      setError('Failed to update feedback.');
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Reviews & Feedback</h1>
        <span className="admin-badge">
          <MessageSquare size={16} /> Global Feedback
        </span>
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

      <div className="admin-feedback-grid">
        {feedback.map((f) => (
          <div key={f.id} className="admin-feedback-card">
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
            <div className="admin-feedback-actions">
              <button className="admin-action" onClick={() => updateStatus(f.id, 'RESOLVED')}>Resolve</button>
              <button className="admin-action" onClick={() => updateStatus(f.id, 'HIDDEN')}>Hide</button>
              <button className="admin-action" onClick={() => updateStatus(f.id, 'OPEN')}>Reopen</button>
            </div>
          </div>
        ))}
        {feedback.length === 0 && (
          <div className="admin-empty">No feedback found.</div>
        )}
      </div>
    </div>
  );
};

export default AdminFeedback;
