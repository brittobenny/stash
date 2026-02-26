import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, UploadCloud } from 'lucide-react';
import { shopOwnerService, pantryService } from '../services/api';
import '../styles/global.css';

const defaultForm = {
    name: '',
    category: '',
    price: '',
    stock_quantity: '',
    low_stock_threshold: 10,
    unit: 'pcs',
    ingredient_id: '',
    pack_size: '',
    pack_unit: 'pcs',
    is_active: true,
};

const ShopOwnerProducts = () => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [ingredients, setIngredients] = useState([]);
    const [form, setForm] = useState(defaultForm);
    const [editingId, setEditingId] = useState(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryImage, setNewCategoryImage] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [prodRes, catRes, ingRes] = await Promise.all([
                shopOwnerService.getMyProducts(),
                shopOwnerService.listCategories(),
                pantryService.listIngredients(),
            ]);
            setProducts(prodRes.data || []);
            setCategories(catRes.data || []);
            setIngredients(ingRes.data || []);
        } catch (err) {
            console.error('Shop owner data fetch failed', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) return;
        const res = await shopOwnerService.createCategory(newCategoryName.trim(), newCategoryImage);
        setCategories((prev) => [...prev, res.data]);
        setForm((prev) => ({ ...prev, category: res.data.id }));
        setNewCategoryName('');
        setNewCategoryImage(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await shopOwnerService.updateProduct(editingId, form);
            } else {
                await shopOwnerService.addProduct(form);
            }
            setForm(defaultForm);
            setEditingId(null);
            await loadAll();
        } catch (err) {
            alert('Failed to save product.');
        }
    };

    const handleEdit = (product) => {
        setEditingId(product.id);
        setForm({
            name: product.name || '',
            category: product.category || '',
            price: product.price || '',
            stock_quantity: product.stock_quantity ?? '',
            low_stock_threshold: product.low_stock_threshold ?? 10,
            unit: product.unit || 'pcs',
            ingredient_id: product.ingredient_id || '',
            pack_size: product.pack_size || '',
            pack_unit: product.pack_unit || 'pcs',
            is_active: product.is_active ?? true,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this product?')) return;
        await shopOwnerService.deleteProduct(id);
        loadAll();
    };

    return (
        <div style={styles.page}>
            <section style={styles.header}>
                <div>
                    <h1 style={styles.title}>Products</h1>
                    <p style={styles.subtitle}>Manage your inventory, pricing, and pantry mapping.</p>
                </div>
                <button style={styles.ghostBtn} onClick={loadAll} disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </section>

            <section style={styles.formCard}>
                <div style={styles.formHeader}>
                    <h3>{editingId ? 'Edit Product' : 'Add New Product'}</h3>
                    <span style={styles.formBadge}>
                        <UploadCloud size={14} /> Pantry mapping enabled
                    </span>
                </div>
                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.formGrid}>
                        <div style={styles.formGroup}>
                            <label>Product Name</label>
                            <input
                                style={styles.input}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                required
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label>Category</label>
                            <select
                                style={styles.input}
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                required
                            >
                                <option value="">Select category</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label>Price</label>
                            <input
                                type="number"
                                step="0.01"
                                style={styles.input}
                                value={form.price}
                                onChange={(e) => setForm({ ...form, price: e.target.value })}
                                required
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label>Stock Quantity</label>
                            <input
                                type="number"
                                style={styles.input}
                                value={form.stock_quantity}
                                onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                                required
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label>Low Stock Alert Threshold</label>
                            <input
                                type="number"
                                style={styles.input}
                                min="0"
                                value={form.low_stock_threshold}
                                onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                                required
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label>Unit</label>
                            <select
                                style={styles.input}
                                value={form.unit}
                                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                            >
                                <option value="g">g</option>
                                <option value="kg">kg</option>
                                <option value="ml">ml</option>
                                <option value="l">l</option>
                                <option value="pcs">pcs</option>
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label>Ingredient Mapping</label>
                            <select
                                style={styles.input}
                                value={form.ingredient_id}
                                onChange={(e) => setForm({ ...form, ingredient_id: e.target.value })}
                            >
                                <option value="">Select ingredient</option>
                                {ingredients.map((ing) => (
                                    <option key={ing.id} value={ing.id}>{ing.name} ({ing.default_unit})</option>
                                ))}
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label>Pack Size</label>
                            <input
                                type="number"
                                step="0.1"
                                style={styles.input}
                                value={form.pack_size}
                                onChange={(e) => setForm({ ...form, pack_size: e.target.value })}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label>Pack Unit</label>
                            <select
                                style={styles.input}
                                value={form.pack_unit}
                                onChange={(e) => setForm({ ...form, pack_unit: e.target.value })}
                            >
                                <option value="g">g</option>
                                <option value="kg">kg</option>
                                <option value="ml">ml</option>
                                <option value="l">l</option>
                                <option value="pcs">pcs</option>
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label>Active Listing</label>
                            <label style={styles.toggle}>
                                <input
                                    type="checkbox"
                                    checked={!!form.is_active}
                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                />
                                <span>{form.is_active ? 'Visible in shop' : 'Hidden'}</span>
                            </label>
                        </div>
                    </div>

                    <div style={styles.categoryInline}>
                        <input
                            style={styles.input}
                            placeholder="Create new category"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                        />
                        <label style={styles.fileLabel}>
                            <input
                                type="file"
                                accept="image/*"
                                style={styles.fileInput}
                                onChange={(e) => setNewCategoryImage(e.target.files?.[0] || null)}
                            />
                            {newCategoryImage ? newCategoryImage.name : 'Upload image'}
                        </label>
                        <button type="button" style={styles.secondaryBtn} onClick={handleCreateCategory}>
                            <Plus size={16} /> Add Category
                        </button>
                    </div>

                    <div style={styles.formActions}>
                        <button type="submit" style={styles.primaryBtn}>
                            {editingId ? 'Update Product' : 'Save Product'}
                        </button>
                        {editingId && (
                            <button
                                type="button"
                                style={styles.secondaryBtn}
                                onClick={() => { setForm(defaultForm); setEditingId(null); }}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </section>

            <section>
                <h2 style={styles.sectionTitle}>Inventory List</h2>
                <div style={styles.tableWrap}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Product</th>
                                <th style={styles.th}>Category</th>
                                <th style={styles.th}>Stock</th>
                                <th style={styles.th}>Price</th>
                                <th style={styles.th}>Pack</th>
                                <th style={styles.th}>Alert</th>
                                <th style={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((p) => (
                                <tr key={p.id}>
                                    <td style={styles.td}>
                                        <strong>{p.name}</strong>
                                        <div style={styles.tdSub}>{p.ingredient_name || 'No mapping'}</div>
                                    </td>
                                    <td style={styles.td}>{p.category_name || '--'}</td>
                                    <td style={styles.td}>{p.stock_quantity}</td>
                                    <td style={styles.td}>${Number(p.price).toFixed(2)}</td>
                                    <td style={styles.td}>{p.pack_size} {p.pack_unit}</td>
                                    <td style={styles.td}>
                                        {Number(p.stock_quantity || 0) <= Number(p.low_stock_threshold || 0)
                                            ? `Low (${p.low_stock_threshold})`
                                            : `OK (${p.low_stock_threshold})`}
                                    </td>
                                    <td style={styles.td}>
                                        <button style={styles.iconBtn} onClick={() => handleEdit(p)}><Edit size={16} /></button>
                                        <button style={{ ...styles.iconBtn, color: '#ef4444' }} onClick={() => handleDelete(p.id)}><Trash2 size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

const styles = {
    page: {
        background: 'linear-gradient(180deg, #f9f5f0 0%, #ffffff 40%, #fdf9f6 100%)',
        padding: '2.5rem 2.5rem 4rem',
        minHeight: '100vh',
    },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' },
    title: { fontSize: '2.2rem', color: 'var(--color-text)' },
    subtitle: { color: 'var(--color-text-light)' },
    ghostBtn: { background: 'transparent', border: '1px solid var(--color-border)', padding: '10px 16px', borderRadius: '999px', cursor: 'pointer' },

    formCard: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '20px', padding: '2rem', marginBottom: '2rem', boxShadow: 'var(--shadow-sm)' },
    formHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' },
    formBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(225,29,46,0.12)', border: '1px solid rgba(225,29,46,0.2)', padding: '6px 10px', borderRadius: '999px', color: 'var(--color-accent)', fontSize: '0.85rem' },
    form: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
    input: { padding: '10px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)' },
    toggle: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface-2)', padding: '10px', borderRadius: '10px', border: '1px solid var(--color-border)', color: 'var(--color-text-light)' },
    formActions: { display: 'flex', gap: '1rem', flexWrap: 'wrap' },
    primaryBtn: { background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' },
    secondaryBtn: { background: 'transparent', border: '1px solid var(--color-border)', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer' },
    categoryInline: { display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' },
    fileLabel: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '10px 16px',
        borderRadius: '999px',
        border: '1px dashed var(--color-border)',
        background: '#fff',
        color: 'var(--color-text-light)',
        cursor: 'pointer',
        fontSize: '0.9rem',
    },
    fileInput: { display: 'none' },

    sectionTitle: { fontSize: '1.4rem', marginBottom: '1rem' },
    tableWrap: { background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border)', overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '1rem', color: 'var(--color-text-light)', borderBottom: '1px solid var(--color-border)', fontSize: '0.85rem', textTransform: 'uppercase' },
    td: { padding: '1rem', borderBottom: '1px solid var(--color-border)' },
    tdSub: { color: 'var(--color-text-light)', fontSize: '0.85rem' },
    iconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', marginRight: '0.4rem' },
};

export default ShopOwnerProducts;
