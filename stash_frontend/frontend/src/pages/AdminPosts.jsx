import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { socialService } from '../services/api';
import '../styles/global.css';
import '../styles/admin.css';

const AdminPosts = () => {
  const [reviewStatus, setReviewStatus] = useState('ALL');
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');

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

      <div className="admin-filter">
        <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
          <option value="ALL">All</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>Status</th>
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
                <td>{post.created_at?.slice(0, 10) || '--'}</td>
                <td>
                  <div className="admin-actions">
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
                <td colSpan={5}>No posts in this queue.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPosts;
