import React, { useEffect, useState } from 'react';
import { Save, UploadCloud } from 'lucide-react';
import { shopOwnerService } from '../services/api';
import '../styles/global.css';

const ShopOwnerSettings = () => {
    const [profile, setProfile] = useState(null);
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);

    const loadProfile = async () => {
        try {
            const res = await shopOwnerService.getShopProfile();
            setProfile(res.data);
            setForm(res.data || {});
        } catch (err) {
            setProfile(null);
        }
    };

    useEffect(() => {
        loadProfile();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await shopOwnerService.updateShopProfile(form);
            await loadProfile();
        } catch (err) {
            alert('Failed to save profile.');
        } finally {
            setSaving(false);
        }
    };

    if (!profile) {
        return <div style={styles.loading}>Loading shop profile...</div>;
    }

    return (
        <div style={styles.page}>
            <section style={styles.header}>
                <div>
                    <h1 style={styles.title}>Shop Profile & Settings</h1>
                    <p style={styles.subtitle}>Control store details, delivery settings, and tax configuration.</p>
                </div>
            </section>

            <form style={styles.card} onSubmit={handleSubmit}>
                <div style={styles.grid}>
                    <div style={styles.formGroup}>
                        <label>Store Name</label>
                        <input
                            style={styles.input}
                            value={form.store_name || ''}
                            onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label>Location</label>
                        <input
                            style={styles.input}
                            value={form.location || ''}
                            onChange={(e) => setForm({ ...form, location: e.target.value })}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label>Phone</label>
                        <input
                            style={styles.input}
                            value={form.phone || ''}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label>Hours</label>
                        <input
                            style={styles.input}
                            value={form.hours || ''}
                            onChange={(e) => setForm({ ...form, hours: e.target.value })}
                            placeholder="9 AM - 9 PM"
                        />
                    </div>
                    <div style={{ ...styles.formGroup, gridColumn: '1/-1' }}>
                        <label>Address</label>
                        <textarea
                            style={styles.textarea}
                            value={form.address || ''}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label>Delivery Radius (km)</label>
                        <input
                            type="number"
                            style={styles.input}
                            value={form.delivery_radius_km || ''}
                            onChange={(e) => setForm({ ...form, delivery_radius_km: e.target.value })}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label>Minimum Order</label>
                        <input
                            type="number"
                            style={styles.input}
                            value={form.min_order_amount || ''}
                            onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label>Tax Rate (%)</label>
                        <input
                            type="number"
                            style={styles.input}
                            value={form.tax_rate || ''}
                            onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label>Service Fee</label>
                        <input
                            type="number"
                            style={styles.input}
                            value={form.service_fee || ''}
                            onChange={(e) => setForm({ ...form, service_fee: e.target.value })}
                        />
                    </div>
                </div>

                <div style={styles.uploadRow}>
                    <label style={styles.uploadCard}>
                        <UploadCloud size={18} />
                        <span>{form.logo?.name || 'Upload logo'}</span>
                        <input
                            type="file"
                            accept="image/*"
                            style={styles.fileInput}
                            onChange={(e) => setForm({ ...form, logo: e.target.files?.[0] || null })}
                        />
                    </label>
                    <label style={styles.uploadCard}>
                        <UploadCloud size={18} />
                        <span>{form.banner?.name || 'Upload banner'}</span>
                        <input
                            type="file"
                            accept="image/*"
                            style={styles.fileInput}
                            onChange={(e) => setForm({ ...form, banner: e.target.files?.[0] || null })}
                        />
                    </label>
                </div>

                <div style={styles.actions}>
                    <button style={styles.primaryBtn} type="submit">
                        <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
};

const styles = {
    page: {
        background: 'linear-gradient(180deg, #f9f5f0 0%, #ffffff 40%, #fdf9f6 100%)',
        padding: '2.5rem 2.5rem 4rem',
        minHeight: '100vh',
    },
    loading: { padding: '2rem', color: 'var(--color-text-light)' },
    header: { marginBottom: '1.6rem' },
    title: { fontSize: '2.2rem' },
    subtitle: { color: 'var(--color-text-light)' },
    card: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: '22px', padding: '2rem', boxShadow: 'var(--shadow-sm)' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
    input: { padding: '10px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)' },
    textarea: { padding: '10px', borderRadius: '10px', border: '1px solid var(--color-border)', minHeight: '80px' },
    uploadRow: { display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem' },
    uploadCard: { display: 'flex', alignItems: 'center', gap: '8px', border: '1px dashed var(--color-border)', borderRadius: '14px', padding: '12px 16px', cursor: 'pointer' },
    fileInput: { display: 'none' },
    actions: { marginTop: '1.6rem' },
    primaryBtn: { background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '12px 18px', borderRadius: '999px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 },
};

export default ShopOwnerSettings;
