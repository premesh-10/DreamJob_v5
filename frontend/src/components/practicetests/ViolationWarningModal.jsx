const CATEGORY_LABEL = {
    tab_switch: 'Tab Switch Detected',
    fullscreen_exit: 'Fullscreen Exited',
    copy_paste: 'Action Restricted',
    devtools: 'Unusual Browser State Detected',
    focus_lost: 'Window Focus Lost'
};

// Shared modal for every proctoring/security violation type. Shows the running
// tab-switch count + remaining allowance when relevant, and never claims any
// restriction is unbeatable — copy here must stay consistent with the
// disclosure text shown on the test detail page before the attempt starts.
function ViolationWarningModal({ violation, onDismiss, onReenterFullscreen }) {
    if (!violation) return null;
    const { category, tabSwitchCount, maxSwitches, remaining, policyApplied, message } = violation;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
                <div className="text-5xl mb-3">⚠️</div>
                <h2 className="text-lg font-bold text-slate-900 mb-1">{CATEGORY_LABEL[category] || 'Activity Logged'}</h2>

                {category === 'tab_switch' && maxSwitches > 0 && (
                    <p className="text-sm text-slate-600 mb-2">
                        You've used <span className="font-bold text-red-600">{tabSwitchCount}</span> of <span className="font-bold">{maxSwitches}</span> allowed tab switches.
                        {remaining !== null && remaining > 0 && <> <span className="font-bold text-emerald-600">{remaining}</span> remaining.</>}
                    </p>
                )}

                {message && <p className="text-sm text-slate-600 mb-2">{message}</p>}

                {policyApplied === 'auto_submit' && (
                    <p className="text-sm font-semibold text-red-600 mb-2">Your test has been automatically submitted due to exceeding the allowed limit.</p>
                )}
                {policyApplied === 'terminate' && (
                    <p className="text-sm font-semibold text-red-600 mb-2">Your attempt has been ended due to exceeding the allowed limit.</p>
                )}

                <p className="text-xs text-slate-400 mb-5">This event has been recorded and will appear in your assessment report.</p>

                <div className="flex gap-2">
                    {category === 'fullscreen_exit' && onReenterFullscreen && (
                        <button onClick={onReenterFullscreen} className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
                            Re-enter Fullscreen
                        </button>
                    )}
                    <button onClick={onDismiss} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200">
                        Continue Test
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ViolationWarningModal;
