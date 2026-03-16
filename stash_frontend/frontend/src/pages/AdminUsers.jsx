import React, { useEffect, useState } from 'react';
import { Users, ShieldCheck, UserX } from 'lucide-react';
import { adminService } from '../services/api';
import '../styles/global.css';
import '../styles/admin.css';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    const load = async () => {
      setError('');
      try {
        const res = await adminService.listUsers();
        setUsers(res.data || []);
      } catch (err) {
        setError('Failed to load users.');
      }
    };
    load();
  }, []);

  const handleUpdate = async (userId, payload) => {
    setSaving(userId);
    try {
      const res = await adminService.updateUser(userId, payload);
      setUsers((prev) => prev.map((u) => (u.id === userId ? res.data : u)));
    } catch (err) {
      setError('Failed to update user.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Admin Users</h1>
        <span className="admin-badge">
          <Users size={16} /> All Accounts
        </span>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Location</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name || '--'}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    className="admin-select"
                    value={u.role}
                    onChange={(e) => handleUpdate(u.id, { role: e.target.value })}
                    disabled={saving === u.id}
                  >
                    <option value="customer">customer</option>
                    <option value="shopowner">shopowner</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>{u.location || '--'}</td>
                <td>
                  <span className={u.is_active ? 'admin-status admin-status-ok' : 'admin-status admin-status-bad'}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button
                    className="admin-action"
                    onClick={() => handleUpdate(u.id, { is_active: !u.is_active })}
                    disabled={saving === u.id}
                  >
                    {u.is_active ? <UserX size={14} /> : <ShieldCheck size={14} />}
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6}>No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
