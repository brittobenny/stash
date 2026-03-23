import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Bell, LogOut, UserCircle } from 'lucide-react';
import { accountService } from '../services/api';
import { normalizeImagePath } from '../utils/normalize';
import '../styles/global.css';

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [unreadCount, setUnreadCount] = useState(0);
    const role = sessionStorage.getItem('role');
    let profileImage = null;

    try {
        const rawUser = sessionStorage.getItem('user');
        if (rawUser) {
            const parsed = JSON.parse(rawUser);
            const img = normalizeImagePath(parsed?.image);
            if (img) {
                profileImage = img.startsWith('http') ? img : `http://127.0.0.1:8000${img}`;
            }
        }
    } catch {
        profileImage = null;
    }

    const isActive = (path) => (
        location.pathname === path ||
        (path === '/customer/inventory' && location.pathname.startsWith('/customer/recipes'))
    );

    useEffect(() => {
        // Simple check on mount and location change
        if (role === 'customer') {
            accountService.getNotifications()
                .then((res) => {
                    const data = res.data || [];
                    const unread = data.filter((n) => !n.is_read).length;
                    setUnreadCount(unread);
                })
                .catch(() => {
                    setUnreadCount(0);
                });
        } else {
            setUnreadCount(0);
        }
    }, [location, role]);

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <nav style={styles.nav}>
            <div style={styles.container}>
                <Link to="/" style={styles.logo}>
                    STASH
                </Link>

                <ul style={styles.links}>
                    {role === 'customer' && (
                        <>
                            <li><Link to="/customer/inventory" style={{ ...styles.link, ...(isActive('/customer/inventory') ? styles.linkActive : {}) }}>Inventory</Link></li>
                            <li><Link to="/customer/cook" style={{ ...styles.link, ...(isActive('/customer/cook') ? styles.linkActive : {}) }}>Cook</Link></li>
                            <li><Link to="/customer/nutrition" style={{ ...styles.link, ...(isActive('/customer/nutrition') ? styles.linkActive : {}) }}>Nutrition</Link></li>
                            <li><Link to="/customer/home" style={{ ...styles.link, ...(isActive('/customer/home') ? styles.linkActive : {}) }}>Blog</Link></li>
                            <li><Link to="/customer/shop" style={{ ...styles.link, ...(isActive('/customer/shop') ? styles.linkActive : {}) }}>Shop</Link></li>
                            <li><Link to="/customer/account" style={{ ...styles.link, ...(isActive('/customer/account') ? styles.linkActive : {}) }}>Account</Link></li>
                        </>
                    )}
                    {role === 'shopowner' && (
                        <>
                            <li><Link to="/shop-owner/dashboard" style={{ ...styles.link, ...(isActive('/shop-owner/dashboard') ? styles.linkActive : {}) }}>Dashboard</Link></li>
                            <li><Link to="/shop-owner/inventory" style={{ ...styles.link, ...(isActive('/shop-owner/inventory') ? styles.linkActive : {}) }}>Inventory</Link></li>
                            <li><Link to="/shop-owner/products" style={{ ...styles.link, ...(isActive('/shop-owner/products') ? styles.linkActive : {}) }}>Products</Link></li>
                            <li><Link to="/shop-owner/orders" style={{ ...styles.link, ...(isActive('/shop-owner/orders') ? styles.linkActive : {}) }}>Orders</Link></li>
                            <li><Link to="/shop-owner/feedback" style={{ ...styles.link, ...(isActive('/shop-owner/feedback') ? styles.linkActive : {}) }}>Feedback</Link></li>
                        </>
                    )}
                    {role === 'admin' && (
                        <>
                            <li><Link to="/admin" style={{ ...styles.link, ...(isActive('/admin') ? styles.linkActive : {}) }}>Dashboard</Link></li>
                            <li><Link to="/admin/users" style={{ ...styles.link, ...(isActive('/admin/users') ? styles.linkActive : {}) }}>Users</Link></li>
                            <li><Link to="/admin/shops" style={{ ...styles.link, ...(isActive('/admin/shops') ? styles.linkActive : {}) }}>Shops</Link></li>
                            <li><Link to="/admin/posts" style={{ ...styles.link, ...(isActive('/admin/posts') ? styles.linkActive : {}) }}>Posts</Link></li>
                            <li><Link to="/admin/products" style={{ ...styles.link, ...(isActive('/admin/products') ? styles.linkActive : {}) }}>Products</Link></li>
                            <li><Link to="/admin/orders" style={{ ...styles.link, ...(isActive('/admin/orders') ? styles.linkActive : {}) }}>Orders</Link></li>
                            <li><Link to="/admin/feedback" style={{ ...styles.link, ...(isActive('/admin/feedback') ? styles.linkActive : {}) }}>Feedback</Link></li>
                        </>
                    )}
                </ul>

                <div style={styles.actions}>
                    {role === 'customer' && (
                        <div style={styles.iconRow}>
                            <Link to="/customer/notifications" style={styles.iconBtn} aria-label="Notifications">
                                <Bell size={18} />
                                {unreadCount > 0 && (
                                    <span style={styles.notifBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                                )}
                            </Link>
                            <Link to="/customer/account" style={styles.iconBtn} aria-label="Account">
                                {profileImage ? (
                                    <img src={profileImage} alt="Profile" style={styles.avatarImg} />
                                ) : (
                                    <UserCircle size={20} />
                                )}
                            </Link>
                        </div>
                    )}
                    {role ? (
                        <button onClick={handleLogout} className="btn" style={styles.logoutBtn}>
                            <LogOut size={16} /> Logout
                        </button>
                    ) : (
                        <Link to="/login" className="btn" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>Login</Link>
                    )}
                </div>
            </div>
        </nav>
    );
};

const styles = {
    nav: {
        position: 'sticky',
        top: 0,
        width: '100%',
        padding: '0.6rem 0',
        zIndex: 10,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)'
    },
    container: {
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        width: '100%',
        margin: '0 auto',
        padding: '0.6rem 2.8rem',
        background: 'transparent'
    },
    logo: {
        fontSize: '1.7rem',
        fontWeight: '700',
        fontFamily: 'var(--font-heading)',
        letterSpacing: '-0.5px',
        color: 'var(--color-primary)',
        textDecoration: 'none'
    },
    links: {
        display: 'flex',
        gap: '2rem',
        fontWeight: '500',
        listStyle: 'none',
        margin: 0,
        padding: 0,
        justifySelf: 'center'
    },
    link: {
        color: 'var(--color-text)',
        textDecoration: 'none',
        fontSize: '0.95rem',
        transition: 'color 0.2s',
        display: 'flex',
        alignItems: 'center',
        padding: '6px 12px',
        borderRadius: '999px'
    },
    linkActive: {
        color: 'var(--color-primary)',
        background: 'rgba(225,29,46,0.12)',
        border: '1px solid rgba(225,29,46,0.2)'
    },
    actions: {
        display: 'flex',
        gap: '0.8rem',
        justifySelf: 'end',
        alignItems: 'center',
    },
    iconRow: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
    iconBtn: {
        width: '34px',
        height: '34px',
        borderRadius: '999px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-2)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text)',
        textDecoration: 'none',
        position: 'relative',
    },
    notifBadge: {
        position: 'absolute',
        top: '-6px',
        right: '-6px',
        background: 'var(--color-primary)',
        color: '#fff',
        borderRadius: '999px',
        fontSize: '0.7rem',
        fontWeight: 700,
        padding: '2px 6px',
        boxShadow: '0 6px 12px rgba(225,29,46,0.25)',
    },
    avatarImg: {
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        objectFit: 'cover',
        border: '1px solid rgba(0,0,0,0.08)',
    },
    logoutBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(239, 68, 68, 0.15)',
        color: '#ef4444',
        border: '1px solid rgba(239,68,68,0.2)',
        padding: '8px 16px',
        borderRadius: '999px',
        cursor: 'pointer',
        fontSize: '0.9rem'
    }
};

export default Navbar;
