import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { authService } from '../services/api';
import { normalizeName, normalizeImagePath } from '../utils/normalize';
import '../styles/global.css';

const authBackground = '/api/auth-background/';

const Login = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = await authService.login(formData.username, formData.password);

            // Assuming backend returns role, or we deduce it/fetch it. 
            // If backend doesn't return role, we might need to fetch profile.
            // Let's assume for this step the backend aligns or we default to customer.
            // PRO TIP: If role is missing, we could add a subsequent call to /accounts/profile/ if it existed.
            // But based on `accounts/models.py`, UserProfile has a role field.

            // Let's assume the login view returns the role. If not, I'll need to update backend or fetch user details.
            // For now, let's try to interpret role from response or fallback.

            const role = data.role || data.user?.role || 'customer';
            localStorage.setItem('role', role);
            if (data.user) {
                const safeUser = {
                    ...data.user,
                    name: normalizeName(data.user.name),
                    image: normalizeImagePath(data.user.image),
                };
                localStorage.setItem('user', JSON.stringify(safeUser));
            }

            if (role === 'shopowner') navigate('/shop-owner/dashboard');
            else if (role === 'admin') navigate('/admin');
            else navigate('/customer/home');

        } catch (err) {
            console.error(err);
            setError('Invalid credentials. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h1 style={styles.title}>Welcome Back</h1>
                <p style={styles.subtitle}>Login to access your Stash</p>

                {error && (
                    <div style={styles.error}>
                        <AlertCircle size={18} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <User size={20} style={styles.icon} />
                        <input
                            type="text"
                            placeholder="Email"
                            style={styles.input}
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            required
                        />
                    </div>
                    <div style={styles.inputGroup}>
                        <Lock size={20} style={styles.icon} />
                        <input
                            type="password"
                            placeholder="Password"
                            style={styles.input}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" style={styles.submitBtn} disabled={loading}>
                        {loading ? 'Logging in...' : 'Login'} <ArrowRight size={20} />
                    </button>

                    <p style={styles.footerText}>
                        Don't have an account? <span style={styles.link} onClick={() => navigate('/register')}>Register</span>
                    </p>
                </form>
            </div>
        </div>
    );
};

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(rgba(247,242,232,0.72), rgba(241,234,220,0.78)), url(${authBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '1rem',
    },
    card: {
        background: '#ffffff',
        padding: '3rem 2.5rem',
        borderRadius: '28px',
        boxShadow: '0 30px 60px rgba(30, 27, 22, 0.15)',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center',
        border: '1px solid var(--color-border)',
    },
    title: {
        fontSize: '2.3rem',
        marginBottom: '0.5rem',
        color: 'var(--color-text)',
        fontWeight: '700',
        fontFamily: 'var(--font-heading)'
    },
    subtitle: {
        color: 'var(--color-text-light)',
        marginBottom: '2rem',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    inputGroup: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: '#f6f1e8',
        border: '1px solid #e9e1d4',
        borderRadius: '14px',
        padding: '6px 4px',
    },
    icon: {
        position: 'absolute',
        left: '16px',
        color: 'var(--color-text-light)',
        zIndex: 1,
    },
    input: {
        width: '100%',
        padding: '14px 16px 14px 48px',
        borderRadius: '12px',
        border: 'none',
        fontSize: '1rem',
        transition: 'all 0.3s ease',
        outline: 'none',
        background: 'transparent',
        color: 'var(--color-text)',
    },
    submitBtn: {
        width: '100%',
        padding: '16px',
        fontSize: '1.05rem',
        marginTop: '0.8rem',
        borderRadius: '999px'
    },
    error: {
        background: '#fde8e8',
        color: '#e54848',
        padding: '12px',
        borderRadius: '12px',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.9rem',
        justifyContent: 'center',
        border: '1px solid rgba(229,72,72,0.2)'
    },
    footerText: {
        marginTop: '1.2rem',
        fontSize: '0.95rem',
        color: 'var(--color-text-light)',
    },
    link: {
        color: 'var(--color-accent)',
        fontWeight: '600',
        cursor: 'pointer',
    }
};

export default Login;
