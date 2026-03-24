import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChefHat, Flame, Leaf, AlertTriangle, Save, Search, Play, Pause, Square, SkipBack, SkipForward } from 'lucide-react';
import { recipeService, shopService } from '../services/api';
import { downloadRecipePdf } from '../utils/recipePdf';
import '../styles/global.css';
import '../styles/recipeDetail.css';

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
                sessionStorage.setItem('pantry_refresh', Date.now().toString());
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
        return (
            <div className="recipe-detail-page">
                <div className="recipe-loading">Loading recipe...</div>
            </div>
        );
    }

    if (error || !recipe) {
        return (
            <div className="recipe-detail-page">
                <div className="recipe-error-card">
                    <p>{error || 'Recipe not found.'}</p>
                    <button className="recipe-back-btn" onClick={() => navigate(backTo)}>
                        <ArrowLeft size={16} /> Back to Cook
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="recipe-detail-page">
            <div className="recipe-detail-container">
                <button className="recipe-back-btn" onClick={() => navigate(backTo)}>
                    <ArrowLeft size={16} /> Back to Cook
                </button>

                <div className="recipe-hero-grid">
                    <div className="recipe-hero-info">
                        <span className="recipe-hero-eyebrow">Cook Studio</span>
                        <h1 className="recipe-title">{recipe.name}</h1>
                        <p className="recipe-meta">
                            {recipe.cuisine || 'General'} | {recipe.difficulty} | {recipe.minutes} mins
                        </p>
                        {recipe.seasonal_hint && (
                            <span className="recipe-seasonal">{recipe.seasonal_hint}</span>
                        )}
                        <div className="recipe-hero-actions">
                            <div className="recipe-scale">
                                <span className="recipe-scale-label">Portion</span>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="3"
                                    step="0.25"
                                    value={scale}
                                    onChange={(e) => setScale(Number(e.target.value))}
                                    className="recipe-scale-range"
                                />
                                <span className="recipe-scale-value">{scale.toFixed(2)}x</span>
                            </div>
                            <button className="recipe-btn-outline" onClick={handleDownloadPdf}>
                                Download PDF
                            </button>
                            <button className="recipe-btn-primary" onClick={() => { setShowCookModal(true); setCookResult(null); }}>
                                <ChefHat size={18} /> Cook Recipe
                            </button>
                        </div>
                        <div className="recipe-hero-chips">
                            <span className="recipe-chip">
                                <ChefHat size={14} /> {recipe.difficulty}
                            </span>
                            <span className="recipe-chip">
                                <Flame size={14} /> {Math.round(nutrition.calories || 0)} kcal
                            </span>
                            <span className="recipe-chip">
                                <Leaf size={14} /> {Math.round(nutrition.protein || 0)} g protein
                            </span>
                        </div>
                    </div>

                    {imageSrc && (
                        <div className="recipe-hero-media">
                            <img
                                src={imageSrc}
                                alt={recipe.name}
                                className="recipe-hero-img"
                                onError={() => {
                                    setImageSrc((prev) => {
                                        const fallbackSrc = buildRecipeFallback(recipe?.name);
                                        if (prev !== fallbackSrc) return fallbackSrc;
                                        return '/api/category-image/vegetable/';
                                    });
                                }}
                            />
                            <div className="recipe-hero-overlay">
                                <span className="recipe-hero-chip">{recipe.cuisine || 'Global cuisine'}</span>
                                <span className="recipe-hero-chip">{recipe.minutes} min</span>
                                <span className="recipe-hero-chip">{Math.round(nutrition.calories || 0)} kcal</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="recipe-body-grid">
                    <div className="recipe-main">
                        <section className="recipe-section-card fade-up">
                            <h2 className="recipe-section-title">Nutrition</h2>
                            <div className="recipe-nutrition-grid">
                                <div className="recipe-nutrition-card hover-float"><Flame size={18} /> {Math.round(nutrition.calories || 0)} kcal</div>
                                <div className="recipe-nutrition-card hover-float"><Leaf size={18} /> {Math.round(nutrition.protein || 0)} g protein</div>
                                <div className="recipe-nutrition-card hover-float">Carbs {Math.round(nutrition.carbs || 0)} g</div>
                                <div className="recipe-nutrition-card hover-float">Fat {Math.round(nutrition.fat || 0)} g</div>
                            </div>
                            <div className="recipe-nutrition-meta">
                                <span className="recipe-pill-score">Nutrition Score {Math.round(Number(nutritionInsights.score || recipe.nutrition_score || 0))}</span>
                                {(nutritionInsights.badges || recipe.nutrition_badges || []).map((badge, idx) => (
                                    <span key={`${badge}-${idx}`} className="recipe-pill">{badge}</span>
                                ))}
                            </div>
                            {(nutritionInsights.fix_my_plate || []).length > 0 && (
                                <div className="recipe-fix-list">
                                    {(nutritionInsights.fix_my_plate || []).map((item, idx) => (
                                        <div key={`${item.metric}-${idx}`} className="recipe-fix-item">
                                            <strong>{item.title}:</strong> {item.action}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {(recipe.insufficient_ingredients?.length > 0 || filteredMissingIngredients.length > 0 || recipe.available_ingredients?.length > 0) && (
                            <div className="recipe-alert-grid">
                                {recipe.insufficient_ingredients?.length > 0 && (
                                    <section className="recipe-section-card fade-up">
                                        <h2 className="recipe-section-title">Low Stock Ingredients</h2>
                                        <div className="recipe-tag-list">
                                            {recipe.insufficient_ingredients.map((item, idx) => (
                                                <span key={idx} className="recipe-tag is-low">{item}</span>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {filteredMissingIngredients.length > 0 && (
                                    <section className="recipe-section-card fade-up">
                                        <h2 className="recipe-section-title"><AlertTriangle size={18} /> Missing Ingredients</h2>
                                        <div className="recipe-tag-list">
                                            {filteredMissingIngredients.map((item, idx) => (
                                                <span key={idx} className="recipe-tag is-missing">{item}</span>
                                            ))}
                                        </div>
                                        {recipe.substitution_suggestions?.length > 0 && (
                                            <div className="recipe-sub-panel">
                                                <div className="recipe-sub-title">Substitution suggestions</div>
                                                {recipe.substitution_suggestions.map((suggestion, idx) => (
                                                    <div key={`${suggestion.ingredient}-${idx}`} className="recipe-sub-row">
                                                        <div className="recipe-sub-ingredient">{suggestion.ingredient}</div>
                                                        <div className="recipe-sub-options">
                                                            {suggestion.options.map((opt, optIdx) => (
                                                                <span
                                                                    key={`${suggestion.ingredient}-${optIdx}`}
                                                                    className={`recipe-chip ${opt.pantry_has ? 'is-active' : ''}`}
                                                                >
                                                                    {opt.name}{opt.note ? ` (${opt.note})` : ''}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <button className="recipe-btn-primary" onClick={handleAddMissingToCart} disabled={addingMissing}>
                                            {addingMissing ? 'Adding...' : 'Add Missing to Cart'}
                                        </button>
                                        {addMissingMsg && <div className="recipe-muted">{addMissingMsg}</div>}
                                    </section>
                                )}

                                {recipe.available_ingredients?.length > 0 && (
                                    <section className="recipe-section-card fade-up">
                                        <h2 className="recipe-section-title">Ingredients You Have</h2>
                                        <div className="recipe-tag-list">
                                            {(recipe.available_ingredients || []).filter(Boolean).map((item, idx) => (
                                                <span key={idx} className="recipe-tag is-have">{item}</span>
                                            ))}
                                        </div>
                                    </section>
                                )}
                            </div>
                        )}

                        <div className="recipe-ingredients-steps">
                        <section className="recipe-section-card fade-up recipe-ingredients-card">
                            <h2 className="recipe-section-title">Ingredients</h2>
                            <div className="recipe-search">
                                <Search size={16} />
                                <input
                                    type="text"
                                    placeholder="Search ingredient..."
                                    value={ingredientFilter}
                                    onChange={(e) => setIngredientFilter(e.target.value)}
                                    className="recipe-search-input"
                                />
                            </div>
                            <div className="recipe-ingredient-table">
                                <div className="recipe-ingredient-header">
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
                                            <div key={idx} className="recipe-ingredient-row">
                                                <span className="recipe-ingredient-name">{item.name}</span>
                                                <span className="recipe-ingredient-value">{item.display || `${item.needed_g} g`}</span>
                                                <span className="recipe-ingredient-value">{item.have_g}</span>
                                                {uiStatus === 'have' && <span className="recipe-status-pill is-have">Available</span>}
                                                {uiStatus === 'partial' && <span className="recipe-status-pill is-low">Low stock</span>}
                                                {uiStatus === 'missing' && <span className="recipe-status-pill is-missing">Missing</span>}
                                            </div>
                                        );
                                    })}
                            </div>
                        </section>

                        <section className="recipe-section-card fade-up recipe-steps-card">
                            <div className="recipe-steps-header">
                                <h2 className="recipe-section-title">Steps</h2>
                                <div className="recipe-steps-controls">
                                    <div className="recipe-rate-group">
                                        {[0.5, 1, 1.5].map((rate) => (
                                            <button
                                                key={rate}
                                                type="button"
                                                className={`recipe-rate-btn ${speechRate === rate ? 'is-active' : ''}`}
                                                onClick={() => handleRateChange(rate)}
                                            >
                                                {rate}x
                                            </button>
                                        ))}
                                    </div>
                                    <div className="recipe-rate-group">
                                        {[{ id: 'en', label: 'English' }, { id: 'ml', label: translationLoading ? 'Malayalam...' : 'Malayalam' }].map((langOption) => (
                                            <button
                                                key={langOption.id}
                                                type="button"
                                                className={`recipe-rate-btn ${speechLanguage === langOption.id ? 'is-active' : ''}`}
                                                onClick={async () => {
                                                    if (langOption.id === 'ml') {
                                                        const ready = await loadMalayalamTranslation(recipeSteps);
                                                        if (!ready) return;
                                                    }
                                                    setSpeechLanguage(langOption.id);
                                                }}
                                                disabled={translationLoading}
                                            >
                                                {langOption.label}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        className="recipe-voice-btn"
                                        onClick={handleReadSteps}
                                        disabled={!supportsSpeech || !recipeSteps.length}
                                    >
                                        <Play size={16} /> Read Steps
                                    </button>
                                    <button
                                        type="button"
                                        className="recipe-voice-btn"
                                        onClick={() => handleStepNavigation(-1)}
                                        disabled={!supportsSpeech || !recipeSteps.length}
                                    >
                                        <SkipBack size={16} /> Previous Step
                                    </button>
                                    <button
                                        type="button"
                                        className="recipe-voice-btn"
                                        onClick={() => handleStepNavigation(1)}
                                        disabled={!supportsSpeech || !recipeSteps.length}
                                    >
                                        <SkipForward size={16} /> Next Step
                                    </button>
                                    <button
                                        type="button"
                                        className="recipe-voice-btn"
                                        onClick={handlePauseResume}
                                        disabled={!supportsSpeech || !isReadingSteps}
                                    >
                                        <Pause size={16} /> {isSpeechPaused ? 'Resume' : 'Pause'}
                                    </button>
                                    <button
                                        type="button"
                                        className="recipe-voice-btn"
                                        onClick={stopReadingSteps}
                                        disabled={!supportsSpeech || !isReadingSteps}
                                    >
                                        <Square size={16} /> Stop
                                    </button>
                                </div>
                            </div>
                            {!supportsSpeech && <div className="recipe-voice-hint">Voice reading is not supported in this browser.</div>}
                            {supportsSpeech && translationError && <div className="recipe-voice-hint">{translationError}</div>}
                            {supportsSpeech && recipeSteps.length > 0 && activeStepIndex >= 0 && (
                                <div className="recipe-voice-hint">
                                    Current step: {activeStepIndex + 1} of {recipeSteps.length} | Audio: {speechLanguage === 'ml' ? 'Malayalam' : 'English'}
                                </div>
                            )}
                            <ol className="recipe-step-list">
                                {recipeSteps.map((step, idx) => (
                                    <li key={idx} className={`recipe-step-item ${activeStepIndex === idx ? 'is-active' : ''}`}>
                                        <span className="recipe-step-index">{idx + 1}</span>
                                        <span className="recipe-step-text">{step}</span>
                                    </li>
                                ))}
                            </ol>
                        </section>
                        </div>
                    </div>
                </div>

                {cookResult && (
                    <div className="recipe-cook-result">
                        <div className="recipe-cook-title">
                            {cookResult.status === 'success' && 'Cooked successfully'}
                            {cookResult.status === 'partial' && 'Cooked partially'}
                            {(!cookResult.status || cookResult.status === 'failed') && 'Could not cook'}
                        </div>
                        {cookResult.missing?.length > 0 && (
                            <div className="recipe-muted">
                                Missing: {cookResult.missing.map((m) => m.ingredient || m).join(', ')}
                            </div>
                        )}
                        {cookResult.deducted?.length > 0 && (
                            <div className="recipe-muted">
                                Deducted: {cookResult.deducted.map((d) => `${d.ingredient} (${d.used_g} g)`).join(', ')}
                            </div>
                        )}
                        {cookResult.nutrition_scoring && (
                            <div className="recipe-muted">
                                Score: {cookResult.nutrition_scoring.daily_score} today | Weekly avg {Math.round(cookResult.nutrition_scoring.weekly_score || 0)} | L{cookResult.nutrition_scoring.level} ({cookResult.nutrition_scoring.points} pts)
                            </div>
                        )}
                        {(cookResult.nutrition_insights?.badges || []).length > 0 && (
                            <div className="recipe-muted">
                                Badges: {(cookResult.nutrition_insights.badges || []).join(', ')}
                            </div>
                        )}
                        {(cookResult.nutrition_insights?.fix_my_plate || []).length > 0 && (
                            <div className="recipe-muted">
                                Next step: {cookResult.nutrition_insights.fix_my_plate[0]?.action}
                            </div>
                        )}
                    </div>
                )}

                {showCookModal && (
                    <div className="recipe-modal-overlay">
                        <div className="recipe-modal">
                            <div className="recipe-modal-header">
                                <h3>Confirm Pantry Deduction</h3>
                                <button className="recipe-modal-close" onClick={() => setShowCookModal(false)}>X</button>
                            </div>
                            <p className="recipe-muted">
                                Adjust quantities before cooking. This will deduct from your pantry.
                            </p>
                            <div className="recipe-modal-list">
                                {cookList.map((item, idx) => (
                                    <div key={idx} className="recipe-modal-row">
                                        <div>
                                            <div className="recipe-modal-name">{item.name}</div>
                                            <div className="recipe-modal-meta">Need {item.display || `${item.grams} g`} | Have {item.have_g} g</div>
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={item.grams}
                                            onChange={(e) => handleCookQuantityChange(idx, e.target.value)}
                                            className="recipe-modal-input"
                                        />
                                    </div>
                                ))}
                            </div>
                            {cookResult && cookResult.status === 'failed' && (
                                <div className="recipe-modal-error">
                                    {cookResult.missing?.length > 0
                                        ? `Missing: ${cookResult.missing.map((m) => m.ingredient || m).join(', ')}`
                                        : 'Unable to cook with current quantities.'}
                                </div>
                            )}
                            <label className="recipe-allow">
                                <input
                                    type="checkbox"
                                    checked={allowPartial}
                                    onChange={(e) => setAllowPartial(e.target.checked)}
                                />
                                Allow partial cook if ingredients are missing
                            </label>
                            <div className="recipe-modal-footer">
                                <div className="recipe-muted">Total to deduct: {Math.round(totals.needed)} g</div>
                                <button className="recipe-btn-primary" onClick={handleCookConfirm} disabled={cooking}>
                                    <Save size={16} /> {cooking ? 'Cooking...' : 'Confirm Cook'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

};

export default RecipeDetail;
