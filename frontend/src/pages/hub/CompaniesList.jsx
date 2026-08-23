import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';

const FILE_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';
const logoUrl = (logo) => !logo ? null : (logo.startsWith('http') ? logo : `${FILE_BASE}${logo}`);

function CompaniesList() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [sort, setSort] = useState('trending');
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/companies', { params: { search: search || undefined, sort } });
            setCompanies(data.data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchCompanies(); }, [sort]);
    useEffect(() => {
        const t = setTimeout(() => { setSearchParams(search ? { search } : {}); fetchCompanies(); }, 400);
        return () => clearTimeout(t);
    }, [search]);

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Companies</h1>
                        <p className="text-slate-500 mt-1">Browse interview experiences company-wise</p>
                    </div>
                    <Link to="/interview-hub/submit" className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition">+ Share Your Experience</Link>
                </div>

                <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies..."
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none w-full md:w-72" />
                    <div className="flex gap-2">
                        {[['trending', 'Most Experiences'], ['newest', 'Newest'], ['name', 'A-Z']].map(([val, label]) => (
                            <button key={val} onClick={() => setSort(val)} className={`px-3 py-2.5 rounded-full text-xs font-semibold ${sort === val ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{label}</button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : companies.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 text-slate-400">No companies found.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {companies.map(c => (
                            <Link key={c._id} to={`/interview-hub/companies/${c.slug}`} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {c.logo ? <img src={logoUrl(c.logo)} alt={c.name} className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-slate-500">{c.name?.charAt(0)}</span>}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-900 truncate">{c.name}{c.isVerified && <span className="ml-1 text-primary-500" title="Verified">✓</span>}</p>
                                    <p className="text-xs text-slate-400">{c.stats?.totalExperiences || 0} experiences • {c.selectionRate ?? 0}% selection rate</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

        </>
    );
}

export default CompaniesList;
