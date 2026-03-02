import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle } from 'lucide-react';
import { socialService } from '../services/api';
import '../styles/global.css';
import '../styles/social.css';

const SocialRecipeDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [post, setPost] = useState(location.state?.post || null);
  const [loading, setLoading] = useState(!location.state?.post);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await socialService.getPost(id);
        setPost(res.data);
      } catch (err) {
        setError('Failed to load recipe.');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id]);

  const ingredients = useMemo(() => {
    if (!post?.ingredients) return [];
    return post.ingredients.split('\n').map((line) => line.trim()).filter(Boolean);
  }, [post]);

  const steps = useMemo(() => {
    if (!post?.steps) return [];
    return post.steps.split('\n').map((line) => line.trim()).filter(Boolean);
  }, [post]);

  if (loading) {
    return <div className="social-loading">Loading recipe...</div>;
  }

  if (error || !post) {
    return (
      <div className="social-empty">
        {error || 'Recipe not found.'}
        <div style={{ marginTop: '1rem' }}>
          <button className="btn-secondary" onClick={() => navigate('/customer/home')}>
            <ArrowLeft size={16} /> Back to Community
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="social-page">
      <div className="social-detail">
        <button className="btn-secondary detail-back" onClick={() => navigate('/customer/home')}>
          <ArrowLeft size={16} /> Back to Community
        </button>

        <div className="detail-hero card">
          <div className="detail-hero-image">
            <img
              src={post.image || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80'}
              alt={post.title}
            />
          </div>
          <div className="detail-hero-body">
            <div className="detail-author">
              {post.author_image ? (
                <img src={post.author_image} alt={post.author_name} />
              ) : (
                <div className="avatar-fallback">{post.author_name?.[0] || 'S'}</div>
              )}
              <div>
                <strong>{post.author_name || 'Stash Chef'}</strong>
                <span>{new Date(post.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <h1>{post.title}</h1>
            {post.caption && <p className="detail-caption">{post.caption}</p>}
            <div className="detail-actions">
              <div className="detail-pill">
                <Heart size={16} /> {post.like_count || 0} likes
              </div>
              <div className="detail-pill">
                <MessageCircle size={16} /> {post.comment_count || 0} comments
              </div>
            </div>
          </div>
        </div>

        <div className="detail-grid">
          <div className="card detail-card">
            <h3>Ingredients</h3>
            {ingredients.length ? (
              <ul>
                {ingredients.map((item, idx) => (
                  <li key={`${item}-${idx}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="detail-muted">No ingredients listed yet.</p>
            )}
          </div>
          <div className="card detail-card">
            <h3>Steps</h3>
            {steps.length ? (
              <ol>
                {steps.map((item, idx) => (
                  <li key={`${item}-${idx}`}>{item}</li>
                ))}
              </ol>
            ) : (
              <p className="detail-muted">No steps provided yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialRecipeDetail;
