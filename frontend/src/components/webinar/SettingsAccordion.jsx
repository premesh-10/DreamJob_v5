import { useState } from 'react';

// Generic, config-driven group-with-master-toggle settings panel. Each group's master
// checkbox flips every boolean leaf in that group together; the underlying values stay
// granular so partial states are still representable. Reused by the seller's webinar
// settings tab and (Phase 7) the Host Control Panel's live feature-toggle view.
export default function SettingsAccordion({ groups, values, onChange, defaultOpenKey }) {
    const [openKey, setOpenKey] = useState(defaultOpenKey || groups[0]?.key);

    const setField = (groupKey, fieldKey, value) => {
        onChange({ ...values, [groupKey]: { ...values[groupKey], [fieldKey]: value } });
    };

    const booleanFields = (group) => group.fields.filter(f => f.type === 'boolean');

    const groupMasterValue = (group) => {
        const bFields = booleanFields(group);
        if (bFields.length === 0) return null;
        const g = values[group.key] || {};
        return bFields.every(f => !!g[f.key]);
    };

    const setGroupMaster = (group, enabled) => {
        const patch = {};
        booleanFields(group).forEach(f => { patch[f.key] = enabled; });
        onChange({ ...values, [group.key]: { ...values[group.key], ...patch } });
    };

    return (
        <div className="space-y-2.5">
            {groups.map(group => {
                const isOpen = openKey === group.key;
                const master = groupMasterValue(group);
                return (
                    <div key={group.key} className="border border-slate-200 rounded-xl overflow-hidden">
                        <button type="button" onClick={() => setOpenKey(isOpen ? null : group.key)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-slate-800">{group.label}</span>
                                {master !== null && (
                                    <label className="flex items-center gap-1.5 text-xs text-slate-400" onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" checked={master} onChange={e => setGroupMaster(group, e.target.checked)} className="w-3.5 h-3.5 accent-indigo-600" />
                                        all
                                    </label>
                                )}
                            </div>
                            <span className="text-slate-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                        </button>
                        {isOpen && (
                            <div className="p-4 space-y-3 bg-white">
                                {group.fields.map(f => (
                                    <FieldRow key={f.key} field={f} value={(values[group.key] || {})[f.key]}
                                        onChange={v => setField(group.key, f.key, v)} />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function FieldRow({ field, value, onChange }) {
    if (field.type === 'boolean') {
        return (
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
                <span className="text-slate-600">{field.label}</span>
                <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
            </label>
        );
    }
    if (field.type === 'number') {
        return (
            <label className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-600">{field.label}</span>
                <input type="number" value={value ?? ''} placeholder="—"
                    onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
                    className="w-24 px-2 py-1 border border-slate-300 rounded-lg text-sm" />
            </label>
        );
    }
    if (field.type === 'select') {
        return (
            <label className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-600">{field.label}</span>
                <select value={value} onChange={e => onChange(e.target.value)} className="px-2 py-1 border border-slate-300 rounded-lg text-sm">
                    {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            </label>
        );
    }
    return null;
}
