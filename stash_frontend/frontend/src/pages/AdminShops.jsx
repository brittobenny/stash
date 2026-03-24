import React, { useEffect, useState } from 'react';
import { Store, Plus, Pencil } from 'lucide-react';
import { adminService } from '../services/api';
import '../styles/global.css';
import '../styles/admin.css';

const AdminShops = () => {
  const [shops, setShops] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', mobile_number: '', location: '', address: '', store_name: '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [editingShop, setEditingShop] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', mobile_number: '', location: '', address: '', store_name: '' });
  const [updating, setUpdating] = useState(false);

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

  const openEdit = (shop) => {
    setEditingShop(shop);
    setEditForm({
      name: shop?.name || '',
      email: shop?.email || '',
      mobile_number: shop?.mobile_number || '',
      location: shop?.location || '',
      address: shop?.address || '',
      store_name: shop?.store_name || '',
    });
  };

  const closeEdit = () => {
    setEditingShop(null);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingShop) return;
    setUpdating(true);
    setError('');
    setSuccess('');
    try {
      await adminService.updateUser(editingShop.id, editForm);
      setSuccess('Shop updated successfully.');
      closeEdit();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update shop.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 sm:p-8 lg:p-10 font-sans text-slate-800">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Playfair_Display'] text-slate-900 tracking-tight">Shop Management</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">Register new vendors and oversee shop operations.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm shadow-sm bg-indigo-100 text-indigo-700">
          <Store size={16} /> Shop Owners
        </div>
      </header>

      {error && (
        <div className="mb-8 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-medium flex items-center gap-2 shadow-sm">
          <Store size={20} /> {error}
        </div>
      )}
      {success && (
        <div className="mb-8 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 font-medium flex items-center gap-2 shadow-sm">
          <Store size={20} /> {success}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1">
          <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sticky top-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Plus size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Create Shop</h3>
            </div>
            
            <form className="flex flex-col gap-4" onSubmit={handleCreate}>
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Owner Name</label>
                  <input
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:font-normal"
                    placeholder="e.g. Jane Doe"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
              </div>

              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                  <input
                    type="email"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:font-normal"
                    placeholder="jane@example.com"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
              </div>

              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
                  <input
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:font-normal"
                    type="password"
                    placeholder="Temporary password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    required
                  />
              </div>

              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mobile Number</label>
                  <input
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:font-normal"
                    placeholder="e.g. +1 234 567 8900"
                    value={form.mobile_number}
                    onChange={(e) => setForm((prev) => ({ ...prev, mobile_number: e.target.value }))}
                  />
              </div>

              <div className="pt-4 border-t border-slate-100 mt-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Store Details</label>
                  <input
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:font-normal mb-4"
                    placeholder="Store Name"
                    value={form.store_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, store_name: e.target.value }))}
                    required
                  />
                  <input
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:font-normal mb-4"
                    placeholder="Region/Location"
                    value={form.location}
                    onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                  />
                  <input
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:font-normal"
                    placeholder="Full Address"
                    value={form.address}
                    onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  />
              </div>

              <button 
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-500/30 hover:shadow-indigo-500/50 disabled:opacity-50" 
                type="submit" 
                disabled={saving}
              >
                {saving ? <Plus size={18} className="animate-spin" /> : <Plus size={18} />} 
                {saving ? 'Creating Account...' : 'Register Shop Owner'}
              </button>
            </form>
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden h-full flex flex-col">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Registered Shops</h3>
            
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80">
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Owner Name</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Store Name</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Location</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Status</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {shops.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-4">
                        <span className="font-bold text-slate-800 text-sm">{s.name || '--'}</span>
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-600">{s.email}</td>
                      <td className="p-4">
                        <span className="font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg text-xs border border-indigo-100 inline-block truncate max-w-[150px]">
                            {s.store_name || '--'}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-500 truncate max-w-[120px]" title={s.location}>{s.location || '--'}</td>
                      <td className="p-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            s.is_active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {shops.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-500 font-medium bg-slate-50/50">
                        <div className="flex flex-col items-center justify-center opacity-70">
                            <Store size={32} className="mb-3 text-slate-400" />
                            <span>No shops found. Register the first one!</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {editingShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-xl shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Edit Shop</h3>
                <p className="text-sm text-slate-500">Update shop owner and store details.</p>
              </div>
              <button onClick={closeEdit} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>

            <form className="grid grid-cols-1 sm:grid-cols-2 gap-4" onSubmit={handleUpdate}>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Owner Name</label>
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mobile Number</label>
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={editForm.mobile_number}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, mobile_number: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Store Name</label>
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={editForm.store_name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, store_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location</label>
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={editForm.location}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, location: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Address</label>
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={editForm.address}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-md shadow-indigo-500/30 hover:bg-indigo-700 disabled:opacity-60"
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminShops;
