import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';

// Lightweight cross-feature recommendation panel — pure query-time matching
// against existing PracticeTest fields (company/targetRole/subject/tags), no
// new model. Used on Company hub pages, Interview Experience detail pages,
// and the mock-interview booking list; each passes whichever of
// company/role/domain it actually has.
function RecommendedPracticeTests({ company, role, domain, title = '📝 Recommended Practice Tests', limit = 4, emptyHint = null }) {
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!company && !role && !domain) { setLoading(false); return; }
        setLoading(true);
        const params = { limit };
        if (company) params.company = company;
        if (role) params.role = role;
        if (domain) params.domain = domain;

        api.get('/practice-tests/recommendations', { params })
            .then(({ data }) => setTests(data.data || []))
            .catch(() => setTests([]))
            .finally(() => setLoading(false));
    }, [company, role, domain, limit]);

    if (loading) return <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" /></div>;
    if (tests.length === 0) return emptyHint ? <p className="text-sm text-slate-400 italic py-2">{emptyHint}</p> : null;

    return (
        <div>
            {title && <h3 className="text-sm font-bold text-slate-700 mb-2">{title}</h3>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {tests.map(t => (
                    <Link key={t._id} to={`/practice-tests/${t._id}`}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-violet-300 hover:bg-violet-50 transition">
                        <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{t.subject}{t.company?.name ? ` • ${t.company.name}` : ''}{t.targetRole ? ` • ${t.targetRole}` : ''}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default RecommendedPracticeTests;
