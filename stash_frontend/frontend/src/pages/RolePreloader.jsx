import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CookingPot, Store, ShieldCheck } from 'lucide-react';
import '../styles/preloader.css';

const roleConfig = {
    customer: {
        title: 'Preparing your pantry',
        subtitle: 'Syncing your pantry, recipes, and nutrition insights.',
        accent: '#e11d2e',
        icon: CookingPot,
        target: '/customer/home',
        badge: 'Customer Workspace',
    },
    shopowner: {
        title: 'Loading your shop console',
        subtitle: 'Updating orders, inventory, and sales insights.',
        accent: '#0f766e',
        icon: Store,
        target: '/shop-owner/dashboard',
        badge: 'Shop Owner Console',
    },
    admin: {
        title: 'Warming up admin controls',
        subtitle: 'Checking platform health and moderation queues.',
        accent: '#7c3aed',
        icon: ShieldCheck,
        target: '/admin',
        badge: 'System Admin',
    },
};

const RolePreloader = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const role = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('role') || sessionStorage.getItem('role') || 'customer';
    }, [location.search]);

    const config = roleConfig[role] || roleConfig.customer;

    useEffect(() => {
        const token = sessionStorage.getItem('token');
        if (!token) {
            navigate('/login', { replace: true });
            return;
        }
        const timer = setTimeout(() => {
            navigate(config.target, { replace: true });
        }, 1400);
        return () => clearTimeout(timer);
    }, [navigate, config.target]);

    const Icon = config.icon;

    return (
        <div className="role-preloader" style={{ '--accent': config.accent }}>
            <div className="role-preloader__orb role-preloader__orb--one" />
            <div className="role-preloader__orb role-preloader__orb--two" />
            <div className="role-preloader__panel">
                <div className="role-preloader__badge">{config.badge}</div>
                <div className="role-preloader__icon">
                    <Icon size={28} />
                </div>
                <h1>{config.title}</h1>
                <p>{config.subtitle}</p>

                <div className="role-preloader__meter">
                    <span className="role-preloader__meter-fill" />
                </div>

                <div className="role-preloader__dots">
                    <span />
                    <span />
                    <span />
                </div>
            </div>
        </div>
    );
};

export default RolePreloader;
