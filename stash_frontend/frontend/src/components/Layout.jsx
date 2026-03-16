import React, { useEffect, useState } from 'react';
import Navbar from './Navbar';
import { Outlet } from 'react-router-dom';
import '../styles/global.css';

const Layout = () => {
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const role = sessionStorage.getItem('role');
        if (role) {
            setLoading(true);
            const timer = setTimeout(() => setLoading(false), 900);
            return () => clearTimeout(timer);
        }
    }, []);

    return (
        <div className="app-layout">
            {loading && (
                <div className="page-loader">
                    <div className="page-loader-inner">
                        <div className="ai-loader"></div>
                        <div className="page-loader-text">Loading your workspace...</div>
                    </div>
                </div>
            )}
            <Navbar />
            <main>
                <Outlet />
            </main>
            {/* Footer can be added here */}
        </div>
    );
};

export default Layout;
