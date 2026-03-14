import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChefHat, Flame, Leaf, AlertTriangle, Save, Search, Play, Pause, Square, SkipBack, SkipForward } from 'lucide-react';
import { recipeService, shopService } from '../services/api';
import { downloadRecipePdf } from '../utils/recipePdf';
import '../styles/global.css';

const BASIC_SPICES = new Set([
    'salt', 'black salt', 'turmeric', 'turmeric powder', 'red chili', 'red chilli',
    'dry red chili', 'dry red chilli', 'green chili', 'green chilli',
    'chili powder', 'chilli powder', 'cumin', 'cumin seed', 'cumin powder', 'jeera',
    'coriander', 'coriander powder', 'dhania', 'mustard seed', 'mustard seeds', 'rai',
    'garam masala', 'black pepper', 'pepper', 'asafoetida', 'hing', 'fenugreek', 'methi',
    'fennel', 'saunf', 'cardamom', 'clove', 'cloves', 'cinnamon', 'bay leaf', 'bay leaves',
    'curry leaf', 'curry leaves', 'chili flakes', 'chilli flakes', 'red chili flakes', 'red chilli flakes',
]);

const normalizeSpiceName = (value) =>
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const isBasicSpice = (name) => BASIC_SPICES.has(normalizeSpiceName(name));

const RecipeDetail = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const [recipe, setRecipe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCookModal, setShowCookModal] = useState(false);
    const [cookList, setCookList] = useState([]);
    const [cooking, setCooking] = useState(false);
    const [cookResult, setCookResult] = useState(null);
    const [allowPartial, setAllowPartial] = useState(true);
    const [ingredientFilter, setIngredientFilter] = useState('');
    const [imageSrc, setImageSrc] = useState('');
    const [addingMissing, setAddingMissing] = useState(false);
    const [addMissingMsg, setAddMissingMsg] = useState('');
    const [scale, setScale] = useState(1);
    const [speechRate, setSpeechRate] = useState(1);
    const [isReadingSteps, setIsReadingSteps] = useState(false);
    const [isSpeechPaused, setIsSpeechPaused] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState(-1);
    const [speechMode, setSpeechMode] = useState('continuous');
    const [hoveredVoiceControl, setHoveredVoiceControl] = useState('');
    const [speechLanguage, setSpeechLanguage] = useState('en');
    const [translatedMalayalamSteps, setTranslatedMalayalamSteps] = useState([]);
    const [translationLoading, setTranslationLoading] = useState(false);
    const [translationError, setTranslationError] = useState('');
    const backTo = location.state?.from || '/customer/cook';
    const supportsSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    const stopSpeechRef = React.useRef(false);
    const speechSessionRef = React.useRef(0);
    const audioRef = React.useRef(null);

    const buildFallbackSourceUrl = (recipeName) => {
        const name = String(recipeName || '').trim().toLowerCase();
        const query = encodeURIComponent(name ? `${name} indian food recipe` : 'indian food recipe');
        return `/api/live-recipe-image/?q=${query}&fallback=${encodeURIComponent('/api/category-image/vegetable/')}`;
    };

    const buildRecipeFallback = (recipeName) => {
        return `/api/image-proxy/?fallback=${encodeURIComponent(buildFallbackSourceUrl(recipeName))}`;
    };

    const getRecipeImage = (url, recipeName) => {
        const rawUrl = String(url || '').trim();
        if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return buildRecipeFallback(recipeName);
        return `/api/image-proxy/?url=${encodeURIComponent(rawUrl)}&fallback=${encodeURIComponent(buildFallbackSourceUrl(recipeName))}`;
    };

    useEffect(() => {
        const fetchDetail = async (scaleValue) => {
            setLoading(true);
            setError('');
            try {
                const res = await recipeService.getRecipeDetail(id, scaleValue);
                setRecipe(res.data);
                if (res.data?.scale && res.data.scale !== scaleValue) {
                    setScale(Number(res.data.scale));
                }
                setImageSrc(getRecipeImage(res.data?.image_url || '', res.data?.name || ''));
                const baseList = (res.data?.ingredient_status || [])
                    .filter((item) => (item?.name || '').trim())
                    .map((item) => ({
                        name: item.name,
                        grams: Number(item.needed_g || 0),
                        have_g: Number(item.have_g || 0),
                        display: item.display,
                    }));
                setCookList(baseList);
            } catch (err) {
                setError('Failed to load recipe details.');
            } finally {
                setLoading(false);
            }
        };
        const timer = setTimeout(() => {
            fetchDetail(scale);
        }, 200);
        return () => clearTimeout(timer);
    }, [id, scale]);

    useEffect(() => {
        return () => {
            stopSpeechRef.current = true;
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current = null;
            }
            if (supportsSpeech) {
                window.speechSynthesis.cancel();
            }
        };
    }, [supportsSpeech]);

    const nutrition = recipe?.nutrition || {};
    const nutritionInsights = recipe?.nutrition_insights || {};
    const recipeSteps = useMemo(
        () => (recipe?.steps || []).filter((s) => String(s || '').trim()).slice(0, 12),
        [recipe]
    );
    const spokenSteps = useMemo(() => {
        if (speechLanguage === 'ml' && translatedMalayalamSteps.length === recipeSteps.length) {
            return translatedMalayalamSteps;
        }
        return recipeSteps;
    }, [speechLanguage, translatedMalayalamSteps, recipeSteps]);

    const totals = useMemo(() => {
        return cookList.reduce(
            (acc, item) => {
                acc.needed += Number(item.grams || 0);
                return acc;
            },
            { needed: 0 }
        );
    }, [cookList]);

    const filteredMissingIngredients = useMemo(
        () => (recipe?.missing_ingredients || []).filter((item) => item && !isBasicSpice(item)),
        [recipe]
    );

    const handleCookQuantityChange = (index, value) => {
        const next = [...cookList];
        next[index] = { ...next[index], grams: Number(value) };
        setCookList(next);
    };

    const loadMalayalamTranslation = async (stepsToTranslate = recipeSteps) => {
        if (!stepsToTranslate.length) return false;
        if (translatedMalayalamSteps.length === stepsToTranslate.length) return true;

        setTranslationLoading(true);
        setTranslationError('');
        try {
            const res = await recipeService.translateSteps(stepsToTranslate, 'ml', 'en');
            const translated = Array.isArray(res.data?.translated_steps) ? res.data.translated_steps : [];
            if (translated.length === stepsToTranslate.length) {
                setTranslatedMalayalamSteps(translated);
                return true;
            }
            setTranslationError('Malayalam translation is unavailable right now.');
            return false;
        } catch (err) {
            setTranslationError('Malayalam translation is unavailable right now.');
            return false;
        } finally {
            setTranslationLoading(false);
        }
    };

    const handleCookConfirm = async () => {
        setCooking(true);
        setCookResult(null);
        try {
            const ingredients = cookList
                .filter((i) => i.grams && i.grams > 0)
                .map((i) => ({ name: i.name, grams: i.grams }));
            const res = await recipeService.cookRecipe(recipe.id, allowPartial, ingredients, scale);
            setCookResult(res.data);
            if (res.data?.status === 'success' || res.data?.status === 'partial') {
                localStorage.setItem('pantry_refresh', Date.now().toString());
                setShowCookModal(false);
            }
        } catch (err) {
            const data = err.response?.data;
            if (data?.insufficient && !data.missing) {
                data.missing = data.insufficient;
            }
            setCookResult(data || { status: 'failed', reason: 'unknown' });
        } finally {
            setCooking(false);
        }
    };

    const handleDownloadPdf = () => {
        if (!recipe) return;
        downloadRecipePdf(recipe);
    };

    const setSpeechIdle = () => {
        setIsReadingSteps(false);
        setIsSpeechPaused(false);
    };

    const resetSpeechState = () => {
        setSpeechIdle();
        setSpeechMode('continuous');
        setActiveStepIndex(-1);
    };

    const stopReadingSteps = () => {
        stopSpeechRef.current = true;
        speechSessionRef.current += 1;
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
        if (supportsSpeech) {
            window.speechSynthesis.cancel();
        }
        resetSpeechState();
    };

    const stopMalayalamAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            if (audioRef.current._objectUrl) {
                URL.revokeObjectURL(audioRef.current._objectUrl);
            }
            audioRef.current.src = '';
            audioRef.current = null;
        }
    };

    const createMalayalamAudio = async (text, rate) => {
        const res = await recipeService.fetchStepTts(text, 'ml');
        const objectUrl = URL.createObjectURL(res.data);
        const audio = new Audio(objectUrl);
        audio._objectUrl = objectUrl;
        audio.playbackRate = rate;
        return audio;
    };

    const playMalayalamStep = async (index, rate) => {
        if (!spokenSteps.length || index < 0 || index >= spokenSteps.length) return;
        stopSpeechRef.current = false;
        const sessionId = speechSessionRef.current + 1;
        speechSessionRef.current = sessionId;
        stopMalayalamAudio();
        setIsReadingSteps(true);
        setIsSpeechPaused(false);
        setSpeechMode('single');
        setActiveStepIndex(index);
        let audio;
        try {
            audio = await createMalayalamAudio(spokenSteps[index], rate);
        } catch (err) {
            if (sessionId !== speechSessionRef.current) return;
            setTranslationError('Malayalam audio could not be played right now.');
            setSpeechIdle();
            return;
        }
        if (sessionId !== speechSessionRef.current) {
            if (audio._objectUrl) {
                URL.revokeObjectURL(audio._objectUrl);
            }
            return;
        }
        audioRef.current = audio;
        audio.onended = () => {
            if (sessionId !== speechSessionRef.current) return;
            setSpeechIdle();
        };
        audio.onerror = () => {
            if (sessionId !== speechSessionRef.current) return;
            setTranslationError('Malayalam audio could not be played right now.');
            setSpeechIdle();
        };
        audio.play().catch(() => {
            if (sessionId !== speechSessionRef.current) return;
            setTranslationError('Malayalam audio could not be played right now.');
            setSpeechIdle();
        });
    };

    const playMalayalamStepsFromIndex = async (startIndex, rate) => {
        if (!spokenSteps.length) return;
        stopSpeechRef.current = false;
        const sessionId = speechSessionRef.current + 1;
        speechSessionRef.current = sessionId;
        stopMalayalamAudio();
        setIsReadingSteps(true);
        setIsSpeechPaused(false);
        setSpeechMode('continuous');

        const playNext = async (index) => {
            if (sessionId !== speechSessionRef.current) return;
            if (stopSpeechRef.current || index >= spokenSteps.length) {
                resetSpeechState();
                return;
            }
            setActiveStepIndex(index);
            let audio;
            try {
                audio = await createMalayalamAudio(spokenSteps[index], rate);
            } catch (err) {
                if (sessionId !== speechSessionRef.current) return;
                setTranslationError('Malayalam audio could not be played right now.');
                setSpeechIdle();
                return;
            }
            if (sessionId !== speechSessionRef.current) {
                if (audio._objectUrl) {
                    URL.revokeObjectURL(audio._objectUrl);
                }
                return;
            }
            audioRef.current = audio;
            audio.onended = () => {
                if (sessionId !== speechSessionRef.current) return;
                if (stopSpeechRef.current) {
                    resetSpeechState();
                    return;
                }
                playNext(index + 1);
            };
            audio.onerror = () => {
                if (sessionId !== speechSessionRef.current) return;
                setTranslationError('Malayalam audio could not be played right now.');
                setSpeechIdle();
            };
            audio.play().catch(() => {
                if (sessionId !== speechSessionRef.current) return;
                setTranslationError('Malayalam audio could not be played right now.');
                setSpeechIdle();
            });
        };

        playNext(startIndex);
    };

    const speakSingleStep = (index, rate) => {
        if (!supportsSpeech || !spokenSteps.length || index < 0 || index >= spokenSteps.length) return;
        stopSpeechRef.current = false;
        const sessionId = speechSessionRef.current + 1;
        speechSessionRef.current = sessionId;
        window.speechSynthesis.cancel();
        setIsReadingSteps(true);
        setIsSpeechPaused(false);
        setSpeechMode('single');
        setActiveStepIndex(index);

        const utterance = new window.SpeechSynthesisUtterance(`Step ${index + 1}. ${spokenSteps[index]}`);
        utterance.rate = rate;
        utterance.pitch = 1;
        utterance.lang = speechLanguage === 'ml' ? 'ml-IN' : 'en-US';
        utterance.onend = () => {
            if (sessionId !== speechSessionRef.current) return;
            if (stopSpeechRef.current) {
                setSpeechIdle();
                return;
            }
            setSpeechIdle();
        };
        utterance.onerror = () => {
            if (sessionId !== speechSessionRef.current) return;
            setSpeechIdle();
        };
        if (speechLanguage === 'ml') {
            const voices = window.speechSynthesis.getVoices();
            const voice = voices.find((item) => String(item.lang || '').toLowerCase().startsWith('ml'));
            if (voice) utterance.voice = voice;
        }
        window.speechSynthesis.speak(utterance);
    };

    const speakStepsFromIndex = (startIndex, rate) => {
        if (!supportsSpeech || !spokenSteps.length) return;
        stopSpeechRef.current = false;
        const sessionId = speechSessionRef.current + 1;
        speechSessionRef.current = sessionId;
        window.speechSynthesis.cancel();
        setIsReadingSteps(true);
        setIsSpeechPaused(false);
        setSpeechMode('continuous');

        const speakNext = (index) => {
            if (sessionId !== speechSessionRef.current) return;
            if (stopSpeechRef.current || index >= spokenSteps.length) {
                resetSpeechState();
                return;
            }

            setActiveStepIndex(index);
            const utterance = new window.SpeechSynthesisUtterance(`Step ${index + 1}. ${spokenSteps[index]}`);
            utterance.rate = rate;
            utterance.pitch = 1;
            utterance.lang = speechLanguage === 'ml' ? 'ml-IN' : 'en-US';
            utterance.onend = () => {
                if (sessionId !== speechSessionRef.current) return;
                if (stopSpeechRef.current) {
                    resetSpeechState();
                    return;
                }
                speakNext(index + 1);
            };
            utterance.onerror = () => {
                if (sessionId !== speechSessionRef.current) return;
                setSpeechIdle();
            };
            if (speechLanguage === 'ml') {
                const voices = window.speechSynthesis.getVoices();
                const voice = voices.find((item) => String(item.lang || '').toLowerCase().startsWith('ml'));
                if (voice) utterance.voice = voice;
            }
            window.speechSynthesis.speak(utterance);
        };

        speakNext(startIndex);
    };

    const handleReadSteps = async () => {
        if (!recipeSteps.length) return;
        if (speechLanguage === 'ml') {
            const ready = await loadMalayalamTranslation(recipeSteps);
            if (!ready) return;
            const restartIndex = activeStepIndex >= 0 ? activeStepIndex : 0;
            playMalayalamStepsFromIndex(restartIndex, speechRate);
            return;
        }
        if (!supportsSpeech) return;
        const restartIndex = activeStepIndex >= 0 ? activeStepIndex : 0;
        speakStepsFromIndex(restartIndex, speechRate);
    };

    const handlePauseResume = () => {
        if (!isReadingSteps) return;
        if (speechLanguage === 'ml') {
            if (!audioRef.current) return;
            if (isSpeechPaused) {
                audioRef.current.play().catch(() => {
                    setTranslationError('Malayalam audio could not be resumed.');
                });
                setIsSpeechPaused(false);
                return;
            }
            audioRef.current.pause();
            setIsSpeechPaused(true);
            return;
        }
        if (!supportsSpeech) return;
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.paused) return;
        if (isSpeechPaused) {
            window.speechSynthesis.resume();
            setIsSpeechPaused(false);
            return;
        }
        window.speechSynthesis.pause();
        setIsSpeechPaused(true);
    };

    const handleRateChange = (rate) => {
        setSpeechRate(rate);
        if (speechLanguage === 'ml' && audioRef.current) {
            audioRef.current.playbackRate = rate;
            return;
        }
        if (isReadingSteps && supportsSpeech) {
            const restartIndex = activeStepIndex >= 0 ? activeStepIndex : 0;
            if (speechMode === 'single') {
                speakSingleStep(restartIndex, rate);
            } else {
                speakStepsFromIndex(restartIndex, rate);
            }
        }
    };

    const getVoiceButtonStyle = (buttonId) =>
        hoveredVoiceControl === buttonId
            ? { ...styles.stepActionBtn, ...styles.stepActionBtnHover }
            : styles.stepActionBtn;

    const handleStepNavigation = async (direction) => {
        if (!recipeSteps.length) return;
        if (speechLanguage === 'ml') {
            const ready = await loadMalayalamTranslation(recipeSteps);
            if (!ready) return;
            const current = activeStepIndex >= 0 ? activeStepIndex : 0;
            const nextIndex = Math.max(0, Math.min(recipeSteps.length - 1, current + direction));
            playMalayalamStep(nextIndex, speechRate);
            return;
        }
        if (!supportsSpeech) return;
        const current = activeStepIndex >= 0 ? activeStepIndex : 0;
        const nextIndex = Math.max(0, Math.min(recipeSteps.length - 1, current + direction));
        if (nextIndex === current && activeStepIndex >= 0) {
            speakSingleStep(nextIndex, speechRate);
            return;
        }
        speakSingleStep(nextIndex, speechRate);
    };

    useEffect(() => {
        stopSpeechRef.current = true;
        speechSessionRef.current += 1;
        stopMalayalamAudio();
        if (supportsSpeech) {
            window.speechSynthesis.cancel();
        }
        resetSpeechState();
    }, [id, supportsSpeech]);

    useEffect(() => {
        setTranslatedMalayalamSteps([]);
        setTranslationError('');
        setTranslationLoading(false);
        setSpeechLanguage('en');
    }, [id]);


    const handleAddMissingToCart = async () => {
        setAddingMissing(true);
        setAddMissingMsg('');
        try {
            const res = await shopService.getProducts();
            const products = res.data || [];
            const missing = filteredMissingIngredients;
            let added = 0;
            for (const item of missing) {
                const lower = String(item).toLowerCase();
                const product = products.find((p) =>
                    String(p.ingredient_name || '').toLowerCase().includes(lower) ||
                    String(p.name || '').toLowerCase().includes(lower)
                );
                if (product) {
                    await shopService.addToCart(product.id, 1);
                    added += 1;
                }
            }
            setAddMissingMsg(added > 0 ? `Added ${added} items to cart.` : 'No matching products found.');
        } catch (err) {
            setAddMissingMsg('Failed to add missing items.');
        } finally {
            setAddingMissing(false);
        }
    };

    if (loading) {
        return <div style={styles.loading}>Loading recipe...</div>;
    }

    if (error || !recipe) {
        return (
            <div style={styles.errorState}>
                <p>{error || 'Recipe not found.'}</p>
                <button style={styles.backBtn} onClick={() => navigate(backTo)}>
                    <ArrowLeft size={16} /> Back to Cook
                </button>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <button style={styles.backBtn} onClick={() => navigate(backTo)}>
                <ArrowLeft size={16} /> Back to Cook
            </button>

            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>{recipe.name}</h1>
                    <p style={styles.meta}>
                        {recipe.cuisine || 'General'} | {recipe.difficulty} | {recipe.minutes} mins
                    </p>
                    {recipe.seasonal_hint && (
                        <span style={styles.seasonalBadge}>{recipe.seasonal_hint}</span>
                    )}
                </div>
                <div style={styles.headerActions}>
                    <div style={styles.scaleControl}>
                        <span style={styles.scaleLabel}>Portion</span>
                        <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.25"
                            value={scale}
                            onChange={(e) => setScale(Number(e.target.value))}
                            style={styles.scaleRange}
                        />
                        <span style={styles.scaleValue}>{scale.toFixed(2)}x</span>
                    </div>
                    <button style={styles.secondaryBtn} onClick={handleDownloadPdf}>
                        Download PDF
                    </button>
                    <button style={styles.cookBtn} onClick={() => { setShowCookModal(true); setCookResult(null); }}>
                        <ChefHat size={18} /> Cook Recipe
                    </button>
                </div>
            </div>

            {imageSrc && (
                <div style={styles.heroImage}>
                    <img
                        src={imageSrc}
                        alt={recipe.name}
                        style={styles.heroImg}
                        onError={() => {
                            setImageSrc((prev) => {
                                const fallbackSrc = buildRecipeFallback(recipe?.name);
                                if (prev !== fallbackSrc) return fallbackSrc;
                                return '/api/category-image/vegetable/';
                            });
                        }}
                    />
                </div>
            )}

            <section style={styles.section} className="fade-up">
                <h2 style={styles.sectionTitle}>Nutrition</h2>
                <div style={styles.nutritionGrid}>
                    <div style={styles.nutritionCard} className="hover-float"><Flame size={18} /> {Math.round(nutrition.calories || 0)} kcal</div>
                    <div style={styles.nutritionCard} className="hover-float"><Leaf size={18} /> {Math.round(nutrition.protein || 0)} g protein</div>
                    <div style={styles.nutritionCard} className="hover-float">Carbs {Math.round(nutrition.carbs || 0)} g</div>
                    <div style={styles.nutritionCard} className="hover-float">Fat {Math.round(nutrition.fat || 0)} g</div>
                </div>
                <div style={styles.nutritionMetaRow}>
                    <span style={styles.nutritionScorePill}>Nutrition Score {Math.round(Number(nutritionInsights.score || recipe.nutrition_score || 0))}</span>
                    {(nutritionInsights.badges || recipe.nutrition_badges || []).map((badge, idx) => (
                        <span key={`${badge}-${idx}`} style={styles.nutritionBadge}>{badge}</span>
                    ))}
                </div>
                {(nutritionInsights.fix_my_plate || []).length > 0 && (
                    <div style={styles.fixList}>
                        {(nutritionInsights.fix_my_plate || []).map((item, idx) => (
                            <div key={`${item.metric}-${idx}`} style={styles.fixItem}>
                                <strong>{item.title}:</strong> {item.action}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section style={styles.section} className="fade-up">
                <h2 style={styles.sectionTitle}>Ingredients</h2>
                <div style={styles.searchRow}>
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search ingredient..."
                        value={ingredientFilter}
                        onChange={(e) => setIngredientFilter(e.target.value)}
                        style={styles.searchInput}
                    />
                </div>
                <div style={styles.ingredientTable}>
                    <div style={styles.ingredientHeader}>
                        <span>Ingredient</span>
                        <span>Need</span>
                        <span>Have (g)</span>
                        <span>Status</span>
                    </div>
                    {(recipe.ingredient_status || [])
                        .filter((item) => {
                            const name = (item?.name || '').trim();
                            return name && name.toLowerCase().includes(ingredientFilter.toLowerCase());
                        })
                        .map((item, idx) => {
                            const assumedSpice = Boolean(item.assumed_available) || isBasicSpice(item.name);
                            const uiStatus = assumedSpice ? 'have' : item.status;
                            return (
                                <div key={idx} style={styles.ingredientRow}>
                                    <span style={styles.ingredientName}>{item.name}</span>
                                    <span style={styles.ingredientValue}>{item.display || `${item.needed_g} g`}</span>
                                    <span style={styles.ingredientValue}>{item.have_g}</span>
                                    {uiStatus === 'have' && <span style={styles.haveBadge}>Available</span>}
                                    {uiStatus === 'partial' && <span style={styles.partialBadge}>Low stock</span>}
                                    {uiStatus === 'missing' && <span style={styles.missingBadge}>Missing</span>}
                                </div>
                            );
                        })}
                </div>
            </section>

            {recipe.insufficient_ingredients?.length > 0 && (
                <section style={styles.section} className="fade-up">
                    <h2 style={styles.sectionTitle}>Low Stock Ingredients</h2>
                    <div style={styles.availableList}>
                        {recipe.insufficient_ingredients.map((item, idx) => (
                            <span key={idx} style={styles.partialTag}>{item}</span>
                        ))}
                    </div>
                </section>
            )}

            {filteredMissingIngredients.length > 0 && (
                <section style={styles.section} className="fade-up">
                    <h2 style={styles.sectionTitle}><AlertTriangle size={18} /> Missing Ingredients</h2>
                    <div style={styles.missingList}>
                        {filteredMissingIngredients.map((item, idx) => (
                            <span key={idx} style={styles.missingTag}>{item}</span>
                        ))}
                    </div>
                    {recipe.substitution_suggestions?.length > 0 && (
                        <div style={styles.substitutionPanel}>
                            <div style={styles.substitutionTitle}>Substitution suggestions</div>
                            {recipe.substitution_suggestions.map((suggestion, idx) => (
                                <div key={`${suggestion.ingredient}-${idx}`} style={styles.substitutionRow}>
                                    <div style={styles.substitutionIngredient}>{suggestion.ingredient}</div>
                                    <div style={styles.substitutionOptions}>
                                        {suggestion.options.map((opt, optIdx) => (
                                            <span
                                                key={`${suggestion.ingredient}-${optIdx}`}
                                                style={opt.pantry_has ? styles.subOptionActive : styles.subOption}
                                            >
                                                {opt.name}{opt.note ? ` (${opt.note})` : ''}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <button style={styles.missingBtn} onClick={handleAddMissingToCart} disabled={addingMissing}>
                        {addingMissing ? 'Adding...' : 'Add Missing to Cart'}
                    </button>
                    {addMissingMsg && <div style={styles.missingMsg}>{addMissingMsg}</div>}
                </section>
            )}

            {recipe.available_ingredients?.length > 0 && (
                <section style={styles.section} className="fade-up">
                    <h2 style={styles.sectionTitle}>Ingredients You Have</h2>
                    <div style={styles.availableList}>
                        {(recipe.available_ingredients || []).filter(Boolean).map((item, idx) => (
                            <span key={idx} style={styles.haveTag}>{item}</span>
                        ))}
                    </div>
                </section>
            )}

            <section style={styles.section} className="fade-up">
                <div style={styles.stepsHeader}>
                    <h2 style={styles.sectionTitle}>Steps</h2>
                    <div style={styles.stepsControls}>
                        <div style={styles.rateGroup}>
                            {[0.5, 1, 1.5].map((rate) => (
                                <button
                                    key={rate}
                                    type="button"
                                    style={speechRate === rate ? { ...styles.rateBtn, ...styles.rateBtnActive } : styles.rateBtn}
                                    onClick={() => handleRateChange(rate)}
                                    onMouseEnter={() => setHoveredVoiceControl(`rate-${rate}`)}
                                    onMouseLeave={() => setHoveredVoiceControl('')}
                                >
                                    {rate}x
                                </button>
                            ))}
                        </div>
                        <div style={styles.rateGroup}>
                            {[{ id: 'en', label: 'English' }, { id: 'ml', label: translationLoading ? 'Malayalam...' : 'Malayalam' }].map((langOption) => (
                                <button
                                    key={langOption.id}
                                    type="button"
                                    style={speechLanguage === langOption.id ? { ...styles.rateBtn, ...styles.rateBtnActive } : styles.rateBtn}
                                    onClick={async () => {
                                        if (langOption.id === 'ml') {
                                            const ready = await loadMalayalamTranslation(recipeSteps);
                                            if (!ready) return;
                                        }
                                        setSpeechLanguage(langOption.id);
                                    }}
                                    onMouseEnter={() => setHoveredVoiceControl(`lang-${langOption.id}`)}
                                    onMouseLeave={() => setHoveredVoiceControl('')}
                                    disabled={translationLoading}
                                >
                                    {langOption.label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            style={getVoiceButtonStyle('read')}
                            onClick={handleReadSteps}
                            onMouseEnter={() => setHoveredVoiceControl('read')}
                            onMouseLeave={() => setHoveredVoiceControl('')}
                            disabled={!supportsSpeech || !recipeSteps.length}
                        >
                            <Play size={16} /> Read Steps
                        </button>
                        <button
                            type="button"
                            style={getVoiceButtonStyle('previous')}
                            onClick={() => handleStepNavigation(-1)}
                            onMouseEnter={() => setHoveredVoiceControl('previous')}
                            onMouseLeave={() => setHoveredVoiceControl('')}
                            disabled={!supportsSpeech || !recipeSteps.length}
                        >
                            <SkipBack size={16} /> Previous Step
                        </button>
                        <button
                            type="button"
                            style={getVoiceButtonStyle('next')}
                            onClick={() => handleStepNavigation(1)}
                            onMouseEnter={() => setHoveredVoiceControl('next')}
                            onMouseLeave={() => setHoveredVoiceControl('')}
                            disabled={!supportsSpeech || !recipeSteps.length}
                        >
                            <SkipForward size={16} /> Next Step
                        </button>
                        <button
                            type="button"
                            style={getVoiceButtonStyle('pause')}
                            onClick={handlePauseResume}
                            onMouseEnter={() => setHoveredVoiceControl('pause')}
                            onMouseLeave={() => setHoveredVoiceControl('')}
                            disabled={!supportsSpeech || !isReadingSteps}
                        >
                            <Pause size={16} /> {isSpeechPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button
                            type="button"
                            style={getVoiceButtonStyle('stop')}
                            onClick={stopReadingSteps}
                            onMouseEnter={() => setHoveredVoiceControl('stop')}
                            onMouseLeave={() => setHoveredVoiceControl('')}
                            disabled={!supportsSpeech || !isReadingSteps}
                        >
                            <Square size={16} /> Stop
                        </button>
                    </div>
                </div>
                {!supportsSpeech && <div style={styles.stepVoiceHint}>Voice reading is not supported in this browser.</div>}
                {supportsSpeech && translationError && <div style={styles.stepVoiceHint}>{translationError}</div>}
                {supportsSpeech && recipeSteps.length > 0 && activeStepIndex >= 0 && (
                    <div style={styles.stepVoiceHint}>
                        Current step: {activeStepIndex + 1} of {recipeSteps.length} | Audio: {speechLanguage === 'ml' ? 'Malayalam' : 'English'}
                    </div>
                )}
                <ol style={styles.stepList}>
                    {recipeSteps.map((step, idx) => (
                        <li key={idx} style={activeStepIndex === idx ? { ...styles.stepItem, ...styles.stepItemActive } : styles.stepItem}>
                            <span style={styles.stepIndexBadge}>{idx + 1}</span>
                            <span style={styles.stepText}>{step}</span>
                        </li>
                    ))}
                </ol>
            </section>

            {cookResult && (
                <div style={styles.cookResult}>
                    <div style={styles.cookResultTitle}>
                        {cookResult.status === 'success' && 'Cooked successfully'}
                        {cookResult.status === 'partial' && 'Cooked partially'}
                        {(!cookResult.status || cookResult.status === 'failed') && 'Could not cook'}
                    </div>
                    {cookResult.missing?.length > 0 && (
                        <div style={styles.cookLine}>
                            Missing: {cookResult.missing.map((m) => m.ingredient || m).join(', ')}
                        </div>
                    )}
                    {cookResult.deducted?.length > 0 && (
                        <div style={styles.cookLine}>
                            Deducted: {cookResult.deducted.map((d) => `${d.ingredient} (${d.used_g} g)`).join(', ')}
                        </div>
                    )}
                    {cookResult.nutrition_scoring && (
                        <div style={styles.cookLine}>
                            Score: {cookResult.nutrition_scoring.daily_score} today · Weekly avg {Math.round(cookResult.nutrition_scoring.weekly_score || 0)} · L{cookResult.nutrition_scoring.level} ({cookResult.nutrition_scoring.points} pts)
                        </div>
                    )}
                    {(cookResult.nutrition_insights?.badges || []).length > 0 && (
                        <div style={styles.cookLine}>
                            Badges: {(cookResult.nutrition_insights.badges || []).join(', ')}
                        </div>
                    )}
                    {(cookResult.nutrition_insights?.fix_my_plate || []).length > 0 && (
                        <div style={styles.cookLine}>
                            Next step: {cookResult.nutrition_insights.fix_my_plate[0]?.action}
                        </div>
                    )}
                </div>
            )}

            {showCookModal && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <h3>Confirm Pantry Deduction</h3>
                            <button style={styles.closeBtn} onClick={() => setShowCookModal(false)}>X</button>
                        </div>
                        <p style={styles.modalHint}>
                            Adjust quantities before cooking. This will deduct from your pantry.
                        </p>
                        <div style={styles.modalList}>
                            {cookList.map((item, idx) => (
                                <div key={idx} style={styles.modalRow}>
                                    <div>
                                        <div style={styles.modalName}>{item.name}</div>
                                        <div style={styles.modalMeta}>Need {item.display || `${item.grams} g`} | Have {item.have_g} g</div>
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={item.grams}
                                        onChange={(e) => handleCookQuantityChange(idx, e.target.value)}
                                        style={styles.modalInput}
                                    />
                                </div>
                            ))}
                        </div>
                        {cookResult && cookResult.status === 'failed' && (
                            <div style={styles.modalError}>
                                {cookResult.missing?.length > 0
                                    ? `Missing: ${cookResult.missing.map((m) => m.ingredient || m).join(', ')}`
                                    : 'Unable to cook with current quantities.'}
                            </div>
                        )}
                        <label style={styles.allowPartial}>
                            <input
                                type="checkbox"
                                checked={allowPartial}
                                onChange={(e) => setAllowPartial(e.target.checked)}
                            />
                            Allow partial cook if ingredients are missing
                        </label>
                        <div style={styles.modalFooter}>
                            <div style={styles.modalTotal}>Total to deduct: {Math.round(totals.needed)} g</div>
                            <button style={styles.confirmBtn} onClick={handleCookConfirm} disabled={cooking}>
                                <Save size={16} /> {cooking ? 'Cooking...' : 'Confirm Cook'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    page: { maxWidth: '1100px', margin: '0 auto', padding: '2rem' },
    loading: { padding: '4rem', textAlign: 'center', color: 'var(--color-text-light)' },
    errorState: { padding: '3rem', textAlign: 'center', color: 'var(--color-text-light)' },
    backBtn: { background: 'none', border: 'none', color: 'var(--color-text-light)', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', cursor: 'pointer' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' },
    headerActions: { display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' },
    title: { fontSize: '2.2rem', color: 'var(--color-text)' },
    meta: { color: 'var(--color-text-light)' },
    seasonalBadge: { display: 'inline-block', marginTop: '0.4rem', background: 'rgba(16,185,129,0.15)', color: '#0f766e', padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '700' },
    cookBtn: { background: 'var(--color-primary)', color: '#ffffff', border: 'none', padding: '10px 16px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: '700', cursor: 'pointer' },
    secondaryBtn: { background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: '10px 16px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' },
    scaleControl: { display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '8px 12px', borderRadius: '999px' },
    scaleLabel: { fontSize: '0.85rem', color: 'var(--color-text-light)' },
    scaleRange: { accentColor: 'var(--color-primary)', width: '140px' },
    scaleValue: { fontWeight: '700', color: 'var(--color-text)' },
    heroImage: { height: '260px', borderRadius: '20px', marginBottom: '2rem', border: '1px solid var(--color-border)', overflow: 'hidden', background: 'var(--color-surface-2)' },
    heroImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    section: { marginBottom: '2rem' },
    sectionTitle: { fontSize: '1.4rem', marginBottom: '0.8rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' },
    nutritionGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' },
    nutritionCard: { background: 'var(--color-surface)', borderRadius: '12px', padding: '12px', border: '1px solid var(--color-border)', display: 'flex', gap: '8px', alignItems: 'center' },
    nutritionMetaRow: { display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.8rem' },
    nutritionScorePill: { background: 'rgba(225,29,46,0.12)', color: 'var(--color-primary)', border: '1px solid rgba(225,29,46,0.24)', borderRadius: '999px', padding: '6px 10px', fontSize: '0.82rem', fontWeight: '700' },
    nutritionBadge: { background: 'rgba(17,17,17,0.08)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '6px 10px', fontSize: '0.82rem' },
    fixList: { display: 'grid', gap: '0.45rem', marginTop: '0.8rem' },
    fixItem: { background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '8px 10px', color: 'var(--color-text-light)', fontSize: '0.87rem' },
    searchRow: { display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '8px 14px', marginBottom: '1rem' },
    searchInput: { border: 'none', outline: 'none', background: 'transparent', color: 'var(--color-text)', flex: 1 },
    ingredientTable: { display: 'grid', gap: '0.6rem' },
    ingredientHeader: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', color: 'var(--color-text-light)', fontSize: '0.85rem', padding: '0 6px' },
    ingredientRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface)', borderRadius: '12px', padding: '10px', border: '1px solid var(--color-border)' },
    ingredientName: { fontWeight: '700', color: 'var(--color-text)' },
    ingredientValue: { color: 'var(--color-text-light)', fontSize: '0.9rem' },
    haveBadge: { background: 'rgba(17,17,17,0.08)', color: 'var(--color-text)', padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '700' },
    partialBadge: { background: 'rgba(245,158,11,0.18)', color: '#b45309', padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '700' },
    missingBadge: { background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '700' },
    missingList: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.8rem' },
    availableList: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
    missingTag: { background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '6px 10px', borderRadius: '999px', fontSize: '0.85rem' },
    haveTag: { background: 'rgba(17,17,17,0.08)', color: 'var(--color-text)', padding: '6px 10px', borderRadius: '999px', fontSize: '0.85rem' },
    partialTag: { background: 'rgba(245,158,11,0.16)', color: '#b45309', padding: '6px 10px', borderRadius: '999px', fontSize: '0.85rem' },
    missingBtn: { marginTop: '1rem', background: 'var(--color-primary)', color: '#ffffff', border: 'none', padding: '10px 14px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' },
    missingMsg: { marginTop: '0.6rem', color: 'var(--color-text-light)' },
    substitutionPanel: { background: 'var(--color-surface-2)', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '1rem', marginBottom: '1rem' },
    substitutionTitle: { fontWeight: '700', marginBottom: '0.6rem', color: 'var(--color-text)' },
    substitutionRow: { display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.8rem', alignItems: 'start', padding: '8px 0', borderTop: '1px dashed var(--color-border)' },
    substitutionIngredient: { fontWeight: '700', color: 'var(--color-text)' },
    substitutionOptions: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
    subOption: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '6px 10px', fontSize: '0.8rem', color: 'var(--color-text-light)' },
    subOptionActive: { background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#15803d', borderRadius: '999px', padding: '6px 10px', fontSize: '0.8rem' },
    stepsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.8rem' },
    stepsControls: { display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' },
    rateGroup: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '4px', borderRadius: '999px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' },
    rateBtn: { border: 'none', background: 'transparent', color: 'var(--color-text-light)', borderRadius: '999px', padding: '7px 10px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.18s ease' },
    rateBtnActive: { background: 'rgba(225,29,46,0.12)', color: 'var(--color-primary)' },
    stepActionBtn: { border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', borderRadius: '10px', padding: '9px 12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.18s ease' },
    stepActionBtnHover: { background: 'rgba(225,29,46,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(225,29,46,0.3)' },
    stepVoiceHint: { color: 'var(--color-text-light)', fontSize: '0.88rem', marginBottom: '0.75rem' },
    stepList: { paddingLeft: 0, margin: 0, listStyle: 'none', color: 'var(--color-text)', display: 'grid', gap: '0.75rem' },
    stepItem: { marginBottom: 0, display: 'grid', gridTemplateColumns: '38px 1fr', gap: '0.85rem', alignItems: 'flex-start', padding: '12px 14px', borderRadius: '14px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' },
    stepItemActive: { border: '1px solid rgba(225,29,46,0.34)', background: 'rgba(225,29,46,0.06)', boxShadow: '0 10px 24px rgba(225,29,46,0.08)' },
    stepIndexBadge: { width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(17,17,17,0.08)', color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' },
    stepText: { lineHeight: 1.6 },
    cookResult: { marginTop: '1.5rem', background: 'var(--color-surface)', borderRadius: '12px', padding: '12px', border: '1px solid var(--color-border)' },
    cookResultTitle: { fontWeight: '700', marginBottom: '0.4rem' },
    cookLine: { color: 'var(--color-text-light)', fontSize: '0.95rem' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
    modal: { background: 'var(--color-surface)', borderRadius: '16px', padding: '1.5rem', width: '90%', maxWidth: '520px', border: '1px solid var(--color-border)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' },
    closeBtn: { background: 'none', border: 'none', color: 'var(--color-text-light)', cursor: 'pointer', fontSize: '1.1rem' },
    modalHint: { color: 'var(--color-text-light)', marginBottom: '1rem' },
    modalList: { display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '300px', overflowY: 'auto' },
    modalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: 'var(--color-surface-2)', padding: '10px', borderRadius: '12px' },
    modalName: { fontWeight: '700' },
    modalMeta: { fontSize: '0.85rem', color: 'var(--color-text-light)' },
    modalInput: { width: '90px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)' },
    modalFooter: { marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' },
    modalTotal: { color: 'var(--color-text-light)' },
    confirmBtn: { background: 'var(--color-primary)', color: '#ffffff', border: 'none', padding: '10px 16px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' },
    allowPartial: { marginTop: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-light)' },
    modalError: { marginTop: '0.8rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' },
};

export default RecipeDetail;
