import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, Smartphone, ChefHat, Leaf, Sparkles, ShieldCheck, MapPin, Activity, ChevronDown } from 'lucide-react';

const Home = () => {
    // Simple scroll reveal effect
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('show');
                }
            });
        });

        const hiddenElements = document.querySelectorAll('.hidden');
        hiddenElements.forEach((el) => observer.observe(el));

        return () => hiddenElements.forEach((el) => observer.unobserve(el));
    }, []);

    const menuItems = [
        {
            title: 'Green Herb Salad',
            time: '12m',
            image: '/api/category-image/vegetable/',
        },
        {
            title: 'Spiced Rice Bowl',
            time: '25m',
            image: '/api/category-image/grain/',
        },
        {
            title: 'Citrus Chicken',
            time: '30m',
            image: '/api/category-image/meat/',
        },
        {
            title: 'Veggie Stir Fry',
            time: '15m',
            image: '/api/category-image/vegetable/',
        },
        {
            title: 'Creamy Lentils',
            time: '20m',
            image: '/api/category-image/spice/',
        },
        {
            title: 'Fresh Fruit Bowl',
            time: '8m',
            image: '/api/category-image/dairy/',
        },
    ];

    const stats = [
        { label: 'Recipes curated', value: '12,400+' },
        { label: 'Local shops', value: '210+' },
        { label: 'Food waste saved', value: '3.2T' },
        { label: 'Active households', value: '48K' },
    ];

    const steps = [
        {
            title: 'Connect your pantry',
            description: 'Add items manually or from your recent orders. We keep quantities and expiry dates in sync.',
        },
        {
            title: 'Pick your goals',
            description: 'Tell us your nutrition targets and dietary preferences. Stash personalizes recommendations instantly.',
        },
        {
            title: 'Cook or shop in one tap',
            description: 'Get smart recipes, see what is missing, and order from nearby shops without leaving the app.',
        },
    ];

    const faqs = [
        {
            q: 'How does Stash know what to recommend?',
            a: 'We analyze what is in your pantry, expiry dates, and your nutrition goals to surface recipes that fit.',
        },
        {
            q: 'Can I order from multiple shops?',
            a: 'Yes. Stash surfaces trusted local shops and prioritizes them based on your location and availability.',
        },
        {
            q: 'Is my data secure?',
            a: 'We use modern security practices and only store what is needed to personalize your experience.',
        },
    ];

    return (
        <div style={styles.container}>
            {/* SECTION 1: HERO (Video Background) */}
            <section id="top" style={styles.heroSection}>
                <video autoPlay loop muted style={styles.video}>
                    <source src="/assets/food.mp4" type="video/mp4" />
                </video>
                <div style={styles.overlay}></div>
                <div style={styles.brand}>STASH</div>
                <nav style={styles.heroNav}>
                    <a href="#top" style={styles.heroNavLink}>Home</a>
                    <a href="#about" style={styles.heroNavLink}>About</a>
                    <Link to="/login" style={styles.heroNavLink}>Login</Link>
                </nav>

                <div className="container" style={styles.heroContent}>
                    <h1 className="hidden" style={styles.heroTitle}>
                        Smart Eating, <br />
                        <span style={{ color: 'var(--color-accent)' }}>Simplified.</span>
                    </h1>
                    <p className="hidden" style={styles.heroSubtitle}>
                        Stash connects your pantry, local shops, and dietary goals into one seamless experience.
                    </p>
                    <div className="hidden" style={styles.heroActions}>
                        <Link to="/login" className="btn btn-primary" style={styles.ctaButton}>
                            Get Started <ArrowRight size={20} />
                        </Link>
                        <div style={styles.heroBadges}>
                            <div style={styles.heroBadge}><Sparkles size={16} /> AI menus</div>
                            <div style={styles.heroBadge}><ShieldCheck size={16} /> Secure data</div>
                            <div style={styles.heroBadge}><MapPin size={16} /> Local shops</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 2: TRUST + STATS */}
            <section id="home-content" style={styles.trustSection}>
                <div className="container" style={styles.trustContent}>
                    <div style={styles.trustLeft}>
                        <h2 style={styles.sectionTitle}>Built for real kitchens</h2>
                        <p style={styles.sectionText}>
                            Stash helps you plan with what you already have, shop smarter, and cook with confidence.
                            It is designed for busy households that want the convenience of modern food planning without
                            the waste.
                        </p>
                        <div style={styles.trustHighlights}>
                            <div style={styles.trustItem}><CheckCircle size={18} /> Smart expiry alerts</div>
                            <div style={styles.trustItem}><CheckCircle size={18} /> Nutrition-aware recipes</div>
                            <div style={styles.trustItem}><CheckCircle size={18} /> Shop from nearby stores</div>
                        </div>
                    </div>
                    <div style={styles.trustStats}>
                        {stats.map((stat) => (
                            <div key={stat.label} style={styles.statCard} className="hover-float">
                                <div style={styles.statValue}>{stat.value}</div>
                                <div style={styles.statLabel}>{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 3: ABOUT STASH */}
            <section id="about" style={styles.aboutSection}>
                <div className="container hidden" style={styles.aboutContent}>
                    <div style={styles.sectionHeader}>
                        <h2 style={styles.sectionTitle}>What is <span style={{ color: 'var(--color-accent)' }}>Stash</span>?</h2>
                        <div style={styles.underline}></div>
                    </div>
                    <p style={styles.sectionText}>
                        Stash is the ultimate smart pantry and meal recommendation system. We help you reduce food waste, save money, and eat healthier by suggesting recipes based on what you already have and what's fresh at your local shops.
                    </p>
                </div>
            </section>

            {/* SECTION 4: HOW IT WORKS */}
            <section style={styles.howSection}>
                <div className="container">
                    <div style={styles.sectionHeader}>
                        <h2 style={styles.sectionTitle}>How it works</h2>
                        <div style={styles.underline}></div>
                    </div>
                    <div style={styles.howGrid}>
                        {steps.map((step, index) => (
                            <div key={step.title} style={styles.howCard} className="hidden">
                                <div style={styles.stepIndex}>0{index + 1}</div>
                                <h3>{step.title}</h3>
                                <p>{step.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 5: FEATURES */}
            <section style={styles.featureSection}>
                <div className="container">
                    <div style={styles.featureGrid}>
                        {/* Feature 1 */}
                        <div className="hidden" style={styles.featureCard}>
                            <div style={styles.featureIcon}><Leaf size={32} /></div>
                            <h3>Smart Pantry</h3>
                            <p>Track your ingredients automatically. Know exactly what you have and when it expires.</p>
                        </div>
                        {/* Feature 2 */}
                        <div className="hidden" style={styles.featureCard}>
                            <div style={styles.featureIcon}><ChefHat size={32} /></div>
                            <h3>AI Recipes</h3>
                            <p>Get personalized meal ideas based on your pantry and dietary preferences.</p>
                        </div>
                        {/* Feature 3 */}
                        <div className="hidden" style={styles.featureCard}>
                            <div style={styles.featureIcon}><Smartphone size={32} /></div>
                            <h3>Seamless Shopping</h3>
                            <p>Order missing ingredients from local shops with a single click.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 6: EXPERIENCE PREVIEW */}
            <section style={styles.previewSection}>
                <div className="container" style={styles.previewGrid}>
                    <div style={styles.previewCopy} className="hidden">
                        <span style={styles.pill}><Activity size={16} /> Live pantry insights</span>
                        <h2 style={styles.previewTitle}>Your kitchen, organized and intelligent.</h2>
                        <p style={styles.sectionText}>
                            Get a real-time view of what is available, what is expiring, and what can be cooked today.
                            Stash blends pantry, nutrition, and shopping into one streamlined workflow.
                        </p>
                        <div style={styles.previewChecklist}>
                            <div><CheckCircle size={18} /> Auto deduct on cooking</div>
                            <div><CheckCircle size={18} /> Download recipes as PDFs</div>
                            <div><CheckCircle size={18} /> Track nutrition goals weekly</div>
                        </div>
                        <Link to="/login" className="btn btn-primary" style={styles.previewButton}>
                            See your dashboard <ArrowRight size={18} />
                        </Link>
                    </div>
                    <div style={styles.previewCard} className="hidden float-slow">
                        <div style={styles.previewHeader}>
                            <div>
                                <h4 style={{ marginBottom: '0.2rem' }}>Today at a glance</h4>
                                <span style={styles.previewSub}>Pantry health · 86%</span>
                            </div>
                            <div style={styles.previewChip}>+12 items</div>
                        </div>
                        <div style={styles.previewRow}>
                            <div style={styles.previewMetric}>
                                <span>Calories remaining</span>
                                <strong>1,450 kcal</strong>
                                <div style={styles.progressTrack}>
                                    <div style={{ ...styles.progressFill, width: '62%' }}></div>
                                </div>
                            </div>
                            <div style={styles.previewMetric}>
                                <span>Protein goal</span>
                                <strong>78 / 120 g</strong>
                                <div style={styles.progressTrack}>
                                    <div style={{ ...styles.progressFill, width: '65%' }}></div>
                                </div>
                            </div>
                        </div>
                        <div style={styles.previewList}>
                            <div style={styles.previewListItem}>
                                <div>
                                    <strong>Grilled Chicken Bowl</strong>
                                    <span style={styles.previewSub}>Cook time · 25 min</span>
                                </div>
                                <span style={styles.previewBadge}>92% match</span>
                            </div>
                            <div style={styles.previewListItem}>
                                <div>
                                    <strong>Green Herb Salad</strong>
                                    <span style={styles.previewSub}>Cook time · 12 min</span>
                                </div>
                                <span style={styles.previewBadge}>88% match</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section style={styles.menuSection}>
                <div style={styles.menuHeader}>
                    <div>
                        <h2 style={styles.menuTitle}>Check out our gourmet menu</h2>
                        <p style={styles.menuSubtitle}>Discover curated recipes designed around your pantry.</p>
                    </div>
                    <Link to="/login" className="btn btn-primary" style={styles.menuButton}>
                        Explore Recipes <ArrowRight size={18} />
                    </Link>
                </div>
                <div style={styles.menuGrid}>
                    {menuItems.map((item, index) => (
                        <div
                            key={item.title}
                            style={{ ...styles.menuCard, animationDelay: `${index * 0.05}s` }}
                            className="fade-up hover-float"
                        >
                            <img
                                src={item.image}
                                alt={item.title}
                                style={styles.menuImage}
                                onError={(e) => { e.currentTarget.src = '/api/category-image/vegetable/'; }}
                            />
                            <div style={styles.menuOverlay}>
                                <h3>{item.title}</h3>
                                <span>{item.time}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* SECTION 7: FAQ */}
            <section style={styles.faqSection}>
                <div className="container">
                    <div style={styles.sectionHeader}>
                        <h2 style={styles.sectionTitle}>Common questions</h2>
                        <div style={styles.underline}></div>
                    </div>
                    <div style={styles.faqGrid}>
                        {faqs.map((item) => (
                            <div key={item.q} style={styles.faqCard} className="hidden">
                                <h4>{item.q}</h4>
                                <p>{item.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 8: CALL TO ACTION */}
            <section style={styles.ctaSection}>
                <div className="hidden" style={{ textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>Ready to upgrade your meals?</h2>
                    <Link to="/login" className="btn btn-primary" style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff', padding: '16px 32px' }}>
                        Join Stash Now
                    </Link>
                </div>
            </section>

            {/* FOOTER */}
            <footer style={styles.footer}>
                <p>&copy; 2026 Stash Inc. All rights reserved.</p>
            </footer>
        </div>
    );
};

const styles = {
    container: {
        overflowX: 'hidden',
    },
    heroSection: {
        position: 'relative',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: '#fff',
    },
    video: {
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        objectFit: 'cover',
        zIndex: -2,
    },
    overlay: {
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.8) 100%)',
        zIndex: -1,
    },
    brand: {
        position: 'absolute',
        top: '24px',
        left: '32px',
        color: '#ffffff',
        fontFamily: 'var(--font-heading)',
        fontWeight: '700',
        fontSize: '1.4rem',
        letterSpacing: '0.08em',
        zIndex: 2,
    },
    heroNav: {
        position: 'absolute',
        top: '24px',
        right: '32px',
        display: 'flex',
        gap: '1.5rem',
        alignItems: 'center',
        zIndex: 2,
        fontSize: '0.95rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
    },
    heroNavLink: {
        color: '#fff',
        opacity: 0.85,
        fontWeight: 600,
        transition: 'opacity 0.2s ease',
    },
    heroContent: {
        zIndex: 1,
        maxWidth: '720px',
        padding: '2rem',
    },
    heroTitle: {
        fontSize: '4rem',
        fontWeight: '800',
        marginBottom: '1rem',
        lineHeight: '1.1',
        textShadow: '0 4px 10px rgba(0,0,0,0.5)',
    },
    heroSubtitle: {
        fontSize: '1.5rem',
        marginBottom: '2.5rem',
        opacity: 0.9,
    },
    ctaButton: {
        padding: '18px 40px',
        fontSize: '1.2rem',
        backgroundColor: 'var(--color-accent)',
    },
    heroActions: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.2rem',
        marginBottom: '2.5rem',
    },
    heroBadges: {
        display: 'flex',
        gap: '0.75rem',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    heroBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.55rem 1rem',
        borderRadius: '999px',
        background: 'rgba(255,255,255,0.12)',
        color: '#fff',
        fontSize: '0.95rem',
        border: '1px solid rgba(255,255,255,0.2)',
        backdropFilter: 'blur(6px)',
    },

    menuSection: {
        padding: '5rem 2rem',
        background: 'var(--color-surface)',
    },
    menuHeader: {
        maxWidth: '1200px',
        margin: '0 auto 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1.5rem',
        flexWrap: 'wrap',
    },
    menuTitle: {
        fontSize: '2.6rem',
        color: 'var(--color-text)',
        marginBottom: '0.4rem',
    },
    menuSubtitle: {
        color: 'var(--color-text-light)',
    },
    menuButton: {
        backgroundColor: 'var(--color-primary)',
        color: '#ffffff',
    },
    menuGrid: {
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.2rem',
    },
    menuCard: {
        position: 'relative',
        borderRadius: '18px',
        overflow: 'hidden',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-2)',
    },
    menuImage: {
        width: '100%',
        height: '220px',
        objectFit: 'cover',
        display: 'block',
    },
    menuOverlay: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '1rem',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.8) 100%)',
        color: '#fff',
        gap: '0.4rem',
    },

    aboutSection: {
        padding: '6rem 2rem',
        background: 'var(--color-background)',
        textAlign: 'center',
    },
    sectionHeader: {
        marginBottom: '2rem',
        display: 'inline-block',
    },
    sectionTitle: {
        fontSize: '3rem',
        color: 'var(--color-text)',
    },
    underline: {
        height: '4px',
        width: '60px',
        background: 'var(--color-accent)',
        margin: '0.5rem auto 0',
        borderRadius: '2px',
    },
    sectionText: {
        fontSize: '1.2rem',
        color: 'var(--color-text-light)',
        maxWidth: '700px',
        margin: '0 auto',
        lineHeight: '1.8',
    },

    featureSection: {
        padding: '6rem 2rem',
        background: 'var(--color-surface)',
    },
    featureGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2rem',
        maxWidth: '1200px',
        margin: '0 auto',
    },
    featureCard: {
        background: 'var(--color-surface-2)',
        padding: '3rem',
        borderRadius: '20px',
        boxShadow: 'var(--shadow-sm)',
        textAlign: 'center',
        transition: 'transform 0.3s ease',
        border: '1px solid var(--color-border)',
    },
    featureIcon: {
        width: '80px', height: '80px',
        background: 'rgba(225,29,46,0.15)',
        color: 'var(--color-primary)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 1.5rem',
    },

    trustSection: {
        padding: '5rem 2rem',
        background: 'var(--color-surface-2)',
    },
    trustContent: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '2rem',
        alignItems: 'center',
    },
    trustLeft: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    trustHighlights: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem',
        color: 'var(--color-text-light)',
    },
    trustItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        fontWeight: 600,
    },
    trustStats: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
    },
    statCard: {
        padding: '1.8rem',
        borderRadius: '18px',
        background: '#fff',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        textAlign: 'left',
    },
    statValue: {
        fontSize: '1.8rem',
        fontWeight: 700,
        marginBottom: '0.4rem',
        color: 'var(--color-primary)',
    },
    statLabel: {
        color: 'var(--color-text-light)',
    },

    howSection: {
        padding: '6rem 2rem',
        background: 'var(--color-background)',
    },
    howGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '2rem',
        marginTop: '2rem',
    },
    howCard: {
        padding: '2rem',
        borderRadius: '18px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem',
    },
    stepIndex: {
        width: '44px',
        height: '44px',
        borderRadius: '12px',
        background: 'rgba(225,29,46,0.12)',
        color: 'var(--color-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
    },

    previewSection: {
        padding: '6rem 2rem',
        background: 'var(--color-surface-2)',
    },
    previewGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2.5rem',
        alignItems: 'center',
    },
    previewCopy: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.2rem',
    },
    previewTitle: {
        fontSize: '2.6rem',
        color: 'var(--color-text)',
    },
    previewChecklist: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.7rem',
        color: 'var(--color-text-light)',
        fontWeight: 600,
    },
    previewButton: {
        marginTop: '0.8rem',
        width: 'fit-content',
    },
    previewCard: {
        background: '#fff',
        borderRadius: '24px',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-md)',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    previewHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    previewSub: {
        color: 'var(--color-text-light)',
        fontSize: '0.9rem',
    },
    previewChip: {
        padding: '0.4rem 0.8rem',
        borderRadius: '999px',
        background: 'rgba(225,29,46,0.12)',
        color: 'var(--color-primary)',
        fontWeight: 600,
        fontSize: '0.85rem',
    },
    previewRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '1rem',
    },
    previewMetric: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        background: 'var(--color-surface-2)',
        padding: '1rem',
        borderRadius: '14px',
        border: '1px solid var(--color-border)',
    },
    progressTrack: {
        height: '6px',
        background: 'rgba(0,0,0,0.08)',
        borderRadius: '999px',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
        borderRadius: '999px',
    },
    previewList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem',
    },
    previewListItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.9rem 1rem',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
    },
    previewBadge: {
        padding: '0.3rem 0.6rem',
        borderRadius: '999px',
        background: 'rgba(17, 17, 17, 0.08)',
        fontSize: '0.85rem',
        fontWeight: 600,
    },
    pill: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0.9rem',
        borderRadius: '999px',
        background: 'rgba(225,29,46,0.12)',
        color: 'var(--color-primary)',
        fontWeight: 600,
        width: 'fit-content',
    },

    faqSection: {
        padding: '6rem 2rem',
        background: 'var(--color-surface-2)',
    },
    faqGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1.5rem',
        marginTop: '2rem',
    },
    faqCard: {
        padding: '1.8rem',
        borderRadius: '18px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.7rem',
        color: 'var(--color-text-light)',
    },

    ctaSection: {
        padding: '6rem 2rem',
        background: 'var(--color-surface-2)',
        color: 'var(--color-text)',
    },
    footer: {
        padding: '2rem',
        background: '#1e1b16',
        color: '#d6cbb8',
        textAlign: 'center',
    }
};

// CSS for animation classes
if (!document.getElementById('home-page-animations')) {
    const styleSheet = document.createElement("style");
    styleSheet.id = 'home-page-animations';
    styleSheet.innerText = `
      .hidden { opacity: 0; transform: translateY(30px); transition: all 0.9s ease; }
      .show { opacity: 1; transform: translateY(0); }
      .float-slow { animation: floatSlow 6s ease-in-out infinite; }
      .pulse-soft { animation: pulseSoft 3.5s ease-in-out infinite; }
      @keyframes floatSlow {
        0% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
        100% { transform: translateY(0); }
      }
      @keyframes pulseSoft {
        0% { box-shadow: 0 0 0 rgba(225,29,46,0.15); }
        50% { box-shadow: 0 20px 40px rgba(225,29,46,0.18); }
        100% { box-shadow: 0 0 0 rgba(225,29,46,0.15); }
      }
    `;
    document.head.appendChild(styleSheet);
}

export default Home;
