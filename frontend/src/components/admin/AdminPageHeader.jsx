/**
 * Consistent admin page header: gradient icon + title + subtitle + optional actions slot.
 *
 * Props:
 *   icon       — SVG <path> d-string (Heroicons 2.0 outline)
 *   iconBg     — Tailwind gradient classes, e.g. 'from-indigo-500 to-violet-600' (optional)
 *   title      — page title string
 *   subtitle   — short description string (optional)
 *   actions    — React node for right-side buttons (optional)
 */
export default function AdminPageHeader({ icon, iconBg = 'from-primary-500 to-violet-600', title, subtitle, actions }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${iconBg} flex items-center justify-center shadow-primary flex-shrink-0`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d={icon} />
                    </svg>
                </div>
                <div>
                    <h1 className="page-title">{title}</h1>
                    {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {actions && <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>}
        </div>
    );
}
