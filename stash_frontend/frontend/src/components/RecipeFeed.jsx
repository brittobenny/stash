import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, Heart, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const RecipeFeed = ({
  recipes = [],
  onLike,
  onToggleComments,
  activeCommentsId,
  commentsMap = {},
  commentDrafts = {},
  onDraftChange,
  onSubmitComment,
}) => {
  const [savedIds, setSavedIds] = useState(() => new Set());

  const handleSave = (id) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cards = useMemo(() => recipes || [], [recipes]);

  return (
    <div className="recipe-feed w-full">
      {cards.map((post) => {
        const isSaved = savedIds.has(post.id);
        return (
          <div key={post.id} className="recipe-card">
            <div className="insta-card">
              <div className="insta-header">
                <div className="insta-author">
                  <div className="insta-avatar">
                    {post.author_image ? (
                      <img src={post.author_image} alt={post.author_name} />
                    ) : (
                      <span>{(post.author_name || 'S').slice(0, 1)}</span>
                    )}
                  </div>
                  <div>
                    <strong>{post.author_name || 'Stash Chef'}</strong>
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="insta-save"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSave(post.id);
                  }}
                >
                  <Bookmark size={16} className={isSaved ? 'text-red-500' : 'text-slate-500'} />
                </button>
              </div>

              <Link to={`/customer/community/${post.id}`} className="recipe-link">
                <img
                  src={post.image || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80'}
                  alt={post.title}
                  className="insta-image"
                />
              </Link>

              <div className="insta-body">
                <div className="insta-actions">
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    className={`icon-btn ${post.is_liked ? 'active' : ''}`}
                    onClick={() => onLike?.(post)}
                  >
                    <motion.span
                      animate={{ scale: post.is_liked ? 1.15 : 1 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 18 }}
                      className="flex"
                    >
                      <Heart size={16} className={post.is_liked ? 'fill-red-500 text-red-500' : 'text-slate-600'} />
                    </motion.span>
                    {post.like_count || 0}
                  </motion.button>
                  <button className="icon-btn" onClick={() => onToggleComments?.(post.id)}>
                    <MessageCircle size={16} />
                    {post.comment_count || 0}
                  </button>
                </div>
                <div className="insta-title">{post.title}</div>
                <p className="insta-caption">
                  {post.caption || 'A fresh recipe crafted from pantry staples.'}
                </p>
                <Link to={`/customer/community/${post.id}`} className="detail-link">
                  View recipe details
                </Link>

                {activeCommentsId === post.id && (
                  <div className="insta-comments">
                    <div className="comment-input">
                      <input
                        type="text"
                        placeholder="Write a comment..."
                        value={commentDrafts[post.id] || ''}
                        onChange={(e) => onDraftChange?.(post.id, e.target.value)}
                      />
                      <button onClick={() => onSubmitComment?.(post.id)}>Post</button>
                    </div>
                    <div className="comment-list">
                      {(commentsMap[post.id] || []).map((comment) => (
                        <div key={comment.id} className="comment-item">
                          <strong className="mr-2">{comment.author_name}</strong>
                          {comment.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RecipeFeed;
