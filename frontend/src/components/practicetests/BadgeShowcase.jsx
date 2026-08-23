// Grid of badge cards — earned badges shown in full color, badges the user
// hasn't earned yet (when `allBadges` is supplied) shown dimmed as a goal to
// work towards. With no `allBadges`, just renders the earned set.
function BadgeShowcase({ earnedBadges = [], allBadges = [] }) {
    const earnedIds = new Set(earnedBadges.map(ub => (ub.badge?._id || ub._id)?.toString()));
    const list = allBadges.length > 0 ? allBadges : earnedBadges.map(ub => ub.badge).filter(Boolean);

    if (list.length === 0) {
        return <p className="text-center text-slate-400 text-sm py-10">No badges to show yet.</p>;
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {list.map(b => {
                const earned = earnedIds.has(b._id?.toString());
                return (
                    <div key={b._id} className={`rounded-2xl border p-4 text-center transition ${earned ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50 opacity-50'}`}>
                        <div className="text-4xl mb-2">
                            {b.iconUrl ? <img src={b.iconUrl} alt={b.name} className="w-10 h-10 mx-auto object-contain" /> : '🏆'}
                        </div>
                        <p className="text-sm font-bold text-slate-800">{b.name}</p>
                        {b.description && <p className="text-xs text-slate-500 mt-1">{b.description}</p>}
                        {!earned && <p className="text-xs text-slate-400 italic mt-1.5">Not yet earned</p>}
                    </div>
                );
            })}
        </div>
    );
}

export default BadgeShowcase;
