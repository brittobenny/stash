import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User,
    Mail,
    Phone,
    PackageCheck,
    Flame,
    Activity,
    Package,
    Pencil,
    X,
    Bell,
    MapPin,
    Sparkles,
} from 'lucide-react';
import { pantryService, shopService, inventoryService, accountService, nutritionService } from '../services/api';
import { normalizeName, normalizeImagePath } from '../utils/normalize';
import '../styles/global.css';
import '../styles/profile.css';

const Profile = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [profileComplete, setProfileComplete] = useState(true);
    const [profileForm, setProfileForm] = useState({ name: '', address: '', location: '', mobile_number: '' });
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileImageFile, setProfileImageFile] = useState(null);
    const [showProfileEditor, setShowProfileEditor] = useState(false);
    const [metrics, setMetrics] = useState({
        pantryCount: 0,
        ordersCount: 0,
        cookedCount: 0,
        caloriesToday: 0,
        todayScore: 0,
        weeklyScore: 0,
        points: 0,
        level: 1,
        streak: 0,
        lastCookedText: 'No activity',
    });
    const [usage, setUsage] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [nutritionProfile] = useState({
        calorie_goal: 2000,
        protein_goal: 90,
        carb_goal: 250,
        fat_goal: 70,
    });
    const [nutritionProgress, setNutritionProgress] = useState({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
    });

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const res = await accountService.getProfile();
                const data = res.data || {};
                const safeName = normalizeName(data.name);
                const safeImage = normalizeImagePath(data.image);
                setUser({
                    name: safeName,
                    email: data.email,
                    mobile_number: data.mobile_number,
                    role: data.role,
                    address: data.address,
                    location: data.location,
                    image: safeImage,
                });
                setProfileComplete(Boolean(data.profile_completed));
                setProfileForm({
                    name: safeName || '',
                    address: data.address || '',
                    location: data.location || '',
                    mobile_number: data.mobile_number || '',
                });
                sessionStorage.setItem(
                    'user',
                    JSON.stringify({
                        name: safeName,
                        email: data.email,
                        role: data.role,
                        mobile_number: data.mobile_number,
                        address: data.address,
                        location: data.location,
                        profile_completed: data.profile_completed,
                        image: safeImage,
                    })
                );
            } catch (err) {
                const storedUser = sessionStorage.getItem('user');
                if (storedUser) {
                    const parsed = JSON.parse(storedUser);
                    const safeName = normalizeName(parsed.name);
                    const safeImage = normalizeImagePath(parsed.image);
                    setUser({ ...parsed, name: safeName || parsed.name, image: safeImage || parsed.image });
                    setProfileForm({
                        name: safeName || '',
                        address: parsed.address || '',
                        location: parsed.location || '',
                        mobile_number: parsed.mobile_number || '',
                    });
                } else {
                    setUser({
                        name: 'Guest User',
                        email: 'user@example.com',
                        mobile_number: 'N/A',
                        role: sessionStorage.getItem('role') || 'Customer',
                    });
                    setProfileForm({ name: '', address: '', location: '', mobile_number: '' });
                }
            }
        };
        loadProfile();
    }, []);

    useEffect(() => {
        const loadMetrics = async () => {
            try {
                const today = new Date().toISOString().slice(0, 10);
                const [pantryRes, ordersRes, usageRes, nutritionSummaryRes, todayScoreRes, cookedRes] =
                    await Promise.all([
                        pantryService.getItems(),
                        shopService.listOrders(),
                        inventoryService.listUsage(),
                        nutritionService.getProfileSummary(),
                        nutritionService.getDailyScores({ start: today, end: today }),
                        nutritionService.getCookedHistory({ limit: 200 }),
                    ]);
                const summary = nutritionSummaryRes.data || {};
                const todayEntry = (todayScoreRes.data || [])[0] || null;
                const cookedEntries = cookedRes.data || [];
                const lastCookedAt = cookedEntries.length > 0 ? new Date(cookedEntries[0].cooked_at) : null;
                setMetrics({
                    pantryCount: pantryRes.data?.length || 0,
                    ordersCount: ordersRes.data?.length || 0,
                    cookedCount: cookedEntries.length,
                    caloriesToday: Math.round(Number(todayEntry?.total_calories || 0)),
                    todayScore: Number(summary.today_score || 0),
                    weeklyScore: Number(summary.weekly_score || 0),
                    points: Number(summary.points || 0),
                    level: Number(summary.level || 1),
                    streak: Number(summary.current_streak || 0),
                    lastCookedText: lastCookedAt ? lastCookedAt.toLocaleDateString() : 'No activity',
                });
                if (todayEntry) {
                    setNutritionProgress({
                        calories: Number(todayEntry.total_calories || 0),
                        protein: Number(todayEntry.total_protein || 0),
                        carbs: Number(todayEntry.total_carbs || 0),
                        fat: Number(todayEntry.total_fats || 0),
                    });
                } else {
                    setNutritionProgress({ calories: 0, protein: 0, carbs: 0, fat: 0 });
                }
                const usageList = (usageRes.data || [])
                    .filter((u) => Number(u.quantity || 0) > 0)
                    .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))
                    .slice(0, 6);
                setUsage(usageList);
            } catch (err) {
                setMetrics((prev) => ({ ...prev }));
            }
        };
        loadMetrics();
    }, []);

    useEffect(() => {
        const loadNotifications = async () => {
            try {
                const res = await accountService.getNotifications();
                setNotifications(res.data || []);
            } catch (err) {
                setNotifications([]);
            }
        };
        loadNotifications();
    }, []);

    const macroBars = [
        { label: 'Calories', value: nutritionProgress.calories, goal: nutritionProfile.calorie_goal, color: '#f43f5e' },
        { label: 'Protein', value: nutritionProgress.protein, goal: nutritionProfile.protein_goal, color: '#14b8a6' },
        { label: 'Carbs', value: nutritionProgress.carbs, goal: nutritionProfile.carb_goal, color: '#f59e0b' },
        { label: 'Fat', value: nutritionProgress.fat, goal: nutritionProfile.fat_goal, color: '#3b82f6' },
    ];

    const maxUsage = Math.max(...usage.map((u) => Number(u.quantity || 0)), 1);

    const handleProfileSave = async () => {
        setSavingProfile(true);
        let shouldAlert = false;
        try {
            await accountService.updateProfile({ ...profileForm, image: profileImageFile });
        } catch (err) {
            shouldAlert = true;
        } finally {
            try {
                const refreshed = await accountService.getProfile();
                const data = refreshed.data || {};
                setUser((prev) => ({ ...prev, ...data }));
                const safeName = normalizeName(data.name || profileForm.name || user?.name);
                const safeImage = normalizeImagePath(data.image || user?.image);
                setProfileForm({
                    name: safeName || '',
                    address: data.address || profileForm.address || '',
                    location: data.location || profileForm.location || '',
                    mobile_number: data.mobile_number || profileForm.mobile_number || '',
                });
                setUser((prev) => ({
                    ...prev,
                    name: safeName || prev?.name,
                    image: safeImage || prev?.image,
                }));
                setProfileComplete(Boolean(data.profile_completed));
                sessionStorage.setItem(
                    'user',
                    JSON.stringify({
                        name: safeName || profileForm.name || user?.name,
                        email: data.email,
                        role: data.role,
                        mobile_number: data.mobile_number || profileForm.mobile_number,
                        address: data.address || profileForm.address,
                        location: data.location || profileForm.location,
                        profile_completed: data.profile_completed,
                        image: safeImage || data.image,
                    })
                );
                setProfileImageFile(null);
                setShowProfileEditor(false);
                shouldAlert = false;
            } catch (refreshErr) {
                if (shouldAlert) {
                    alert('Failed to update profile');
                }
            }
            setSavingProfile(false);
        }
    };

    if (!user) return <div className="profile-loading">Loading profile...</div>;

    const normalizedImage = normalizeImagePath(user?.image);
    const profileImageSrc = normalizedImage
        ? String(normalizedImage).startsWith('http')
            ? normalizedImage
            : `http://127.0.0.1:8000${normalizedImage}`
        : null;

    const completionScore = Math.round(
        (Number(Boolean(profileForm.address)) +
            Number(Boolean(profileForm.location)) +
            Number(Boolean(profileForm.mobile_number))) /
            3 *
            100
    );

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return (
        <div className="profile-page">
            {!profileComplete && (
                <div className="profile-alert">
                    Your profile is incomplete. Add your address and location to place orders.
                </div>
            )}

            <div className="account-shell">
                <aside className="account-left">
                    <div className="side-brand card float-card fade-up">
                        <span className="brand-badge">STASH</span>
                        <span className="brand-text">Client Profile</span>
                    </div>

                    <div className="profile-card card fade-up">
                        <div className="profile-header">
                            <div className="profile-avatar">
                                {profileImageSrc ? (
                                    <img src={profileImageSrc} alt="Profile" />
                                ) : (
                                    <User size={32} />
                                )}
                            </div>
                            <div>
                                <h2>{user.name || 'Stash User'}</h2>
                                <span className="role-pill">{user.role}</span>
                            </div>
                        </div>
                        <div className="profile-meta">
                            <div>
                                <Mail size={16} />
                                <span>{user.email}</span>
                            </div>
                            <div>
                                <Phone size={16} />
                                <span>{user.mobile_number || 'Not provided'}</span>
                            </div>
                            <div>
                                <MapPin size={16} />
                                <span>{user.location || 'Add location'}</span>
                            </div>
                        </div>
                        <div className="profile-chips">
                            <span>Pantry {metrics.pantryCount}</span>
                            <span>Orders {metrics.ordersCount}</span>
                            <span>Streak {metrics.streak}d</span>
                        </div>
                        <div className="completion">
                            <div className="completion-row">
                                <span>Profile completion</span>
                                <strong>{completionScore}%</strong>
                            </div>
                            <div className="completion-track">
                                <div className="completion-fill" style={{ width: `${completionScore}%` }} />
                            </div>
                        </div>
                        <div className="profile-actions">
                            <button className="btn-primary" onClick={() => setShowProfileEditor(true)}>
                                <Pencil size={16} /> Edit Profile
                            </button>
                            <button className="btn-secondary" onClick={() => navigate('/customer/orders')}>
                                <PackageCheck size={16} /> Orders
                            </button>
                            <button className="btn-ghost" onClick={() => navigate('/customer/notifications')}>
                                <Bell size={16} /> Notifications
                                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                            </button>
                        </div>
                    </div>

                    <div className="side-menu card fade-up">
                        <button className="menu-btn active">
                            <Sparkles size={16} /> Overview
                        </button>
                        <button className="menu-btn" onClick={() => navigate('/customer/inventory')}>
                            <Package size={16} /> Pantry
                        </button>
                        <button className="menu-btn" onClick={() => navigate('/customer/cook')}>
                            <Activity size={16} /> Cook Studio
                        </button>
                        <button className="menu-btn" onClick={() => navigate('/customer/nutrition')}>
                            <Flame size={16} /> Nutrition
                        </button>
                    </div>
                </aside>

                <main className="account-main">
                    <section className="hero-card card fade-up">
                        <div>
                            <p className="kicker">ACCOUNT OVERVIEW</p>
                            <h1>Welcome back, {user.name?.split(' ')[0] || 'Stash'}.</h1>
                            <p className="hero-sub">
                                Track your pantry, orders, and nutrition goals in one space. Your habits are trending
                                upward this week.
                            </p>
                            <div className="hero-actions">
                                <button className="btn-primary" onClick={() => setShowProfileEditor(true)}>
                                    Update Profile
                                </button>
                                <button className="btn-secondary" onClick={() => navigate('/customer/shop')}>
                                    Visit Shop
                                </button>
                            </div>
                        </div>
                        <div className="hero-stats">
                            <div className="stat-bubble bubble-a float-card">
                                <span>Today Score</span>
                                <strong>{Math.round(metrics.todayScore)}</strong>
                            </div>
                            <div className="stat-bubble bubble-b float-card">
                                <span>Calories Today</span>
                                <strong>{metrics.caloriesToday}</strong>
                            </div>
                            <div className="stat-bubble bubble-c float-card">
                                <span>Weekly Avg</span>
                                <strong>{Math.round(metrics.weeklyScore)}</strong>
                            </div>
                        </div>
                    </section>

                    <section className="metric-grid fade-up">
                        <div className="metric-card tint-a">
                            <Package size={18} />
                            <div>
                                <p>Pantry Items</p>
                                <h3>{metrics.pantryCount}</h3>
                            </div>
                        </div>
                        <div className="metric-card tint-b">
                            <PackageCheck size={18} />
                            <div>
                                <p>Orders</p>
                                <h3>{metrics.ordersCount}</h3>
                            </div>
                        </div>
                        <div className="metric-card tint-c">
                            <Activity size={18} />
                            <div>
                                <p>Recipes Cooked</p>
                                <h3>{metrics.cookedCount}</h3>
                            </div>
                        </div>
                        <div className="metric-card tint-d">
                            <Flame size={18} />
                            <div>
                                <p>Streak</p>
                                <h3>{metrics.streak} days</h3>
                            </div>
                        </div>
                        <div className="metric-card tint-e">
                            <Activity size={18} />
                            <div>
                                <p>Level</p>
                                <h3>L{metrics.level}</h3>
                            </div>
                        </div>
                        <div className="metric-card tint-f">
                            <Activity size={18} />
                            <div>
                                <p>Points</p>
                                <h3>{metrics.points}</h3>
                            </div>
                        </div>
                    </section>

                    <section className="split-grid fade-up">
                        <div className="activity-card card">
                            <h3>Usage Snapshot</h3>
                            <div className="usage-row">
                                <span>Inventory tracked</span>
                                <span>{metrics.pantryCount} ingredients</span>
                            </div>
                            <div className="usage-row">
                                <span>Last cooked</span>
                                <span>{metrics.lastCookedText}</span>
                            </div>
                            <div className="usage-row">
                                <span>Orders in progress</span>
                                <span>{metrics.ordersCount}</span>
                            </div>
                            <div className="usage-list">
                                {usage.length === 0 ? (
                                    <p className="muted">Cook a recipe to see usage trends here.</p>
                                ) : (
                                    usage.map((item) => {
                                        const pct = Math.min(
                                            100,
                                            Math.round((Number(item.quantity || 0) / maxUsage) * 100)
                                        );
                                        return (
                                            <div key={item.id} className="usage-item">
                                                <span>{item.ingredient_name || 'Ingredient'}</span>
                                                <div className="usage-bar">
                                                    <div style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="usage-val">
                                                    {Math.round(Number(item.quantity || 0))} {item.unit || ''}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="nutrition-card card">
                            <h3>Nutrition Goals</h3>
                            {macroBars.map((bar) => {
                                const pct = Math.min(
                                    100,
                                    Math.round((Number(bar.value || 0) / Math.max(Number(bar.goal || 1), 1)) * 100)
                                );
                                return (
                                    <div key={bar.label} className="bar-row">
                                        <div className="bar-label">
                                            <span>{bar.label}</span>
                                            <span>
                                                {Math.round(bar.value)} / {bar.goal}
                                            </span>
                                        </div>
                                        <div className="bar-track">
                                            <div style={{ width: `${pct}%`, background: bar.color }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </main>

                
            </div>

            {showProfileEditor && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Edit Profile</h3>
                            <button className="close-btn" onClick={() => setShowProfileEditor(false)}>
                                <X size={16} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="upload-card">
                                <div className="upload-preview">
                                    {profileImageFile ? (
                                        <img src={URL.createObjectURL(profileImageFile)} alt="Preview" />
                                    ) : profileImageSrc ? (
                                        <img src={profileImageSrc} alt="Profile" />
                                    ) : (
                                        <User size={32} />
                                    )}
                                </div>
                                <div>
                                    <div className="upload-title">Profile photo</div>
                                    <div className="upload-hint">JPG, PNG. Up to 5MB.</div>
                                    <label className="upload-btn">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)}
                                        />
                                        {profileImageFile ? 'Change photo' : 'Upload photo'}
                                    </label>
                                </div>
                            </div>

                            <div className="form-grid">
                                <div>
                                    <label>Name</label>
                                    <input
                                        value={profileForm.name}
                                        onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                                        placeholder="Enter your name"
                                    />
                                </div>
                                <div>
                                    <label>Email</label>
                                    <div className="readonly">{user.email}</div>
                                </div>
                                <div>
                                    <label>Role</label>
                                    <div className="readonly">{user.role}</div>
                                </div>
                                <div>
                                    <label>Mobile Number</label>
                                    <input
                                        value={profileForm.mobile_number}
                                        onChange={(e) => setProfileForm((prev) => ({ ...prev, mobile_number: e.target.value }))}
                                        placeholder="Enter mobile number"
                                    />
                                </div>
                                <div>
                                    <label>Location</label>
                                    <input
                                        value={profileForm.location}
                                        onChange={(e) => setProfileForm((prev) => ({ ...prev, location: e.target.value }))}
                                        placeholder="City / Area"
                                    />
                                </div>
                                <div className="full">
                                    <label>Address</label>
                                    <input
                                        value={profileForm.address}
                                        onChange={(e) => setProfileForm((prev) => ({ ...prev, address: e.target.value }))}
                                        placeholder="Street / Address"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowProfileEditor(false)}>
                                Cancel
                            </button>
                            <button className="btn-primary" onClick={handleProfileSave} disabled={savingProfile}>
                                {savingProfile ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
