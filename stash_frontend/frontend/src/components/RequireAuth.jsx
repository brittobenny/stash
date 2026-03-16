import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

const roleHome = (role) => {
    if (role === 'shopowner') return '/shop-owner/dashboard';
    if (role === 'admin') return '/admin';
    return '/customer/inventory';
};

const RequireAuth = ({ allowedRoles = [] }) => {
    const location = useLocation();
    const token = sessionStorage.getItem('token');
    const role = sessionStorage.getItem('role');

    if (!token) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        return <Navigate to={roleHome(role)} replace />;
    }

    return <Outlet />;
};

export default RequireAuth;
