import React, { useEffect, useMemo, useState } from 'react';
import { Users, ShieldCheck, UserX, Search, Download, Eye, ChefHat, Flame, Utensils } from 'lucide-react';
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

  const cookStats = useMemo(() => {
    const totalCooks = users.reduce((sum, u) => sum + (u.cooked_count || 0), 0);
    const usersWhoCooked = users.filter((u) => (u.cooked_count || 0) > 0).length;
    return { totalCooks, usersWhoCooked };
  }, [users]);

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
    <div className="min-h-screen bg-slate-50/50 p-6 sm:p-8 lg:p-10 font-sans text-slate-800">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Playfair_Display'] text-slate-900 tracking-tight">User Management</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">Control access, view history, and monitor platform engagement.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm shadow-sm bg-indigo-100 text-indigo-700">
          <Users size={16} /> All Accounts
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 shrink-0">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
              <Users size={24} />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium mb-1">Total Verified Users</span>
            <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{users.length}</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-rose-50 text-rose-500 rounded-xl group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300">
              <Flame size={24} />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium mb-1">Active Cooks</span>
            <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{cookStats.usersWhoCooked}</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
              <Utensils size={24} />
            </div>
          </div>
          <div className="flex flex-col relative z-10">
            <span className="text-slate-500 text-sm font-medium mb-1">Total Recipes Cooked</span>
            <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{cookStats.totalCooks}</strong>
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-8 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-medium flex items-center gap-2 shadow-sm">
          <UserX size={20} /> {error}
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center mb-6">
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                <div className="relative w-full sm:w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:font-normal"
                        placeholder="Search name or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select 
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all appearance-none"
                    value={roleFilter} 
                    onChange={(e) => setRoleFilter(e.target.value)}
                >
                    <option value="All">All Roles</option>
                    <option value="customer">Customer</option>
                    <option value="shopowner">Shop Owner</option>
                </select>
                <select 
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all appearance-none"
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="All">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                </select>
            </div>
            
            <div className="flex gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                <button 
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm shrink-0 whitespace-nowrap"
                    onClick={exportCsv}
                >
                    <Download size={16} /> Export CSV
                </button>
                {selectedIds.length > 0 && (
                <>
                    <button 
                        className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-100 transition-colors shadow-sm shrink-0 whitespace-nowrap"
                        onClick={() => bulkUpdate({ is_active: false })}
                    >
                        <UserX size={16} /> Deactivate ({selectedIds.length})
                    </button>
                    <button 
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors shadow-sm shrink-0 whitespace-nowrap"
                        onClick={() => bulkUpdate({ is_active: true })}
                    >
                        <ShieldCheck size={16} /> Activate ({selectedIds.length})
                    </button>
                </>
                )}
            </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80">
                <th className="p-4 w-12 text-center text-slate-400">
                </th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Name</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Email</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Location</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Cooks</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Last Active</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-4 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                      checked={selectedIds.includes(u.id)}
                      onChange={() => toggleSelect(u.id)}
                    />
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-slate-800 text-sm">{u.name || '--'}</span>
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-600">{u.email}</td>
                  <td className="p-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide ${
                        u.role === 'customer' ? 'bg-sky-50 text-sky-600 border border-sky-100' : 'bg-violet-50 text-violet-600 border border-violet-100'
                    }`}>
                        {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-500">{u.location || '--'}</td>
                  <td className="p-4 text-sm font-bold text-slate-700">{u.cooked_count > 0 ? `${u.cooked_count} Recipes` : '--'}</td>
                  <td className="p-4 text-sm font-medium text-slate-500">{u.last_login ? new Date(u.last_login).toLocaleDateString() : '--'}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        u.is_active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1 sm:gap-2 opacity-50 xl:opacity-100 group-hover:opacity-100 transition-opacity">
                      <button 
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100" 
                        onClick={() => openDetails(u)}
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        className={`p-2 rounded-lg transition-colors border border-transparent ${u.is_active ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-100'}`}
                        onClick={() => handleUpdate(u.id, { is_active: !u.is_active })}
                        disabled={saving === u.id}
                        title={u.is_active ? 'Deactivate User' : 'Activate User'}
                      >
                        {u.is_active ? <UserX size={18} /> : <ShieldCheck size={18} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 font-medium bg-slate-50/50">
                    No users found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailUser && (
        <div className="fixed inset-0 flex items-center justify-center z-[200] p-4 bg-black/40 backdrop-blur-sm transition-all duration-300">
          <div className="w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl uppercase shadow-inner">
                    {detailUser.name ? detailUser.name.charAt(0) : detailUser.email.charAt(0)}
                </div>
                <div>
                    <h3 className="text-xl font-bold font-['Playfair_Display'] text-slate-900">{detailUser.name || 'User Profile'}</h3>
                    <p className="text-slate-500 text-sm font-medium">{detailUser.email}</p>
                </div>
              </div>
              <button className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors" onClick={() => setDetailUser(null)}>
                  <UserX size={20} className="stroke-[1.5]" />
              </button>
            </div>
            
            <div className="overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 sm:grid-cols-2 gap-8 pb-4">
              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Profile Information</h4>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Role</span>
                        <span className="font-bold text-slate-800 capitalize">{detailUser.role}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Phone</span>
                        <span className="font-bold text-slate-800">{detailUser.mobile_number || '--'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Location</span>
                        <span className="font-bold text-slate-800">{detailUser.location || '--'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Address</span>
                        <span className="font-bold text-slate-800 text-right max-w-[150px] truncate">{detailUser.address || '--'}</span>
                    </div>
                </div>

                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-2 mb-1">Activity Log</h4>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Joined</span>
                        <span className="font-bold text-slate-800">{detailUser.date_joined ? new Date(detailUser.date_joined).toLocaleDateString() : '--'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Last Login</span>
                        <span className="font-bold text-slate-800">{detailUser.last_login ? new Date(detailUser.last_login).toLocaleString() : '--'}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-slate-200/60 pt-3 mt-1">
                        <span className="text-slate-600 font-bold flex items-center gap-1.5"><Utensils size={14}/> Total Cooked</span>
                        <span className="font-bold text-indigo-700">{detailUser.cooked_count || 0}</span>
                    </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Order History</h4>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-3 h-full">
                    {detailLoading ? (
                    <div className="flex justify-center items-center h-full p-4">
                        <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    </div>
                    ) : detailOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center h-full opacity-50">
                        <ShoppingBag size={32} className="text-slate-400 mb-2" />
                        <p className="text-sm font-medium text-slate-500">No orders found.</p>
                    </div>
                    ) : (
                    <ul className="flex flex-col gap-3 overflow-y-auto max-h-[220px] custom-scrollbar pr-1">
                        {detailOrders.map((o) => (
                        <li key={o.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                            <span className="text-sm font-bold text-slate-700">Order #{o.id}</span>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide ${
                                ['DELIVERED', 'COMPLETED'].includes(o.status) ? 'bg-emerald-50 text-emerald-600' : 
                                ['CANCELLED', 'REFUNDED'].includes(o.status) ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
                            }`}>{o.status}</span>
                        </li>
                        ))}
                    </ul>
                    )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-slate-100 shrink-0 mt-4">
                <button className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors" onClick={() => setDetailUser(null)}>
                    Close Profile
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
