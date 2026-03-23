import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, MessageSquare, ThumbsUp, Activity, LineChart } from 'lucide-react';
import { socialService } from '../services/api';
import '../styles/global.css';
import '../styles/admin.css';

const AdminPosts = () => {
  const [reviewStatus, setReviewStatus] = useState('ALL');
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [engagementData, setEngagementData] = useState({ labels: [], likes: [], comments: [] });
  const [engagementError, setEngagementError] = useState('');

  const loadPosts = async () => {
    setError('');
    try {
      const res = await socialService.getReviewQueue(reviewStatus);
      setPosts(res.data || []);
    } catch (err) {
      setError('Failed to load recipe posts.');
      setPosts([]);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [reviewStatus]);

  useEffect(() => {
    const loadEngagement = async () => {
      setEngagementError('');
      try {
        const res = await socialService.getEngagementAnalytics({ days: 14 });
        setEngagementData(res.data || { labels: [], likes: [], comments: [] });
      } catch (err) {
        setEngagementError('Engagement analytics unavailable.');
      }
    };
    loadEngagement();
  }, []);

  const stats = useMemo(() => {
    const totalPosts = posts.length;
    const totalLikes = posts.reduce((sum, p) => sum + Number(p.like_count || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + Number(p.comment_count || 0), 0);
    const engagement = totalPosts ? Math.round(((totalLikes + totalComments) / totalPosts)) : 0;
    return { totalPosts, totalLikes, totalComments, engagement };
  }, [posts]);

  const fallbackEngagement = useMemo(() => {
    const now = new Date();
    const days = 14;
    const labels = [];
    const likes = [];
    const comments = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      labels.push(d.toLocaleDateString('default', { month: 'short', day: 'numeric' }));
      const dailyPosts = posts.filter((p) => String(p.created_at || '').slice(0, 10) === key);
      likes.push(dailyPosts.reduce((sum, p) => sum + Number(p.like_count || 0), 0));
      comments.push(dailyPosts.reduce((sum, p) => sum + Number(p.comment_count || 0), 0));
    }
    return { labels, likes, comments };
  }, [posts]);

  const engagementSeries = engagementData.labels?.length ? engagementData : fallbackEngagement;
  const engagementLabels = (engagementSeries.labels || []).map((label) => {
    const parsed = new Date(label);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return label;
  });

  const renderEngagementBars = (likes = [], comments = []) => {
    if (!likes.length) return null;
    const max = Math.max(1, ...likes, ...comments);
    return (
      <div className="admin-engagement-bars">
        {likes.map((value, idx) => {
          const likeHeight = Math.max(4, Math.round((value / max) * 120));
          const commentValue = comments[idx] || 0;
          const commentHeight = Math.max(4, Math.round((commentValue / max) * 120));
          return (
            <div key={`bar-${idx}`} className="admin-engagement-group">
              <div className="admin-bar admin-bar-like" style={{ height: `${likeHeight}px` }} />
              <div className="admin-bar admin-bar-comment" style={{ height: `${commentHeight}px` }} />
            </div>
          );
        })}
      </div>
    );
  };

  const openDetails = async (post) => {
    setSelectedPost(post);
    setComments([]);
    setDetailLoading(true);
    try {
      const res = await socialService.listComments(post.id);
      setComments(res.data || []);
    } catch {
      setComments([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReject = async (postId) => {
    const reason = window.prompt('Reason for rejection (optional):', '');
    try {
      await socialService.rejectPost(postId, reason || '');
      loadPosts();
    } catch (err) {
      setError('Failed to reject post.');
    }
  };

  const handleDelete = async (postId) => {
    const ok = window.confirm('Delete this post permanently?');
    if (!ok) return;
    try {
      await socialService.deletePost(postId);
      loadPosts();
    } catch (err) {
      setError('Failed to delete post.');
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Recipe Post Monitor</h1>
        <span className="admin-badge">
          <AlertTriangle size={16} /> Community moderation
        </span>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-metrics">
        <div className="admin-metric-card">
          <div>
            <span>Total posts</span>
            <strong>{stats.totalPosts}</strong>
          </div>
          <MessageSquare />
        </div>
        <div className="admin-metric-card">
          <div>
            <span>Total likes</span>
            <strong>{stats.totalLikes}</strong>
          </div>
          <ThumbsUp />
        </div>
        <div className="admin-metric-card">
          <div>
            <span>Total comments</span>
            <strong>{stats.totalComments}</strong>
          </div>
          <MessageSquare />
        </div>
        <div className="admin-metric-card">
          <div>
            <span>Engagement / post</span>
            <strong>{stats.engagement}</strong>
          </div>
          <Activity />
        </div>
      </div>

      <div className="admin-filter">
        <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
          <option value="ALL">All</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      <div className="admin-charts">
        <div className="admin-chart-card">
          <div className="admin-chart-head">
            <div>
              <h3>Engagement trend</h3>
              <p>Likes and comments over the last 14 days.</p>
            </div>
            <LineChart size={16} />
          </div>
          <div className="admin-chart-body">
            {engagementError && <div className="admin-muted">{engagementError}</div>}
            {renderEngagementBars(engagementSeries.likes, engagementSeries.comments)}
            <div className="admin-chart-legend">
              <span><i className="legend-dot red" /> Likes</span>
              <span><i className="legend-dot blue" /> Comments</span>
            </div>
            <div className="admin-chart-labels">
              {engagementLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>Status</th>
              <th>Likes</th>
              <th>Comments</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id}>
                <td>{post.title}</td>
                <td>{post.author_name || '--'}</td>
                <td>{post.status}</td>
                <td>{post.like_count || 0}</td>
                <td>{post.comment_count || 0}</td>
                <td>{post.created_at?.slice(0, 10) || '--'}</td>
                <td>
                  <div className="admin-actions">
                    <button className="admin-btn" onClick={() => openDetails(post)}>
                      <Eye size={14} /> View
                    </button>
                    <button className="admin-btn danger" onClick={() => handleReject(post.id)}>
                      Reject
                    </button>
                    <button className="admin-btn dark" onClick={() => handleDelete(post.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={7}>No posts in this queue.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedPost && (
        <div className="admin-modal">
          <div className="admin-modal-card">
            <div className="admin-modal-head">
              <div>
                <h3>{selectedPost.title}</h3>
                <p>{selectedPost.author_name || 'Author'}</p>
              </div>
              <button className="admin-btn" onClick={() => setSelectedPost(null)}>Close</button>
            </div>
            {selectedPost.image && (
              <img src={selectedPost.image} alt={selectedPost.title} className="admin-post-image" />
            )}
            <div className="admin-post-meta">
              <span>Likes: {selectedPost.like_count || 0}</span>
              <span>Comments: {selectedPost.comment_count || 0}</span>
              <span>Status: {selectedPost.status}</span>
            </div>
            <p>{selectedPost.caption}</p>
            <div className="admin-modal-grid">
              <div>
                <h4>Ingredients</h4>
                <ul className="admin-list">
                  {(Array.isArray(selectedPost.ingredients)
                    ? selectedPost.ingredients
                    : String(selectedPost.ingredients || '')
                        .split('\n')
                        .filter(Boolean)
                  ).map((item, idx) => (
                    <li key={`ing-${idx}`}>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Steps</h4>
                <ol className="admin-list">
                  {(Array.isArray(selectedPost.steps)
                    ? selectedPost.steps
                    : String(selectedPost.steps || '')
                        .split('\n')
                        .filter(Boolean)
                  ).map((step, idx) => (
                    <li key={`step-${idx}`}>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="admin-section">
              <h4>Comments</h4>
              {detailLoading ? (
                <p className="admin-muted">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="admin-muted">No comments yet.</p>
              ) : (
                <ul className="admin-list">
                  {comments.map((c) => (
                    <li key={c.id}>
                      <span>{c.author_name || 'User'}</span>
                      <strong>{c.text}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPosts;
