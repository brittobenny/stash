import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, MessageSquare, ThumbsUp, Activity, LineChart, ChevronDown, Check, X, Trash2 } from 'lucide-react';
import { socialService } from '../services/api';
import '../styles/global.css';

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
      <div className="flex items-end justify-between gap-1 sm:gap-2 h-48 w-full px-2 mt-6">
        {likes.map((value, idx) => {
          const likeHeight = Math.max(4, Math.round((value / max) * 160));
          const commentValue = comments[idx] || 0;
          const commentHeight = Math.max(4, Math.round((commentValue / max) * 160));
          return (
            <div key={`bar-${idx}`} className="flex flex-col items-center justify-end w-full group cursor-pointer h-full">
              <div className="flex w-full max-w-[2.5rem] justify-center gap-0.5 items-end transition-all duration-300 relative h-full">
                
                {/* Tooltip */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                    L: {value} | C: {commentValue}
                </div>

                <div 
                    className="w-full bg-rose-400 group-hover:bg-rose-500 rounded-t-sm transition-colors" 
                    style={{ height: `${likeHeight}px`, minHeight: '4px' }}
                />
                <div 
                    className="w-full bg-indigo-400 group-hover:bg-indigo-500 rounded-t-sm transition-colors" 
                    style={{ height: `${commentHeight}px`, minHeight: '4px' }}
                />
              </div>
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
    <div className="min-h-screen bg-slate-50/50 p-6 sm:p-8 lg:p-10 font-sans text-slate-800">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Playfair_Display'] text-slate-900 tracking-tight">Community Monitor</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">Review recipes, monitor engagement, and moderate content.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm shadow-sm bg-rose-50 text-rose-600 border border-rose-100">
          <AlertTriangle size={16} /> Content Moderation
        </div>
      </header>

      {error && (
        <div className="mb-8 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-medium flex items-center gap-2 shadow-sm">
          <AlertTriangle size={20} /> {error}
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-slate-100 text-slate-600 rounded-xl group-hover:scale-110 group-hover:bg-slate-800 group-hover:text-white transition-all duration-300">
              <MessageSquare size={24} />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium mb-1">Total Posts</span>
            <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{stats.totalPosts}</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-rose-50 text-rose-500 rounded-xl group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300">
              <ThumbsUp size={24} />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium mb-1">Total Likes</span>
            <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{stats.totalLikes}</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
              <MessageSquare size={24} className="fill-current opacity-20 absolute" />
              <MessageSquare size={24} className="relative z-10" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium mb-1">Total Comments</span>
            <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{stats.totalComments}</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-[0_8px_30px_rgba(16,185,129,0.06)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(16,185,129,0.12)] transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4 relative">
            <div className="absolute -right-2 -top-2 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl"></div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 relative z-10">
              <Activity size={24} />
            </div>
          </div>
          <div className="flex flex-col relative z-10">
            <span className="text-emerald-700/80 text-sm font-bold mb-1">Engagement Rank</span>
            <strong className="text-3xl font-extrabold text-emerald-600 tracking-tight">{stats.engagement} <span className="text-sm font-medium text-emerald-500/70">avg</span></strong>
          </div>
        </div>
      </section>

      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 mb-8">
            <div className="w-full lg:w-1/3 flex flex-col justify-between">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Engagement Trend</h3>
                    <p className="text-sm text-slate-500 mb-6">Interaction volume over the last 14 days. Watch out for sudden drops.</p>
                    
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                            <span className="text-sm font-bold text-slate-700">Likes</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-indigo-400"></div>
                            <span className="text-sm font-bold text-slate-700">Comments</span>
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Filter Queue By Status</label>
                    <div className="relative">
                        <select 
                            className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all pr-10 shadow-sm"
                            value={reviewStatus} 
                            onChange={(e) => setReviewStatus(e.target.value)}
                        >
                            <option value="ALL">All Posts</option>
                            <option value="APPROVED">Approved Content</option>
                            <option value="REJECTED">Rejected Content</option>
                            <option value="PENDING">Pending Review</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <ChevronDown size={16} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full lg:w-2/3 bg-slate-50/50 rounded-2xl p-4 sm:p-6 border border-slate-200/80">
                {engagementError && <div className="text-rose-500 text-sm font-medium bg-rose-50 p-3 rounded-lg border border-rose-100 mb-4">{engagementError}</div>}
                
                {renderEngagementBars(engagementSeries.likes, engagementSeries.comments)}
                
                <div className="flex justify-between text-[10px] sm:text-xs font-bold text-slate-400 mt-4 px-2">
                    {engagementLabels.map((label, i) => (
                        <span key={label} className={i % 2 !== 0 ? 'hidden sm:inline-block' : ''}>{label}</span>
                    ))}
                </div>
            </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80">
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Title & Recipe</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Author</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Engagement</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Created</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-4">
                    <span className="font-bold text-slate-800 text-sm block max-w-[250px] truncate" title={post.title}>{post.title}</span>
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-600 truncate max-w-[150px]">{post.author_name || '--'}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex px-2.5 py-1.5 rounded-md text-[10px] font-bold tracking-wider uppercase shadow-sm ${
                        post.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        post.status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                        'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}>
                        {post.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-3">
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded"><ThumbsUp size={12} className="text-rose-400" /> {post.like_count || 0}</span>
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded"><MessageSquare size={12} className="text-indigo-400" /> {post.comment_count || 0}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-500">{post.created_at?.slice(0, 10) || '--'}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button 
                        className="flex items-center justify-center w-8 h-8 text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors border border-indigo-100" 
                        onClick={() => openDetails(post)}
                        title="Review Content"
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        className="flex items-center justify-center w-8 h-8 text-amber-600 bg-amber-50 hover:bg-amber-500 hover:text-white rounded-lg transition-colors border border-amber-100" 
                        onClick={() => handleReject(post.id)}
                        title="Reject Post"
                      >
                        <X size={16} />
                      </button>
                      <button 
                        className="flex items-center justify-center w-8 h-8 text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-lg transition-colors border border-rose-100" 
                        onClick={() => handleDelete(post.id)}
                        title="Delete Post"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500 font-medium bg-slate-50/50">
                    <div className="flex flex-col items-center justify-center opacity-70">
                        <AlertTriangle size={32} className="mb-3 text-slate-400" />
                        <span>No posts found in this queue.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPost && (
        <div className="fixed inset-0 flex items-center justify-center z-[200] p-4 sm:p-6 bg-black/50 backdrop-blur-md transition-all duration-300">
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] flex flex-col max-h-[95vh] overflow-hidden border border-slate-200">
            <div className="flex justify-between items-center p-6 sm:p-8 border-b border-slate-100 shrink-0 bg-slate-50/50">
              <div className="flex flex-col">
                <h3 className="text-2xl font-bold font-['Playfair_Display'] text-slate-900 tracking-tight">{selectedPost.title}</h3>
                <p className="text-slate-500 text-sm font-medium mt-1">by <span className="text-slate-700 font-bold">{selectedPost.author_name || 'Unknown Author'}</span></p>
              </div>
              <button 
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors shrink-0" 
                onClick={() => setSelectedPost(null)}
              >
                  <X size={24} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 sm:p-8 custom-scrollbar bg-white flex-1">
                <div className="flex flex-col lg:flex-row gap-8">
                    <div className="w-full lg:w-5/12 flex flex-col gap-6">
                        {selectedPost.image ? (
                            <div className="w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner max-h-[300px] sm:max-h-[400px]">
                                <img src={selectedPost.image} alt={selectedPost.title} className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="w-full h-48 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 shadow-inner">
                                No Image Provided
                            </div>
                        )}
                        
                        <div className="flex items-center gap-4 flex-wrap">
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-sm font-bold border border-rose-100">
                                <ThumbsUp size={16} /> {selectedPost.like_count || 0}
                            </span>
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-bold border border-indigo-100">
                                <MessageSquare size={16} /> {selectedPost.comment_count || 0}
                            </span>
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border shadow-sm ${
                                selectedPost.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                selectedPost.status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                'bg-amber-50 text-amber-600 border-amber-200'
                            }`}>
                                {selectedPost.status}
                            </span>
                        </div>

                        {selectedPost.caption && (
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 relative">
                                <MessageSquare size={24} className="text-slate-200 absolute top-4 right-4" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Caption</h4>
                                <p className="text-slate-700 font-medium text-sm leading-relaxed italic">"{selectedPost.caption}"</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="w-full lg:w-7/12 flex flex-col gap-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-6 relative">
                            <div className="absolute inset-y-0 left-1/2 w-px bg-slate-100 hidden sm:block"></div>
                            <div>
                                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-4 bg-slate-50 py-2 px-4 rounded-xl border border-slate-100">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Ingredients
                                </h4>
                                <ul className="flex flex-col gap-2.5 px-2">
                                {(Array.isArray(selectedPost.ingredients)
                                    ? selectedPost.ingredients
                                    : String(selectedPost.ingredients || '')
                                        .split('\n')
                                        .filter(Boolean)
                                ).map((item, idx) => (
                                    <li key={`ing-${idx}`} className="flex items-start gap-3 group">
                                        <div className="min-w-5 min-h-5 w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mt-0.5 border border-emerald-100 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                            <Check size={12} strokeWidth={3} />
                                        </div>
                                        <span className="text-sm font-medium text-slate-600 leading-relaxed">{item}</span>
                                    </li>
                                ))}
                                </ul>
                            </div>
                            
                            <div>
                                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-4 bg-slate-50 py-2 px-4 rounded-xl border border-slate-100">
                                    <span className="w-2 h-2 rounded-full bg-indigo-400"></span> Recipe Steps
                                </h4>
                                <ol className="flex flex-col gap-3 px-2">
                                {(Array.isArray(selectedPost.steps)
                                    ? selectedPost.steps
                                    : String(selectedPost.steps || '')
                                        .split('\n')
                                        .filter(Boolean)
                                ).map((step, idx) => (
                                    <li key={`step-${idx}`} className="flex gap-3 group">
                                        <div className="min-w-6 min-h-6 w-6 h-6 rounded bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                            {idx + 1}
                                        </div>
                                        <span className="text-sm font-medium text-slate-600 leading-relaxed pt-0.5">{step}</span>
                                    </li>
                                ))}
                                </ol>
                            </div>
                        </div>

                        <div className="mt-4 pt-8 border-t border-slate-100">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-4">
                                <MessageSquare size={18} className="text-slate-400" /> User Comments
                            </h4>
                            {detailLoading ? (
                                <div className="flex justify-center py-6">
                                    <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                </div>
                            ) : comments.length === 0 ? (
                                <div className="bg-slate-50 rounded-xl p-6 text-center border border-slate-100 border-dashed">
                                    <p className="text-sm font-medium text-slate-500">No community comments yet.</p>
                                </div>
                            ) : (
                                <ul className="flex flex-col gap-3">
                                {comments.map((c) => (
                                    <li key={c.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1.5">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{c.author_name || 'Anonymous User'}</span>
                                        <strong className="text-sm font-medium text-slate-700 font-sans">{c.text}</strong>
                                    </li>
                                ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex justify-between items-center p-6 border-t border-slate-100 shrink-0 bg-slate-50/50">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:block">Review Panel</span>
                <div className="flex gap-3 w-full sm:w-auto justify-end">
                    <button 
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-2" 
                        onClick={() => {
                            handleReject(selectedPost.id);
                            setSelectedPost(null);
                        }}
                    >
                        <X size={16} /> Reject Content
                    </button>
                    <button 
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-sm" 
                        onClick={() => setSelectedPost(null)}
                    >
                        Close View
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPosts;
