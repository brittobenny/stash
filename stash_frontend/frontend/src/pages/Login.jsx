import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { authService } from '../services/api';
import { normalizeName, normalizeImagePath } from '../utils/normalize';
import '../styles/global.css';

const authBackground = '/api/auth-background/';
const AUTO_LOGIN_DEBOUNCE_MS = 900;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const redirectByRole = (navigate, role) => {
    if (role === 'shopowner') navigate('/shop-owner/dashboard');
    else if (role === 'admin') navigate('/admin');
    else navigate('/customer/home');
};

const Login = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [fieldInFocus, setFieldInFocus] = useState('');
    const attemptedSignatureRef = useRef('');

    const executeLogin = useCallback(async (username, password) => {
        setError('');
        setLoading(true);

        try {
            const data = await authService.login(username, password);
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

            redirectByRole(navigate, role);

        } catch (err) {
            if (err?.response?.status !== 401) {
                console.error(err);
            }
            setError('Invalid credentials. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const username = formData.username.trim();
        const password = formData.password;
        if (!username || !password || loading) return;
        const signature = `${username}::${password}`;
        attemptedSignatureRef.current = signature;
        await executeLogin(username, password);
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        if (token) {
            redirectByRole(navigate, role || 'customer');
        }
    }, [navigate]);

    useEffect(() => {
        const username = formData.username.trim();
        const password = formData.password;
        const emailLooksValid = EMAIL_PATTERN.test(username);
        if (!emailLooksValid || !password || loading || fieldInFocus) return;

        const signature = `${username}::${password}`;
        if (signature === attemptedSignatureRef.current) return;

        const timer = setTimeout(async () => {
            attemptedSignatureRef.current = signature;
            await executeLogin(username, password);
        }, AUTO_LOGIN_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [formData.username, formData.password, loading, fieldInFocus, executeLogin]);

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
                            autoComplete="email"
                            style={styles.input}
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            onFocus={() => setFieldInFocus('username')}
                            onBlur={() => setFieldInFocus('')}
                            required
                        />
                    </div>
                    <div style={styles.inputGroup}>
                        <Lock size={20} style={styles.icon} />
                        <input
                            type="password"
                            placeholder="Password"
                            autoComplete="current-password"
                            style={styles.input}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            onFocus={() => setFieldInFocus('password')}
                            onBlur={() => setFieldInFocus('')}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" style={styles.submitBtn} disabled={loading}>
                        {loading ? 'Verifying...' : 'Login'} <ArrowRight size={18} />
                    </button>

                    <div style={styles.autoSignInNote}>
                        {loading ? 'Verifying credentials...' : 'Auto sign-in starts after you finish typing, or use Login'}
                    </div>

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
        padding: '14px 16px',
        fontSize: '1rem',
        borderRadius: '999px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
    },
    autoSignInNote: {
        marginTop: '-0.4rem',
        fontSize: '0.88rem',
        color: 'var(--color-text-light)',
        textAlign: 'center',
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
