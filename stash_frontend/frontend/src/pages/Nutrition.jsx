import React, { useEffect, useState } from 'react';
import { Activity, Flame, Leaf, AlertTriangle, Save } from 'lucide-react';
import '../styles/global.css';

const Nutrition = () => {
    const [profile, setProfile] = useState({
        calorie_goal: 2000,
        protein_goal: 90,
        carb_goal: 250,
        fat_goal: 70,
        diet_type: 'Balanced',
        allergies: 'None',
        notes: '',
    });
    const [progress, setProgress] = useState({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
    });

    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem('nutrition_profile') || '{}');
        if (stored.calorie_goal) {
            setProfile((prev) => ({ ...prev, ...stored }));
        }
        const today = new Date().toISOString().slice(0, 10);
        const prog = JSON.parse(localStorage.getItem('nutrition_progress') || '{}');
        if (prog.date === today) {
            setProgress({
                calories: Number(prog.calories || 0),
                protein: Number(prog.protein || 0),
                carbs: Number(prog.carbs || 0),
                fat: Number(prog.fat || 0),
            });
        }
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfile((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = (e) => {
        e.preventDefault();
        localStorage.setItem('nutrition_profile', JSON.stringify(profile));
        alert('Nutrition profile saved.');
    };

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <div>
                    <h1 style={styles.title}>Nutrition Profile</h1>
                    <p style={styles.subtitle}>Set goals and preferences to personalize your recipe recommendations.</p>
                </div>
                <div style={styles.badge}>
                    <Activity size={16} /> Active Plan
                </div>
            </header>

            <section style={styles.cards}>
                <div style={styles.card}>
                    <div style={styles.cardIcon}><Flame size={20} /></div>
                    <div>
                        <p style={styles.cardLabel}>Daily Calories</p>
                        <p style={styles.cardValue}>{profile.calorie_goal} kcal</p>
                    </div>
                </div>
                <div style={styles.card}>
                    <div style={styles.cardIcon}><Leaf size={20} /></div>
                    <div>
                        <p style={styles.cardLabel}>Protein Goal</p>
                        <p style={styles.cardValue}>{profile.protein_goal} g</p>
                    </div>
                </div>
                <div style={styles.card}>
                    <div style={styles.cardIcon}><AlertTriangle size={20} /></div>
                    <div>
                        <p style={styles.cardLabel}>Diet Type</p>
                        <p style={styles.cardValue}>{profile.diet_type}</p>
                    </div>
                </div>
            </section>

            <section style={styles.progressSection}>
                <h2 style={styles.sectionTitle}>Today's Intake</h2>
                <div style={styles.progressGrid}>
                    <div style={styles.progressCard}>
                        <p style={styles.progressLabel}>Calories</p>
                        <p style={styles.progressValue}>{Math.round(progress.calories)} / {profile.calorie_goal} kcal</p>
                    </div>
                    <div style={styles.progressCard}>
                        <p style={styles.progressLabel}>Protein</p>
                        <p style={styles.progressValue}>{Math.round(progress.protein)} / {profile.protein_goal} g</p>
                    </div>
                    <div style={styles.progressCard}>
                        <p style={styles.progressLabel}>Carbs</p>
                        <p style={styles.progressValue}>{Math.round(progress.carbs)} / {profile.carb_goal} g</p>
                    </div>
                    <div style={styles.progressCard}>
                        <p style={styles.progressLabel}>Fat</p>
                        <p style={styles.progressValue}>{Math.round(progress.fat)} / {profile.fat_goal} g</p>
                    </div>
                </div>
            </section>

            <section style={styles.formSection}>
                <h2 style={styles.sectionTitle}>Update Preferences</h2>
                <form style={styles.form} onSubmit={handleSave}>
                    <div style={styles.formGrid}>
                        <div style={styles.formGroup}>
                            <label>Daily Calorie Goal</label>
                            <input
                                type="number"
                                name="calorie_goal"
                                value={profile.calorie_goal}
                                onChange={handleChange}
                                style={styles.input}
                                min="800"
                                max="5000"
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label>Protein Goal (g)</label>
                            <input
                                type="number"
                                name="protein_goal"
                                value={profile.protein_goal}
                                onChange={handleChange}
                                style={styles.input}
                                min="20"
                                max="300"
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label>Carb Goal (g)</label>
                            <input
                                type="number"
                                name="carb_goal"
                                value={profile.carb_goal}
                                onChange={handleChange}
                                style={styles.input}
                                min="50"
                                max="600"
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label>Fat Goal (g)</label>
                            <input
                                type="number"
                                name="fat_goal"
                                value={profile.fat_goal}
                                onChange={handleChange}
                                style={styles.input}
                                min="20"
                                max="200"
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label>Diet Type</label>
                            <select
                                name="diet_type"
                                value={profile.diet_type}
                                onChange={handleChange}
                                style={styles.input}
                            >
                                <option>Balanced</option>
                                <option>Vegetarian</option>
                                <option>Vegan</option>
                                <option>High Protein</option>
                                <option>Low Carb</option>
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label>Allergies</label>
                            <input
                                type="text"
                                name="allergies"
                                value={profile.allergies}
                                onChange={handleChange}
                                style={styles.input}
                                placeholder="Peanuts, gluten..."
                            />
                        </div>
                    </div>

                    <div style={styles.formGroup}>
                        <label>Notes</label>
                        <textarea
                            name="notes"
                            value={profile.notes}
                            onChange={handleChange}
                            style={styles.textarea}
                            placeholder="Any extra preferences or restrictions..."
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" style={styles.saveBtn}>
                        <Save size={18} /> Save Profile
                    </button>
                </form>
            </section>
        </div>
    );
};

const styles = {
    page: { maxWidth: '1100px', margin: '0 auto', padding: '2rem' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' },
    title: { fontSize: '2.4rem', color: 'var(--color-text)', marginBottom: '0.5rem' },
    subtitle: { color: 'var(--color-text-light)', maxWidth: '640px' },
    badge: { display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(225,29,46,0.12)', color: 'var(--color-accent)', padding: '8px 14px', borderRadius: '999px', fontWeight: '600', border: '1px solid rgba(225,29,46,0.2)' },

    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' },
    card: { background: 'var(--color-surface)', borderRadius: '16px', padding: '1.2rem', boxShadow: 'var(--shadow-sm)', display: 'flex', gap: '1rem', alignItems: 'center', border: '1px solid var(--color-border)' },
    cardIcon: { width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(225,29,46,0.12)', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    cardLabel: { color: 'var(--color-text-light)', fontSize: '0.85rem' },
    cardValue: { fontSize: '1.2rem', fontWeight: '700', color: 'var(--color-text)' },

    progressSection: { marginBottom: '2rem' },
    progressGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' },
    progressCard: { background: 'var(--color-surface)', borderRadius: '14px', padding: '1rem', border: '1px solid var(--color-border)' },
    progressLabel: { color: 'var(--color-text-light)', fontSize: '0.85rem' },
    progressValue: { color: 'var(--color-text)', fontSize: '1.1rem', fontWeight: '700' },

    formSection: { background: 'var(--color-surface)', borderRadius: '20px', padding: '2rem', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' },
    sectionTitle: { fontSize: '1.5rem', marginBottom: '1.5rem' },
    form: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
    input: { padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '1rem' },
    textarea: { padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', minHeight: '100px', fontSize: '1rem' },
    saveBtn: { alignSelf: 'flex-start', padding: '12px 20px' },
};

export default Nutrition;
