import { useEffect } from 'react';

// Real, enforceable restrictions on in-browser copy/cut/paste, right-click, and
// text selection — all genuine DOM events. This cannot stop a screenshot, an
// external recorder, or content copied before this page loaded; it only raises
// friction (and logs an attempt) for the in-browser actions it can see.
export default function useCopyPasteGuard({ disableCopyPaste, disableRightClick, disableTextSelection }, onViolation) {
    useEffect(() => {
        if (!disableCopyPaste) return;

        const block = (type) => (e) => { e.preventDefault(); onViolation(type); };
        const onCopy = block('copy');
        const onCut = block('cut');
        const onPaste = block('paste');
        document.addEventListener('copy', onCopy);
        document.addEventListener('cut', onCut);
        document.addEventListener('paste', onPaste);

        const onKeydown = (e) => {
            const mod = e.ctrlKey || e.metaKey;
            if (!mod) return;
            const key = e.key.toLowerCase();
            if (key === 'c') { e.preventDefault(); onViolation('copy'); }
            else if (key === 'x') { e.preventDefault(); onViolation('cut'); }
            else if (key === 'v') { e.preventDefault(); onViolation('paste'); }
        };
        document.addEventListener('keydown', onKeydown);

        return () => {
            document.removeEventListener('copy', onCopy);
            document.removeEventListener('cut', onCut);
            document.removeEventListener('paste', onPaste);
            document.removeEventListener('keydown', onKeydown);
        };
    }, [disableCopyPaste, onViolation]);

    useEffect(() => {
        if (!disableRightClick) return;
        const onContextMenu = (e) => { e.preventDefault(); onViolation('rightclick'); };
        document.addEventListener('contextmenu', onContextMenu);
        return () => document.removeEventListener('contextmenu', onContextMenu);
    }, [disableRightClick, onViolation]);

    useEffect(() => {
        if (!disableTextSelection) return;
        const prevUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = 'none';
        const onSelectStart = (e) => e.preventDefault();
        document.addEventListener('selectstart', onSelectStart);
        return () => {
            document.body.style.userSelect = prevUserSelect;
            document.removeEventListener('selectstart', onSelectStart);
        };
    }, [disableTextSelection]);
}
