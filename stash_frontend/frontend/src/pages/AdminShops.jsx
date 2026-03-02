import React, { useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import { adminService } from '../services/api';
import '../styles/global.css';
import '../styles/admin.css';

const AdminShops = () => {
  const [shops, setShops] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setError('');
      try {
        const res = await adminService.listShops();
        setShops(res.data || []);
      } catch (err) {
        setError('Failed to load shops.');
      }
    };
    load();
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Admin Shops</h1>
        <span className="admin-badge">
          <Store size={16} /> Shop Owners
        </span>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Location</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => (
              <tr key={s.id}>
                <td>{s.name || '--'}</td>
                <td>{s.email}</td>
                <td>{s.location || '--'}</td>
                <td>{s.is_active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
            {shops.length === 0 && (
              <tr>
                <td colSpan={4}>No shops found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminShops;
