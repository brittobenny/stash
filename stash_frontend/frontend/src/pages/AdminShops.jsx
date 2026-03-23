import React, { useEffect, useState } from 'react';
import { Store, Plus } from 'lucide-react';
import { adminService } from '../services/api';
import '../styles/global.css';
import '../styles/admin.css';

const AdminShops = () => {
  const [shops, setShops] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', mobile_number: '', location: '', address: '', store_name: '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setError('');
    try {
      const res = await adminService.listShops();
      setShops(res.data || []);
    } catch (err) {
      setError('Failed to load shops.');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await adminService.createShopOwner(form);
      setSuccess('Shop owner created successfully.');
      setForm({ name: '', email: '', password: '', mobile_number: '', location: '', address: '', store_name: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create shop owner.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Admin Shops</h1>
        <span className="admin-badge">
          <Store size={16} /> Shop Owners
        </span>
      </div>

      {error && <div className="admin-error">{error}</div>}
      {success && <div className="admin-success">{success}</div>}

      <div className="admin-panel">
        <h3>Create new shop owner</h3>
        <form className="admin-form" onSubmit={handleCreate}>
          <input
            className="admin-input"
            placeholder="Owner name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            className="admin-input"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
          <input
            className="admin-input"
            type="password"
            placeholder="Temporary password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          />
          <input
            className="admin-input"
            placeholder="Mobile number"
            value={form.mobile_number}
            onChange={(e) => setForm((prev) => ({ ...prev, mobile_number: e.target.value }))}
          />
          <input
            className="admin-input"
            placeholder="Store name"
            value={form.store_name}
            onChange={(e) => setForm((prev) => ({ ...prev, store_name: e.target.value }))}
          />
          <input
            className="admin-input"
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
          />
          <input
            className="admin-input"
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
          />
          <button className="admin-btn" type="submit" disabled={saving}>
            <Plus size={14} /> {saving ? 'Creating...' : 'Create Shop'}
          </button>
        </form>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Store</th>
              <th>Location</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => (
              <tr key={s.id}>
                <td>{s.name || '--'}</td>
                <td>{s.email}</td>
                <td>{s.store_name || '--'}</td>
                <td>{s.location || '--'}</td>
                <td>{s.is_active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
            {shops.length === 0 && (
              <tr>
                <td colSpan={5}>No shops found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminShops;
