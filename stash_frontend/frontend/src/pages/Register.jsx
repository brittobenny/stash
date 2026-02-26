import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Mail, Phone, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import { authService } from '../services/api';
import '../styles/global.css';

const authBackground = '/api/auth-background/';

const Register = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        mobile_number: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            await authService.register(formData);
            setSuccess('Registration successful! Redirecting to login...');
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err) {
            console.error(err);
            // Extract error message if available from backend response
            const msg = err.response?.data?.error || JSON.stringify(err.response?.data) || 'Registration failed. Please try again.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h1 style={styles.title}>Create Account</h1>
                <p style={styles.subtitle}>Join Stash to manage your pantry smartly</p>

                {error && (
                    <div style={styles.error}>
                        <AlertCircle size={18} /> {error}
                    </div>
                )}

                {success && (
                    <div style={styles.success}>
                        <CheckCircle size={18} /> {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={styles.form}>

                    <div style={styles.inputGroup}>
                        <User size={20} style={styles.icon} />
                        <input
                            type="text"
                            name="name"
                            placeholder="Full Name"
                            style={styles.input}
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <Mail size={20} style={styles.icon} />
                        <input
                            type="email"
                            name="email"
                            placeholder="Email Address"
                            style={styles.input}
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <Phone size={20} style={styles.icon} />
                        <input
                            type="tel"
                            name="mobile_number"
                            placeholder="Mobile Number"
                            style={styles.input}
                            value={formData.mobile_number}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <Lock size={20} style={styles.icon} />
                        <input
                            type="password"
                            name="password"
                            placeholder="Password"
                            style={styles.input}
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" style={styles.submitBtn} disabled={loading}>
                        {loading ? 'Creating Account...' : 'Register'} <ArrowRight size={20} />
                    </button>

                    <p style={styles.footerText}>
                        Already have an account? <span style={styles.link} onClick={() => navigate('/login')}>Login</span>
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
        fontSize: '2.1rem',
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
        gap: '1.2rem',
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
    success: {
        background: 'rgba(34,197,94,0.12)',
        color: '#15803d',
        padding: '12px',
        borderRadius: '12px',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.9rem',
        justifyContent: 'center',
        border: '1px solid rgba(34,197,94,0.25)'
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

export default Register;
