import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { adminService } from '../services/api';
import '../styles/global.css';
import '../styles/admin.css';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

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
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name || '--'}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.location || '--'}</td>
                <td>{u.is_active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5}>No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
