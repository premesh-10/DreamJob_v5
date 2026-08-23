import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { load } from '@cashfreepayments/cashfree-js';
import api from '../lib/api';

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced', 'All Levels'];

function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDate(d) {
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(d) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function useCountdown(date, time) {
    const [diff, setDiff] = useState(null);
    useEffect(() => {
        const calc = () => {
            if (!date || !time) return;
            const [h, m] = time.split(':').map(Number);
            const target = new Date(date);
            target.setHours(h, m, 0, 0);
            const delta = target - new Date();
            setDiff(delta > 0 ? delta : 0);
        };
        calc();
        const t = setInterval(calc, 1000);
        return () => clearInterval(t);
    }, [date, time]);
    if (diff === null || diff <= 0) return null;
    const days    = Math.floor(diff / 86400000);
    const hours   = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${seconds}s`;
}

function StatusBadge({ status, size = 'sm' }) {
    const map = {
        upcoming:  { cls: 'bg-blue-100 text-blue-700',           label: 'Upcoming' },
        live:      { cls: 'bg-emerald-100 text-emerald-700',     label: 'Live', live: true },
        completed: { cls: 'bg-slate-100 text-slate-500',         label: 'Ended' },
        cancelled: { cls: 'bg-red-100 text-red-600',             label: 'Cancelled' },
    };
    const s = map[status] || { cls: 'bg-slate-100 text-slate-500', label: status };
    return (
        <span className={`inline-flex items-center gap-1 font-bold rounded-full ${size === 'xs' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-0.5'} ${s.cls}`}>
            {s.live && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />}
            {s.label}
        </span>
    );
}

function SeatsBar({ left, capacity }) {
    const pct = capacity > 0 ? Math.min(100, ((capacity - left) / capacity) * 100) : 0;
    const color = left === 0 ? 'bg-red-500' : left < capacity * 0.2 ? 'bg-amber-400' : 'bg-emerald-500';
    return (
        <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span className={`font-semibold ${left === 0 ? 'text-red-600' : left < capacity * 0.2 ? 'text-amber-600' : 'text-slate-700'}`}>
                    {left === 0 ? 'Full' : `${left} seats left`}
                </span>
                <span>{capacity} total</span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// ── Shared action button ────────────────────────────────────────────────────
function ActionBtn({ w, isRegistered, isWaitlisted, isFull, isCancelled, isEnded, onRegister, onUnregister, registering, compact }) {
    const base = compact
        ? 'px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-60 transition flex-shrink-0'
        : 'px-4 py-2 text-sm font-bold rounded-xl disabled:opacity-60 transition';
    if (isCancelled) return <span className={`${base} bg-red-50 text-red-400`}>Cancelled</span>;
    if (isEnded)     return <span className={`${base} bg-slate-100 text-slate-400`}>Ended</span>;
    if (isRegistered) return w.roomName ? (
        <Link to={`/webinar-room/${w._id}`} onClick={e => e.stopPropagation()} className={`${base} bg-indigo-600 text-white hover:bg-indigo-700`}>Join</Link>
    ) : (
        <button onClick={e => { e.stopPropagation(); onUnregister(w._id); }} disabled={registering === w._id}
            className={`${base} bg-emerald-100 text-emerald-700 hover:bg-red-50 hover:text-red-600`}>
            {registering === w._id ? '…' : '✓ Registered'}
        </button>
    );
    if (isWaitlisted) return (
        <button onClick={e => { e.stopPropagation(); onUnregister(w._id); }} disabled={registering === w._id}
            className={`${base} bg-amber-50 text-amber-700 hover:bg-red-50 hover:text-red-600`}>
            {registering === w._id ? '…' : 'Waitlisted'}
        </button>
    );
    return (
        <button onClick={e => { e.stopPropagation(); onRegister(w); }} disabled={registering === w._id}
            className={`${base} ${isFull ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20'}`}>
            {registering === w._id ? '…' : isFull ? '+ Waitlist' : compact ? 'Register' : `Register${w.price > 0 ? ` · ₹${w.price}` : ' · Free'}`}
        </button>
    );
}

// ── Thumbnail block ─────────────────────────────────────────────────────────
function Thumb({ w, className }) {
    const bg = w.isFeatured
        ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500'
        : 'bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600';
    return w.thumbnail
        ? <img src={w.thumbnail} alt={w.name} className={`object-cover ${className}`} />
        : <div className={`${bg} ${className} flex items-center justify-center`}>
            <svg className="w-8 h-8 sm:w-12 sm:h-12 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
          </div>;
}

// ── Card: mobile = horizontal row / sm+ = vertical grid card ───────────────
function WebinarCard({ w, onRegister, onUnregister, registering, myRegs, myWaitlist, onOpen }) {
    const countdown = useCountdown(w.date, w.time);
    const isRegistered = myRegs.has(w._id);
    const isWaitlisted = myWaitlist.has(w._id);
    const isFull       = w.seatsLeft <= 0;
    const isCancelled  = w.status === 'cancelled';
    const isEnded      = w.status === 'completed';
    const actionProps  = { w, isRegistered, isWaitlisted, isFull, isCancelled, isEnded, onRegister, onUnregister, registering };

    const borderCls = isCancelled
        ? 'border-red-200 opacity-75'
        : isRegistered ? 'border-indigo-300 ring-1 ring-indigo-200'
        : 'border-slate-200 hover:border-indigo-200 hover:shadow-lg';

    return (
        <div onClick={() => onOpen(w)} className={`group cursor-pointer bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${borderCls}`}>

            {/* ── Mobile: horizontal list row ── */}
            <div className="flex sm:hidden items-stretch min-h-[88px]">
                <div className="relative w-[88px] flex-shrink-0">
                    <Thumb w={w} className="w-full h-full" />
                    {w.status === 'live' && (
                        <div className="absolute inset-0 bg-emerald-500/10 flex items-start justify-start p-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ring-2 ring-white" />
                        </div>
                    )}
                </div>
                <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <StatusBadge status={w.status} size="xs" />
                            {w.price > 0
                                ? <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">₹{w.price}</span>
                                : <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Free</span>}
                            {isRegistered && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">Registered</span>}
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1 group-hover:text-indigo-700 transition">{w.name}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {formatDateShort(w.date)} · {formatTime(w.time)}
                            {countdown && !isCancelled && <span className="text-indigo-500 font-semibold"> · {countdown}</span>}
                        </p>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 gap-2">
                        <span className="text-[11px] text-slate-400 truncate flex-1">{w.seller?.name}</span>
                        <ActionBtn {...actionProps} compact />
                    </div>
                </div>
            </div>

            {/* ── Tablet / Desktop: vertical card ── */}
            <div className="hidden sm:flex flex-col h-full">
                <div className="relative h-44 overflow-hidden flex-shrink-0">
                    <Thumb w={w} className="w-full h-full group-hover:scale-105 transition duration-500" />
                    <div className="absolute top-3 left-3 flex flex-col gap-1">
                        <StatusBadge status={w.status} />
                        {w.isFeatured && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-400 text-white shadow">Featured</span>}
                    </div>
                    <div className="absolute top-3 right-3">
                        {w.price > 0
                            ? <span className="bg-white/90 backdrop-blur text-slate-900 text-xs font-bold px-2.5 py-1 rounded-full shadow">₹{w.price}</span>
                            : <span className="bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">Free</span>}
                    </div>
                    {countdown && !isCancelled && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/80 to-transparent px-3 py-2">
                            <p className="text-white text-xs font-medium">Starts in <span className="font-bold">{countdown}</span></p>
                        </div>
                    )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide truncate">{w.category}</span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full ml-2 flex-shrink-0">{w.level}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base mb-1.5 line-clamp-2 group-hover:text-indigo-700 transition">{w.name}</h3>
                    <p className="text-xs text-slate-400 mb-3 line-clamp-2 flex-1">{w.description}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-500 mb-3">
                        <span>{formatDate(w.date)}</span>
                        <span>{formatTime(w.time)}</span>
                        <span>{w.duration} min</span>
                        <span>{w.numberOfDays} day{w.numberOfDays > 1 ? 's' : ''}</span>
                        <span className="col-span-2 flex items-center justify-between">
                            <span>by <span className="font-medium text-slate-700">{w.seller?.name}</span></span>
                            <span className="text-slate-400">{w.language}</span>
                        </span>
                    </div>
                    <SeatsBar left={w.seatsLeft} capacity={w.seatCapacity} />
                    {w.waitlistCount > 0 && !isRegistered && (
                        <p className="text-xs text-amber-600 mt-1">{w.waitlistCount} on waitlist</p>
                    )}
                    <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                        <ActionBtn {...actionProps} compact />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Featured carousel card (mobile snap-scroll) ─────────────────────────────
function FeaturedCarouselCard({ w, onRegister, onUnregister, registering, myRegs, myWaitlist, onOpen }) {
    const countdown   = useCountdown(w.date, w.time);
    const isRegistered = myRegs.has(w._id);
    const isWaitlisted = myWaitlist.has(w._id);
    const isFull       = w.seatsLeft <= 0;
    const isCancelled  = w.status === 'cancelled';
    const isEnded      = w.status === 'completed';
    const actionProps  = { w, isRegistered, isWaitlisted, isFull, isCancelled, isEnded, onRegister, onUnregister, registering };

    return (
        <div onClick={() => onOpen(w)} className={`flex-shrink-0 w-[280px] cursor-pointer bg-white rounded-2xl border overflow-hidden shadow-sm transition-all hover:shadow-lg
            ${isRegistered ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200'}`}>
            <div className="relative h-40 overflow-hidden">
                <Thumb w={w} className="w-full h-full" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent" />
                <div className="absolute top-3 left-3 flex gap-1.5">
                    <StatusBadge status={w.status} size="xs" />
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-white">Featured</span>
                </div>
                <div className="absolute top-3 right-3">
                    {w.price > 0
                        ? <span className="bg-white/90 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-full">₹{w.price}</span>
                        : <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Free</span>}
                </div>
                {countdown && <div className="absolute bottom-3 left-3">
                    <span className="text-white text-xs font-semibold">Starts in <span className="text-emerald-300">{countdown}</span></span>
                </div>}
            </div>
            <div className="p-4">
                <h3 className="font-bold text-slate-900 text-sm line-clamp-2 mb-1 leading-snug">{w.name}</h3>
                <p className="text-[11px] text-slate-400 mb-3">{formatDateShort(w.date)} · {formatTime(w.time)} · by {w.seller?.name}</p>
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">{w.seatsLeft > 0 ? `${w.seatsLeft} seats left` : 'Full'}</span>
                    <ActionBtn {...actionProps} compact />
                </div>
            </div>
        </div>
    );
}

// ── Detail modal: bottom-sheet on mobile, centered on sm+ ──────────────────
function DetailModal({ w, onClose, isRegistered, isWaitlisted, onRegister, onUnregister, registering }) {
    const countdown = useCountdown(w.date, w.time);
    const isFull      = w.seatsLeft <= 0;
    const isCancelled = w.status === 'cancelled';
    const isEnded     = w.status === 'completed';
    const actionProps = { w, isRegistered, isWaitlisted, isFull, isCancelled, isEnded, onRegister, onUnregister, registering };

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4"
            onClick={onClose}>
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}>
                {/* Drag handle — mobile only */}
                <div className="sm:hidden flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-slate-300" />
                </div>

                {/* Header image */}
                <div className="relative h-44 sm:h-52 flex-shrink-0 overflow-hidden sm:rounded-t-3xl">
                    <Thumb w={w} className="w-full h-full" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent" />
                    <button onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 bg-black/40 backdrop-blur text-white rounded-full flex items-center justify-center hover:bg-black/60 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                    {countdown && (
                        <div className="absolute bottom-0 left-0 right-0 px-5 py-3">
                            <span className="text-white text-sm font-medium">Starts in <span className="font-bold text-emerald-300">{countdown}</span></span>
                        </div>
                    )}
                </div>

                <div className="p-5 sm:p-7 space-y-5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{w.category}</span>
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{w.level}</span>
                        </div>
                        <StatusBadge status={w.status} />
                    </div>

                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{w.name}</h2>
                        <p className="text-slate-500 text-sm mt-2 leading-relaxed">{w.description}</p>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-2.5">
                        {[
                            { label: 'Date',     val: formatDate(w.date) },
                            { label: 'Time',     val: formatTime(w.time) },
                            { label: 'Duration', val: `${w.duration} min` },
                            { label: 'Days',     val: `${w.numberOfDays} day${w.numberOfDays > 1 ? 's' : ''}` },
                            { label: 'Host',     val: w.seller?.name },
                            { label: 'Price',    val: w.price > 0 ? `₹${w.price}` : 'Free' },
                            { label: 'Language', val: w.language },
                            { label: 'Level',    val: w.level },
                        ].map(m => (
                            <div key={m.label} className="bg-slate-50 rounded-xl p-3">
                                <p className="text-xs text-slate-400 mb-0.5">{m.label}</p>
                                <p className="font-semibold text-slate-800 text-sm truncate">{m.val}</p>
                            </div>
                        ))}
                    </div>

                    <SeatsBar left={w.seatsLeft} capacity={w.seatCapacity} />
                    {w.waitlistCount > 0 && <p className="text-xs text-amber-600 font-medium">{w.waitlistCount} people on the waitlist</p>}

                    {/* Tags */}
                    {w.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {w.tags.map(t => <span key={t} className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">{t}</span>)}
                        </div>
                    )}

                    {/* Recording */}
                    {isEnded && w.recordingUrl && (
                        <a href={w.recordingUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 p-3 bg-violet-50 border border-violet-200 rounded-xl text-violet-700 font-semibold text-sm hover:bg-violet-100 transition">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z"/></svg>
                            Watch Recording
                        </a>
                    )}

                    {/* Cancellation notice */}
                    {isCancelled && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            <p className="font-semibold mb-0.5">Webinar Cancelled</p>
                            {w.cancellationReason && <p className="text-xs opacity-80">{w.cancellationReason}</p>}
                            {w.refundIssued && <p className="text-xs text-emerald-600 mt-1 font-medium">Refunds have been issued</p>}
                        </div>
                    )}

                    {/* Join link */}
                    {isRegistered && !isEnded && !isCancelled && (
                        w.roomName ? (
                            <Link to={`/webinar-room/${w._id}`}
                                className="flex items-center justify-center gap-2 p-3.5 bg-indigo-600 rounded-xl text-white font-semibold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/25">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                                Join Webinar
                            </Link>
                        ) : w.meetingLink ? (
                            <a href={w.meetingLink} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-semibold text-sm hover:bg-emerald-100 transition">
                                Join Meeting
                            </a>
                        ) : null
                    )}

                    {/* CTA */}
                    {!isCancelled && !isEnded && (
                        isRegistered ? (
                            <div className="space-y-2.5">
                                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-semibold text-center flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                    You're registered
                                </div>
                                <button onClick={() => { onUnregister(w._id); onClose(); }} disabled={registering === w._id}
                                    className="w-full py-2 text-red-500 text-sm font-medium hover:text-red-700 transition">
                                    Cancel my registration
                                </button>
                            </div>
                        ) : isWaitlisted ? (
                            <div className="space-y-2.5">
                                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm font-semibold text-center">
                                    On the waitlist — we'll notify you if a seat opens
                                </div>
                                <button onClick={() => { onUnregister(w._id); onClose(); }} disabled={registering === w._id}
                                    className="w-full py-2 text-slate-500 text-sm font-medium hover:text-red-600 transition">
                                    Leave waitlist
                                </button>
                            </div>
                        ) : (
                            <ActionBtn {...actionProps} />
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Loading skeletons ───────────────────────────────────────────────────────
function Skeletons() {
    return (
        <>
            {/* Mobile: horizontal skeleton rows */}
            <div className="sm:hidden space-y-3">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-3 items-center bg-white rounded-2xl border border-slate-100 p-3 animate-pulse">
                        <div className="w-[88px] h-[72px] bg-slate-200 rounded-xl flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 bg-slate-200 rounded w-3/4" />
                            <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                            <div className="h-2.5 bg-slate-100 rounded w-2/3" />
                        </div>
                    </div>
                ))}
            </div>
            {/* Tablet/Desktop: card grid skeletons */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
                        <div className="h-44 bg-slate-200" />
                        <div className="p-5 space-y-3">
                            <div className="h-3 bg-slate-200 rounded w-1/3" />
                            <div className="h-4 bg-slate-200 rounded w-3/4" />
                            <div className="h-3 bg-slate-100 rounded w-full" />
                            <div className="h-3 bg-slate-100 rounded w-2/3" />
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

// ── Section label ───────────────────────────────────────────────────────────
function SectionLabel({ icon, children, count }) {
    return (
        <div className="flex items-center gap-2 mb-4">
            <span className="text-base">{icon}</span>
            <h2 className="text-base font-bold text-slate-800">{children}</h2>
            {count !== undefined && (
                <span className="ml-1 text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{count}</span>
            )}
        </div>
    );
}

// ── Webinar grid + featured carousel ───────────────────────────────────────
function WebinarGrid({ featured, regular, onRegister, onUnregister, registering, myRegs, myWaitlist, onOpen }) {
    const cardProps = { onRegister, onUnregister, registering, myRegs, myWaitlist, onOpen };
    return (
        <div className="space-y-8">
            {/* Featured */}
            {featured.length > 0 && (
                <div>
                    <SectionLabel icon="⭐" count={featured.length}>Featured Webinars</SectionLabel>

                    {/* Mobile: horizontal snap scroll */}
                    <div className="sm:hidden -mx-4 px-4 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                        {featured.map(w => (
                            <div key={w._id} className="snap-start">
                                <FeaturedCarouselCard w={w} {...cardProps} />
                            </div>
                        ))}
                    </div>

                    {/* Tablet+: grid */}
                    <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {featured.map(w => <WebinarCard key={w._id} w={w} {...cardProps} />)}
                    </div>
                </div>
            )}

            {/* Regular */}
            {regular.length > 0 && (
                <div>
                    {featured.length > 0 && <SectionLabel icon="📅" count={regular.length}>All Webinars</SectionLabel>}

                    {/* Mobile: vertical list */}
                    <div className="sm:hidden space-y-3">
                        {regular.map(w => <WebinarCard key={w._id} w={w} {...cardProps} />)}
                    </div>

                    {/* Tablet+: grid */}
                    <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {regular.map(w => <WebinarCard key={w._id} w={w} {...cardProps} />)}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function Webinars() {
    const { user }    = useSelector(s => s.auth);
    const navigate    = useNavigate();
    const [webinars, setWebinars]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [search, setSearch]             = useState('');
    const [category, setCategory]         = useState('All');
    const [level, setLevel]               = useState('All');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selected, setSelected]         = useState(null);
    const [registering, setRegistering]   = useState(null);
    const [myRegs, setMyRegs]             = useState(new Set());
    const [myWaitlist, setMyWaitlist]     = useState(new Set());
    const [toast, setToast]               = useState(null);
    const [tab, setTab]                   = useState('browse');
    const [myWebinars, setMyWebinars]     = useState({ registered: [], waitlisted: [] });
    const [cashfree, setCashfree]         = useState(null);
    const pendingOrderRef = useRef(null);

    useEffect(() => {
        load({ mode: import.meta.env.VITE_CASHFREE_ENVIRONMENT === 'PRODUCTION' ? 'production' : 'sandbox' })
            .then(cf => setCashfree(cf)).catch(err => console.error('[Cashfree] SDK load failed:', err));
    }, []);

    const cats = ['All', ...Array.from(new Set(webinars.map(w => w.category))).filter(Boolean)];

    useEffect(() => {
        fetchWebinars();
        if (user) fetchMyRegs();
    }, [user]);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchWebinars = async () => {
        try {
            const res = await api.get('/webinars');
            setWebinars(res.data.data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchMyRegs = async () => {
        try {
            const res = await api.get('/webinars/my-registrations');
            const { registered = [], waitlisted = [] } = res.data.data || {};
            setMyRegs(new Set(registered.map(w => w._id)));
            setMyWaitlist(new Set(waitlisted.map(w => w._id)));
            setMyWebinars({ registered, waitlisted });
        } catch (e) {}
    };

    const handleRegister = async (w) => {
        if (!user) { showToast('Please log in to register', 'error'); return; }
        setRegistering(w._id);
        try {
            if (w.price > 0) {
                let cf = cashfree;
                if (!cf) {
                    cf = await load({ mode: import.meta.env.VITE_CASHFREE_ENVIRONMENT === 'PRODUCTION' ? 'production' : 'sandbox' });
                    setCashfree(cf);
                }
                const { data } = await api.post('/payments/create-checkout-session', { type: 'webinar', itemId: w._id });
                pendingOrderRef.current = { orderId: data.orderId, type: 'webinar', amount: data.orderAmount };
                cf.checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: '_self' });
            } else {
                const res = await api.post(`/webinars/${w._id}/register`);
                const { status: regStatus, meetingLink, waitlistPosition } = res.data;
                if (regStatus === 'waitlisted') {
                    setMyWaitlist(prev => new Set([...prev, w._id]));
                    showToast(`Added to waitlist — position #${waitlistPosition}`);
                } else {
                    setMyRegs(prev => new Set([...prev, w._id]));
                    setWebinars(prev => prev.map(x => x._id === w._id ? { ...x, seatsLeft: Math.max(0, x.seatsLeft - 1), registeredCount: (x.registeredCount || 0) + 1 } : x));
                    showToast('Successfully registered! Check your meeting link.');
                }
                if (selected?._id === w._id) setSelected(prev => ({ ...prev, isRegistered: true, seatsLeft: Math.max(0, prev.seatsLeft - 1), meetingLink: meetingLink || prev.meetingLink }));
                fetchMyRegs();
                setRegistering(null);
            }
        } catch (err) {
            const existingOrderId = err.response?.data?.existingOrderId;
            if (existingOrderId) { navigate(`/payment-status?order_id=${existingOrderId}&type=webinar&itemId=${w._id}`); return; }
            showToast(err.response?.data?.message || 'Registration failed', 'error');
            setRegistering(null);
        }
    };

    const handleUnregister = async (id) => {
        setRegistering(id);
        try {
            const res = await api.delete(`/webinars/${id}/register`);
            setMyRegs(prev => { const s = new Set(prev); s.delete(id); return s; });
            setMyWaitlist(prev => { const s = new Set(prev); s.delete(id); return s; });
            setWebinars(prev => prev.map(x => x._id === id ? { ...x, seatsLeft: x.seatsLeft + 1 } : x));
            showToast(res.data.message || 'Unregistered');
            fetchMyRegs();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to unregister', 'error');
        } finally { setRegistering(null); }
    };

    const filtered = webinars.filter(w => {
        const q = search.toLowerCase();
        return (w.name?.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q) || w.seller?.name?.toLowerCase().includes(q))
            && (category === 'All' || w.category === category)
            && (level === 'All' || w.level === level)
            && (statusFilter === 'all' || w.status === statusFilter);
    });

    const featured = filtered.filter(w => w.isFeatured && w.status !== 'cancelled');
    const regular  = filtered.filter(w => !w.isFeatured || w.status === 'cancelled');

    const cardProps = { onRegister: handleRegister, onUnregister: handleUnregister, registering, myRegs, myWaitlist, onOpen: setSelected };

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-5 sm:space-y-8">

                {/* ── Toast ── */}
                {toast && (
                    <div className={`fixed bottom-6 right-4 sm:right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-semibold flex items-center gap-2
                        ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            {toast.type === 'error'
                                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                : <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />}
                        </svg>
                        {toast.msg}
                    </div>
                )}

                {/* ── Hero ── */}
                <div className="relative overflow-hidden bg-gradient-hero rounded-2xl p-5 sm:p-10 text-white">
                    <div className="absolute -top-10 -right-10 w-52 h-52 bg-white/[0.05] rounded-full hidden sm:block" />
                    <div className="absolute bottom-0 -left-8 w-40 h-40 bg-violet-600/30 rounded-full hidden sm:block" />
                    <div className="relative">
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-xs text-white/80 font-medium">Expert-led live sessions</span>
                                </div>
                                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-1.5">Live Webinars</h1>
                                <p className="text-indigo-200 text-sm sm:text-base max-w-md hidden sm:block">Join industry experts in real-time and level up your skills.</p>
                            </div>
                        </div>

                        {/* Stats — horizontal scroll on mobile, grid on desktop */}
                        <div className="mt-4 -mx-5 px-5 sm:mx-0 sm:px-0 flex gap-3 overflow-x-auto sm:overflow-visible sm:grid sm:grid-cols-4 pb-1 sm:pb-0 scrollbar-hide">
                            {[
                                { val: webinars.filter(w => w.status === 'live').length,     label: 'Live Now',  accent: 'text-emerald-300' },
                                { val: webinars.filter(w => w.status === 'upcoming').length, label: 'Upcoming',  accent: 'text-sky-300' },
                                { val: webinars.filter(w => w.isFeatured).length,            label: 'Featured',  accent: 'text-amber-300' },
                                { val: webinars.filter(w => w.price === 0).length,           label: 'Free',      accent: 'text-violet-300' },
                            ].map(s => (
                                <div key={s.label} className="flex-shrink-0 sm:flex-shrink bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2.5 text-center min-w-[90px] sm:min-w-0">
                                    <p className={`text-xl sm:text-2xl font-bold ${s.accent}`}>{s.val}</p>
                                    <p className="text-indigo-200 text-xs mt-0.5">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Tabs ── */}
                {user && (
                    <div className="flex gap-1 border-b border-slate-200">
                        {[
                            { id: 'browse', label: 'Browse All' },
                            { id: 'mine',   label: `My Webinars${myRegs.size + myWaitlist.size > 0 ? ` (${myRegs.size + myWaitlist.size})` : ''}` },
                        ].map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-colors ${tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── My Webinars tab ── */}
                {tab === 'mine' && user && (
                    <div className="space-y-8">
                        <div>
                            <SectionLabel icon="✅" count={myWebinars.registered.length}>Registered</SectionLabel>
                            {myWebinars.registered.length === 0 ? (
                                <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                    <p className="text-slate-400 text-sm">You haven't registered for any webinars yet.</p>
                                    <button onClick={() => setTab('browse')} className="mt-2 text-indigo-600 font-semibold text-sm hover:underline">Browse webinars →</button>
                                </div>
                            ) : (
                                <>
                                    <div className="sm:hidden space-y-3">
                                        {myWebinars.registered.map(w => <WebinarCard key={w._id} w={w} {...cardProps} />)}
                                    </div>
                                    <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {myWebinars.registered.map(w => <WebinarCard key={w._id} w={w} {...cardProps} />)}
                                    </div>
                                </>
                            )}
                        </div>
                        {myWebinars.waitlisted.length > 0 && (
                            <div>
                                <SectionLabel icon="⏳" count={myWebinars.waitlisted.length}>Waitlisted</SectionLabel>
                                <>
                                    <div className="sm:hidden space-y-3">
                                        {myWebinars.waitlisted.map(w => <WebinarCard key={w._id} w={w} {...cardProps} />)}
                                    </div>
                                    <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {myWebinars.waitlisted.map(w => <WebinarCard key={w._id} w={w} {...cardProps} />)}
                                    </div>
                                </>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Browse tab ── */}
                {tab === 'browse' && (
                    <div className="space-y-4 sm:space-y-5">
                        {/* Filters */}
                        <div className="space-y-3">
                            {/* Search full-width */}
                            <div className="relative">
                                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                </svg>
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search webinars, hosts…"
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-sm bg-white" />
                            </div>

                            {/* Status + Level in a row */}
                            <div className="flex gap-2">
                                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                                    className="flex-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-400 bg-white">
                                    <option value="all">All Statuses</option>
                                    <option value="upcoming">Upcoming</option>
                                    <option value="live">Live Now</option>
                                </select>
                                <select value={level} onChange={e => setLevel(e.target.value)}
                                    className="flex-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-400 bg-white">
                                    {LEVELS.map(l => <option key={l}>{l}</option>)}
                                </select>
                            </div>

                            {/* Category pills — horizontal scroll on mobile */}
                            <div className="-mx-4 sm:mx-0 px-4 sm:px-0 flex gap-2 overflow-x-auto pb-1 scrollbar-hide sm:flex-wrap">
                                {cats.map(c => (
                                    <button key={c} onClick={() => setCategory(c)}
                                        className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all
                                            ${category === c ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'}`}>
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Results */}
                        {loading ? (
                            <Skeletons />
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-16 sm:py-20">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                    </svg>
                                </div>
                                <p className="text-slate-700 font-bold text-lg">No webinars found</p>
                                <p className="text-slate-400 text-sm mt-1">Try adjusting your filters</p>
                                <button onClick={() => { setSearch(''); setCategory('All'); setLevel('All'); setStatusFilter('all'); }}
                                    className="mt-4 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition">
                                    Clear filters
                                </button>
                            </div>
                        ) : (
                            <WebinarGrid featured={featured} regular={regular} {...cardProps} />
                        )}
                    </div>
                )}
            </div>

            {/* ── Detail modal ── */}
            {selected && (
                <DetailModal
                    w={selected}
                    onClose={() => setSelected(null)}
                    isRegistered={myRegs.has(selected._id)}
                    isWaitlisted={myWaitlist.has(selected._id)}
                    onRegister={handleRegister}
                    onUnregister={handleUnregister}
                    registering={registering}
                />
            )}

        </>
    );
}
