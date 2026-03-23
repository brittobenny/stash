import React, { useEffect, useMemo, useState } from 'react';
import { Users, ShieldCheck, UserX, Search, Download, Eye } from 'lucide-react';
import { adminService } from '../services/api';
import '../styles/global.css';
import '../styles/admin.css';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailUser, setDetailUser] = useState(null);
  const [detailOrders, setDetailOrders] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

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

  const filteredUsers = useMemo(() => {
    const term = search.toLowerCase().trim();
    return users.filter((u) => {
      if (u.role === 'admin') return false;
      const matchesSearch = !term || `${u.name} ${u.email}`.toLowerCase().includes(term);
      const matchesRole = roleFilter === 'All' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' ? u.is_active : !u.is_active);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const toggleSelect = (userId) => {
    setSelectedIds((prev) => (
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    ));
  };

  const bulkUpdate = async (payload) => {
    for (const id of selectedIds) {
      await handleUpdate(id, payload);
    }
    setSelectedIds([]);
  };

  const exportCsv = () => {
    const rows = [
      ['ID', 'Name', 'Email', 'Role', 'Phone', 'Location', 'Status', 'Date Joined', 'Last Login'].join(','),
      ...filteredUsers.map((u) => [
        u.id,
        `"${u.name || ''}"`,
        `"${u.email || ''}"`,
        u.role,
        `"${u.mobile_number || ''}"`,
        `"${u.location || ''}"`,
        u.is_active ? 'Active' : 'Inactive',
        u.date_joined || '',
        u.last_login || '',
      ].join(',')),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'stash_users.csv';
    link.click();
  };

  const openDetails = async (user) => {
    setDetailUser(user);
    setDetailOrders([]);
    setDetailLoading(true);
    try {
      const res = await adminService.listOrders({ q: user.email });
      setDetailOrders(res.data || []);
    } catch (err) {
      setDetailOrders([]);
    } finally {
      setDetailLoading(false);
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

      <div className="admin-filters">
        <div className="admin-input admin-input-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="admin-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="All">All roles</option>
          <option value="customer">Customer</option>
          <option value="shopowner">Shop Owner</option>
        </select>
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="All">All status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <button className="admin-btn" onClick={exportCsv}>
          <Download size={14} /> Export CSV
        </button>
        {selectedIds.length > 0 && (
          <>
            <button className="admin-btn" onClick={() => bulkUpdate({ is_active: false })}>
              Deactivate selected
            </button>
            <button className="admin-btn" onClick={() => bulkUpdate({ is_active: true })}>
              Activate selected
            </button>
          </>
        )}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Location</th>
              <th>Last Active</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(u.id)}
                    onChange={() => toggleSelect(u.id)}
                  />
                </td>
                <td>{u.name || '--'}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.location || '--'}</td>
                <td>{u.last_login ? new Date(u.last_login).toLocaleDateString() : '--'}</td>
                <td>
                  <span className={u.is_active ? 'admin-status admin-status-ok' : 'admin-status admin-status-bad'}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="admin-actions">
                    <button className="admin-btn" onClick={() => openDetails(u)}>
                      <Eye size={14} /> View
                    </button>
                    <button
                      className="admin-action"
                      onClick={() => handleUpdate(u.id, { is_active: !u.is_active })}
                      disabled={saving === u.id}
                    >
                      {u.is_active ? <UserX size={14} /> : <ShieldCheck size={14} />}
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={8}>No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detailUser && (
        <div className="admin-modal">
          <div className="admin-modal-card">
            <div className="admin-modal-head">
              <div>
                <h3>{detailUser.name || 'User details'}</h3>
                <p>{detailUser.email}</p>
              </div>
              <button className="admin-btn" onClick={() => setDetailUser(null)}>Close</button>
            </div>
            <div className="admin-modal-grid">
              <div>
                <h4>Profile</h4>
                <p>Role: {detailUser.role}</p>
                <p>Phone: {detailUser.mobile_number || '--'}</p>
                <p>Location: {detailUser.location || '--'}</p>
                <p>Address: {detailUser.address || '--'}</p>
                <p>Joined: {detailUser.date_joined ? new Date(detailUser.date_joined).toLocaleDateString() : '--'}</p>
                <p>Last login: {detailUser.last_login ? new Date(detailUser.last_login).toLocaleString() : '--'}</p>
              </div>
              <div>
                <h4>Order history</h4>
                {detailLoading ? (
                  <p className="admin-muted">Loading orders...</p>
                ) : detailOrders.length === 0 ? (
                  <p className="admin-muted">No orders found.</p>
                ) : (
                  <ul className="admin-list">
                    {detailOrders.slice(0, 5).map((o) => (
                      <li key={o.id}>
                        <span>Order #{o.id}</span>
                        <strong>{o.status}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="admin-muted">Pantry items and login history require backend support.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
