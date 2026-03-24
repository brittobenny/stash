import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, RefreshCcw, Star, PackageCheck, AlertTriangle, User, Mail, Hash, MapPin, Phone, Calendar, Activity } from 'lucide-react';
import { adminService } from '../services/api';
import '../styles/global.css';

const AdminFeedback = () => {
  const [feedback, setFeedback] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminService.listFeedback(status ? { status } : {});
      setFeedback(res.data || []);
      if (!selected && res.data?.length) {
        handleSelect(res.data[0]);
      }
    } catch (err) {
      setError('Failed to load feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]); 

  const stats = useMemo(() => {
    const total = feedback.length;
    const avg = total ? (feedback.reduce((sum, f) => sum + Number(f.rating || 0), 0) / total).toFixed(1) : 0;
    const open = feedback.filter((f) => f.status === 'OPEN').length;
    const resolved = feedback.filter((f) => f.status === 'RESOLVED').length;
    return { total, avg, open, resolved };
  }, [feedback]);

  const handleSelect = async (item) => {
    setSelected(item);
    setOrderDetail(null);
    if (!item?.order) return;
    setDetailLoading(true);
    try {
      const res = await adminService.getOrderDetail(item.order);
      setOrderDetail(res.data || null);
    } catch {
      setOrderDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 sm:p-8 lg:p-10 font-sans text-slate-800 flex flex-col">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold font-['Playfair_Display'] text-slate-900 tracking-tight">Customer Feedback</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">Review user experiences, ratings, and order issues.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm shadow-sm bg-indigo-100 text-indigo-700">
          <MessageSquare size={16} /> Support Center
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 shrink-0">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
              <MessageSquare size={24} />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium mb-1">Total Feedback</span>
            <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{stats.total}</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 text-amber-500 rounded-xl group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
              <Star size={24} />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium mb-1">Average Rating</span>
            <div className="flex items-center gap-2">
                <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{stats.avg}</strong>
                <span className="text-sm font-bold text-slate-400">/ 5.0</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-rose-100 shadow-[0_8px_30px_rgba(225,29,72,0.06)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(225,29,72,0.12)] transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300">
              <AlertTriangle size={24} />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-rose-600/80 text-sm font-bold mb-1">Open Tickets</span>
            <strong className="text-3xl font-extrabold text-rose-600 tracking-tight">{stats.open}</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 group relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <PackageCheck size={24} />
            </div>
          </div>
          <div className="flex flex-col relative z-10">
            <span className="text-slate-500 text-sm font-medium mb-1">Resolved</span>
            <strong className="text-3xl font-extrabold text-slate-900 tracking-tight">{stats.resolved}</strong>
          </div>
        </div>
      </section>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 flex-1 min-h-[600px] pb-10">
        
        {/* Left Side: List */}
        <div className="w-full lg:w-5/12 xl:w-1/3 bg-white rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <div className="flex flex-col sm:flex-row gap-3">
                    <select 
                        className="flex-1 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm cursor-pointer appearance-none"
                        value={status} 
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="OPEN">Open Pipeline</option>
                        <option value="RESOLVED">Resolved Tickets</option>
                        <option value="HIDDEN">Hidden</option>
                    </select>
                    <button 
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-500/30 hover:shadow-indigo-500/50 disabled:opacity-50 shrink-0"
                        onClick={load} 
                        disabled={loading}
                    >
                        <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {error && <div className="p-4 m-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-medium text-sm flex items-center gap-2 shrink-0"><AlertTriangle size={16}/> {error}</div>}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {feedback.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-80 gap-3 min-h-[300px]">
                        <MessageSquare size={32} />
                        <span className="text-sm font-medium">No feedback entries found.</span>
                    </div>
                ) : (
                    feedback.map((f) => (
                        <button
                            key={f.id}
                            className={`w-full text-left p-4 rounded-2xl transition-all border ${
                                selected?.id === f.id 
                                ? 'bg-indigo-50 border-indigo-200 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.2)]' 
                                : 'bg-white border-slate-100 shadow-sm hover:border-indigo-100 hover:shadow-md'
                            }`}
                            onClick={() => handleSelect(f)}
                        >
                            <div className="flex justify-between items-start mb-2 gap-2">
                                <div className="flex flex-col truncate">
                                    <strong className={`font-bold text-sm truncate ${selected?.id === f.id ? 'text-indigo-900' : 'text-slate-900'}`}>{f.user_name || 'Anonymous User'}</strong>
                                    <span className="text-xs font-medium text-slate-500 truncate">{f.user_email}</span>
                                </div>
                                <span className={`shrink-0 inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    f.status === 'OPEN' ? 'bg-rose-100 text-rose-700' : 
                                    f.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                    {f.status}
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-1 mb-2">
                                {[1,2,3,4,5].map(star => (
                                    <Star key={star} size={12} className={star <= (f.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
                                ))}
                            </div>
                            
                            {f.title && <div className={`text-sm font-bold mb-1 truncate ${selected?.id === f.id ? 'text-indigo-800' : 'text-slate-800'}`}>{f.title}</div>}
                            <p className="text-xs font-medium text-slate-500 line-clamp-2 leading-relaxed">{f.message}</p>
                        </button>
                    ))
                )}
            </div>
        </div>

        {/* Right Side: Details */}
        <div className="w-full lg:w-7/12 xl:w-2/3 bg-white rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full overflow-y-auto custom-scrollbar relative min-h-[400px]">
          {!selected ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 opacity-60 gap-4">
                <MessageSquare size={48} strokeWidth={1} />
                <span className="text-sm font-bold uppercase tracking-widest">Select an item to view details</span>
            </div>
          ) : (
            <div className="flex flex-col h-full">
                {/* Detail Header */}
                <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50 shrink-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold font-serif shrink-0 shadow-inner">
                                {(selected.user_name || 'U')[0].toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{selected.user_name || 'Anonymous Customer'}</h2>
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mt-0.5">
                                    <Mail size={14} /> {selected.user_email}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-start sm:items-end gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border shadow-sm ${
                                selected.status === 'OPEN' ? 'bg-rose-50 text-rose-600 border-rose-200' : 
                                selected.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>
                                <span className={`w-2 h-2 rounded-full ${selected.status === 'OPEN' ? 'bg-rose-500 animate-pulse' : selected.status === 'RESOLVED' ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                                {selected.status} Ticket
                            </span>
                            <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                {[1,2,3,4,5].map(star => (
                                    <Star key={star} size={14} className={star <= (selected.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Feedback Content */}
                <div className="p-6 sm:p-8 shrink-0">
                    {selected.title && <h3 className="text-xl font-bold text-slate-800 mb-4">{selected.title}</h3>}
                    <div className="bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-100 relative shadow-inner">
                        <MessageSquare size={32} className="text-slate-200 absolute top-4 right-4" />
                        <p className="text-slate-700 font-medium text-base leading-relaxed whitespace-pre-wrap">{selected.message}</p>
                    </div>
                </div>

                {/* Order Details */}
                <div className="px-6 sm:px-8 pb-8 flex-1">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-6 border-t border-slate-100 pt-8 mt-2">
                        <PackageCheck size={18} className="text-indigo-500" /> Associated Order Information
                    </h4>
                    
                    {detailLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        </div>
                    ) : orderDetail ? (
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/50">
                                <div className="p-4 flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Hash size={12}/> Order ID</span>
                                    <strong className="text-slate-800 font-mono text-sm">#{orderDetail.id || selected.order}</strong>
                                </div>
                                <div className="p-4 flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Activity size={12}/> Status</span>
                                    <strong className="text-indigo-700 font-bold text-sm uppercase">{orderDetail.status}</strong>
                                </div>
                                <div className="p-4 flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Star size={12}/> Total Amount</span>
                                    <strong className="text-emerald-600 font-bold text-sm">₹{Number(orderDetail.total_amount || 0).toFixed(2)}</strong>
                                </div>
                                <div className="p-4 flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Calendar size={12}/> Date</span>
                                    <strong className="text-slate-800 font-medium text-sm">{orderDetail.created_at ? new Date(orderDetail.created_at).toLocaleDateString() : '--'}</strong>
                                </div>
                            </div>
                            
                            <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-6 bg-white border-b border-slate-100">
                                <div className="flex-1 flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><MapPin size={12}/> Delivery Address</span>
                                    <span className="text-sm font-medium text-slate-600">{orderDetail.user_address || 'Address not provided'}</span>
                                </div>
                                <div className="flex-1 flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Phone size={12}/> Contact Phone</span>
                                    <span className="text-sm font-medium text-slate-600">{orderDetail.user_phone || 'Phone not provided'}</span>
                                </div>
                            </div>

                            <div className="p-4 sm:p-5 bg-slate-50/30">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Order Contents</span>
                                <div className="flex flex-col gap-2">
                                    {(orderDetail.items || []).map((item) => (
                                        <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm group hover:border-indigo-100 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                    x{item.quantity}
                                                </div>
                                                <span className="text-sm font-bold text-slate-800">{item.product?.name || 'Unknown Product'}</span>
                                            </div>
                                            {item.product?.price && <span className="text-sm font-bold text-slate-500">₹{(Number(item.product.price) * Number(item.quantity)).toFixed(2)}</span>}
                                        </div>
                                    ))}
                                    {(!orderDetail.items || orderDetail.items.length === 0) && (
                                        <span className="text-sm text-slate-500 italic">No items listed.</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-100 border-dashed">
                            <PackageCheck size={32} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-sm font-medium text-slate-500">No specific order details linked to this feedback.</p>
                        </div>
                    )}
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminFeedback;
