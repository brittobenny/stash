import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Sparkles } from 'lucide-react';
import { socialService } from '../services/api';
import { normalizeName, normalizeImagePath } from '../utils/normalize';
import RecipeFeed from '../components/RecipeFeed';
import '../styles/global.css';
import '../styles/social.css';

const emptyForm = {
    title: '',
    caption: '',
    image: null,
};

const SocialHome = () => {
    const [tab, setTab] = useState('feed');
    const [feed, setFeed] = useState([]);
    const [mine, setMine] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [ingredientItems, setIngredientItems] = useState(['']);
    const [stepItems, setStepItems] = useState(['']);
    const [preview, setPreview] = useState('');
    const [activeComments, setActiveComments] = useState(null);
    const [commentsMap, setCommentsMap] = useState({});
    const [commentDrafts, setCommentDrafts] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [topIndex, setTopIndex] = useState(0);

    const [displayName, setDisplayName] = useState('Stash chef');
    const [profileImage, setProfileImage] = useState(null);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('user');
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const safeName = normalizeName(parsed.name);
            const safeImage = normalizeImagePath(parsed.image);
            setDisplayName(safeName || 'Stash chef');
            if (safeImage) {
                setProfileImage(safeImage.startsWith('http') ? safeImage : `http://127.0.0.1:8000${safeImage}`);
            } else {
                setProfileImage(null);
            }
        } catch {
            setDisplayName('Stash chef');
            setProfileImage(null);
        }
    }, []);

    const loadFeed = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await socialService.getFeed({ page_size: 12 });
            setFeed(res.data?.results || []);
        } catch (err) {
            setError('Failed to load posts.');
        } finally {
            setLoading(false);
        }
    };

    const loadMine = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await socialService.getMyPosts();
            setMine(res.data || []);
        } catch (err) {
            setError('Failed to load your posts.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tab === 'feed') loadFeed();
        else loadMine();
    }, [tab]);

    useEffect(() => {
        loadMine();
    }, []);

    const stats = useMemo(() => {
        const totalLikes = mine.reduce((acc, p) => acc + (p.like_count || 0), 0);
        const communityLikes = feed.reduce((acc, p) => acc + (p.like_count || 0), 0);
        const approvedCount = mine.filter((p) => p.status === 'APPROVED').length;
        const communityAuthors = new Set(feed.map((p) => p.author_name).filter(Boolean)).size;
        return {
            totalLikes,
            communityLikes,
            approvedCount,
            communityAuthors,
            communityPosts: feed.length,
            myPosts: mine.length,
        };
    }, [feed, mine]);

    const topPosts = useMemo(() => {
        return [...(feed || [])]
            .filter((p) => (p.like_count || 0) > 0)
            .sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
            .slice(0, 4);
    }, [feed]);

    useEffect(() => {
        if (!topPosts.length) return;
        const timer = setInterval(() => {
            setTopIndex((prev) => (prev + 1) % topPosts.length);
        }, 3500);
        return () => clearInterval(timer);
    }, [topPosts.length]);

    const handleLike = async (post) => {
        if (post.status && post.status !== 'APPROVED') {
            setError('You can like only approved posts.');
            return;
        }
        const list = tab === 'feed' ? feed : mine;
        const updateList = (next) => (tab === 'feed' ? setFeed(next) : setMine(next));

        try {
            if (post.is_liked) {
                const res = await socialService.unlikePost(post.id);
                updateList(list.map((p) => (p.id === post.id ? { ...p, is_liked: false, like_count: res.data.likes } : p)));
            } else {
                const res = await socialService.likePost(post.id);
                updateList(list.map((p) => (p.id === post.id ? { ...p, is_liked: true, like_count: res.data.likes } : p)));
            }
        } catch (err) {
            setError('Unable to update like.');
        }
    };

    const toggleComments = async (postId) => {
        if (activeComments === postId) {
            setActiveComments(null);
            return;
        }
        if (!commentsMap[postId]) {
            try {
                const res = await socialService.listComments(postId);
                setCommentsMap((prev) => ({ ...prev, [postId]: res.data || [] }));
            } catch (err) {
                setError('Failed to load comments.');
            }
        }
        setActiveComments(postId);
    };

    const submitComment = async (postId) => {
        const text = (commentDrafts[postId] || '').trim();
        if (!text) return;
        try {
            const res = await socialService.addComment(postId, text);
            setCommentsMap((prev) => ({
                ...prev,
                [postId]: [res.data, ...(prev[postId] || [])],
            }));
            setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
            const list = tab === 'feed' ? feed : mine;
            const updateList = tab === 'feed' ? setFeed : setMine;
            updateList(list.map((p) => (p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p)));
        } catch (err) {
            setError('Failed to add comment.');
        }
    };

    const handleCreatePost = async () => {
        if (!form.title.trim()) {
            setError('Title is required.');
            return;
        }
        setCreating(true);
        setError('');
        try {
            const ingredients = ingredientItems.map((i) => i.trim()).filter(Boolean).join('\n');
            const steps = stepItems.map((s) => s.trim()).filter(Boolean).join('\n');
            await socialService.createPost({
                ...form,
                ingredients,
                steps,
            });
            setMessage('Post published to the community.');
            setForm(emptyForm);
            setIngredientItems(['']);
            setStepItems(['']);
            setPreview('');
            setShowModal(false);
            setTab('mine');
            await loadMine();
        } catch (err) {
            setError('Failed to create post.');
        } finally {
            setCreating(false);
        }
    };

    const activeList = tab === 'feed' ? feed : mine;
    const filteredList = searchQuery
        ? activeList.filter((post) => {
              const q = searchQuery.toLowerCase();
              return (
                  post.title?.toLowerCase().includes(q) ||
                  post.caption?.toLowerCase().includes(q) ||
                  post.author_name?.toLowerCase().includes(q)
              );
          })
        : activeList;

    return (
        <div className="social-page">
            <div className="social-shell">
                <aside className="social-sidebar">
                    <div className="card sidebar-card">
                        <div className="sidebar-brand">STASH COMMUNITY</div>
                        <div className="profile-block">
                            <div className="profile-avatar">
                                {profileImage ? (
                                    <img src={profileImage} alt={displayName} />
                                ) : (
                                    displayName[0] || 'S'
                                )}
                            </div>
                            <div>
                                <strong>{displayName}</strong>
                                <span>Community chef</span>
                            </div>
                        </div>
                        <p className="sidebar-note">
                            Publish pantry-inspired recipes and help others cook smarter.
                        </p>
                        <div className="sidebar-stats">
                            <div>
                                <strong>{stats.myPosts}</strong>
                                <span>Posts</span>
                            </div>
                            <div>
                                <strong>{stats.totalLikes}</strong>
                                <span>Likes</span>
                            </div>
                            <div>
                                <strong>{stats.approvedCount}</strong>
                                <span>Approved</span>
                            </div>
                        </div>
                        <div className="sidebar-actions">
                            <button className="btn-primary" onClick={() => setShowModal(true)}>
                                <Plus size={16} /> New Post
                            </button>
                            <button className="btn-secondary" onClick={() => setTab('mine')}>
                                <Sparkles size={16} /> My Posts
                            </button>
                        </div>
                        <div className="sidebar-nav">
                            <button className={`nav-item ${tab === 'feed' ? 'active' : ''}`} onClick={() => setTab('feed')}>
                                Community Feed
                            </button>
                            <button className={`nav-item ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>
                                Your Recipes
                            </button>
                            <button className="nav-item" onClick={() => setShowModal(true)}>
                                Create Recipe
                            </button>
                        </div>
                    </div>
                </aside>

                <main className="social-main">
                    <section className="card saas-hero">
                        <div className="hero-text">
                            <p className="kicker">COMMUNITY FEED</p>
                            <h1>Share recipes that inspire the Stash community.</h1>
                            <p className="hero-sub">
                                Post your pantry creations, collect feedback, and build your signature recipe shelf.
                            </p>
                        </div>
                        <div className="hero-panel">
                            <div className="hero-search">
                                <Search size={16} />
                                <input
                                    type="text"
                                    placeholder="Search recipes, chefs, captions..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="hero-actions">
                            <button className="btn-primary" onClick={() => setShowModal(true)}>
                                Create Recipe
                            </button>
                            <button className="btn-secondary" onClick={() => setTab('mine')}>
                                View My Posts
                            </button>
                            </div>
                        </div>
                    </section>

                    <div className="feed-toggle">
                        <button className={`toggle-btn ${tab === 'feed' ? 'active' : ''}`} onClick={() => setTab('feed')}>
                            Community Feed
                        </button>
                        <button className={`toggle-btn ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>
                            My Recipes
                        </button>
                    </div>

                    {message && <div className="social-message">{message}</div>}
                    {error && <div className="social-error">{error}</div>}

                    {loading ? (
                        <div className="social-loading">Loading posts...</div>
                    ) : filteredList.length === 0 ? (
                        <div className="social-empty">
                            {tab === 'feed' ? 'No approved posts yet.' : 'You have not posted anything yet.'}
                        </div>
                    ) : (
                        <RecipeFeed
                            recipes={filteredList}
                            onLike={handleLike}
                            onToggleComments={toggleComments}
                            activeCommentsId={activeComments}
                            commentsMap={commentsMap}
                            commentDrafts={commentDrafts}
                            onDraftChange={(postId, value) =>
                                setCommentDrafts((prev) => ({ ...prev, [postId]: value }))
                            }
                            onSubmitComment={submitComment}
                        />
                    )}
                </main>

                <aside className="social-right">
                    <div className="card highlight-card">
                        <div className="highlight-header">
                            <h3>Top Liked Recipes</h3>
                            <span className="highlight-count">Top {topPosts.length || 0}</span>
                        </div>
                        {topPosts.length === 0 ? (
                            <p className="highlight-empty">No likes yet. Be the first to react!</p>
                        ) : (
                            <div className="highlight-slider">
                                {topPosts.map((post, idx) => (
                                    <div
                                        key={post.id}
                                        className={`highlight-item ${idx === topIndex ? 'active' : ''}`}
                                    >
                                        <div className="highlight-image">
                                            <img
                                                src={
                                                    post.image ||
                                                    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80'
                                                }
                                                alt={post.title}
                                            />
                                        </div>
                                        <div className="highlight-body">
                                            <div className="highlight-title">{post.title}</div>
                                            <div className="highlight-meta">
                                                <span>{post.author_name || 'Stash chef'}</span>
                                                <strong>{post.like_count || 0} likes</strong>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="card insight-card soft">
                        <h3>Top creators</h3>
                        <div className="follow-list">
                            {['Judy Nguyen', 'Amanda Reed', 'Billy Vasquez', 'Lori Ferguson'].map((name) => (
                                <div key={name} className="follow-item">
                                    <div className="avatar-fallback">{name[0]}</div>
                                    <div>
                                        <strong>{name}</strong>
                                        <span>Stash chef</span>
                                    </div>
                                    <button>+</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal wide">
                        <div className="modal-header">
                            <h3>Create Recipe Post</h3>
                            <button className="close-btn" onClick={() => setShowModal(false)}>
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid">
                                <div className="full">
                                    <label>Title</label>
                                    <input
                                        value={form.title}
                                        onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                                        placeholder="Recipe name"
                                    />
                                </div>
                                <div className="full">
                                    <label>Caption</label>
                                    <textarea
                                        value={form.caption}
                                        onChange={(e) => setForm((prev) => ({ ...prev, caption: e.target.value }))}
                                        placeholder="Short story or description"
                                    />
                                </div>
                                <div>
                                    <label>Ingredients (one by one)</label>
                                    <div className="list-editor">
                                        {ingredientItems.map((item, idx) => (
                                            <div key={`ing-${idx}`} className="list-row">
                                                <input
                                                    value={item}
                                                    placeholder={`Ingredient ${idx + 1}`}
                                                    onChange={(e) => {
                                                        const next = [...ingredientItems];
                                                        next[idx] = e.target.value;
                                                        setIngredientItems(next);
                                                    }}
                                                />
                                                {ingredientItems.length > 1 && (
                                                    <button
                                                        type="button"
                                                        className="icon-btn"
                                                        onClick={() => {
                                                            const next = ingredientItems.filter((_, i) => i !== idx);
                                                            setIngredientItems(next);
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => setIngredientItems((prev) => [...prev, ''])}
                                        >
                                            Add ingredient
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label>Steps (one by one)</label>
                                    <div className="list-editor">
                                        {stepItems.map((item, idx) => (
                                            <div key={`step-${idx}`} className="list-row">
                                                <input
                                                    value={item}
                                                    placeholder={`Step ${idx + 1}`}
                                                    onChange={(e) => {
                                                        const next = [...stepItems];
                                                        next[idx] = e.target.value;
                                                        setStepItems(next);
                                                    }}
                                                />
                                                {stepItems.length > 1 && (
                                                    <button
                                                        type="button"
                                                        className="icon-btn"
                                                        onClick={() => {
                                                            const next = stepItems.filter((_, i) => i !== idx);
                                                            setStepItems(next);
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => setStepItems((prev) => [...prev, ''])}
                                        >
                                            Add step
                                        </button>
                                    </div>
                                </div>
                                <div className="full">
                                    <label>Photo</label>
                                    <div className="upload-row">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0] || null;
                                                setForm((prev) => ({ ...prev, image: file }));
                                                setPreview(file ? URL.createObjectURL(file) : '');
                                            }}
                                        />
                                        {preview && <img src={preview} alt="Preview" />}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowModal(false)}>
                                Cancel
                            </button>
                            <button className="btn-primary" onClick={handleCreatePost} disabled={creating}>
                                {creating ? 'Posting...' : 'Publish to community'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SocialHome;
