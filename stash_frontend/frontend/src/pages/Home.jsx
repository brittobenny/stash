import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, Smartphone, ChefHat, Leaf } from 'lucide-react';

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
            image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=80',
        },
        {
            title: 'Spiced Rice Bowl',
            time: '25m',
            image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
        },
        {
            title: 'Citrus Chicken',
            time: '30m',
            image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
        },
        {
            title: 'Veggie Stir Fry',
            time: '15m',
            image: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=1200&q=80',
        },
        {
            title: 'Creamy Lentils',
            time: '20m',
            image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80',
        },
        {
            title: 'Fresh Fruit Bowl',
            time: '8m',
            image: 'https://images.unsplash.com/photo-1502740479091-635887520276?auto=format&fit=crop&w=1200&q=80',
        },
    ];

    return (
        <div style={styles.container}>
            {/* SECTION 1: HERO (Video Background) */}
            <section style={styles.heroSection}>
                <video autoPlay loop muted style={styles.video}>
                    <source src="/assets/food.mp4" type="video/mp4" />
                </video>
                <div style={styles.overlay}></div>
                <div style={styles.brand}>STASH</div>

                <div className="container" style={styles.heroContent}>
                    <h1 className="hidden" style={styles.heroTitle}>
                        Smart Eating, <br />
                        <span style={{ color: 'var(--color-accent)' }}>Simplified.</span>
                    </h1>
                    <p className="hidden" style={styles.heroSubtitle}>
                        Stash connects your pantry, local shops, and dietary goals into one seamless experience.
                    </p>
                    <Link to="/login" className="btn btn-primary hidden" style={styles.ctaButton}>
                        Get Started <ArrowRight size={20} />
                    </Link>
                </div>
            </section>

            {/* SECTION 2: ABOUT STASH */}
            <section style={styles.aboutSection}>
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

            {/* SECTION 3: FEATURES */}
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
                                referrerPolicy="no-referrer"
                            />
                            <div style={styles.menuOverlay}>
                                <h3>{item.title}</h3>
                                <span>{item.time}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* SECTION 4: CALL TO ACTION */}
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
    heroContent: {
        zIndex: 1,
        maxWidth: '800px',
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
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  .hidden { opacity: 0; transform: translateY(30px); transition: all 1s ease; }
  .show { opacity: 1; transform: translateY(0); }
`;
document.head.appendChild(styleSheet);

export default Home;
