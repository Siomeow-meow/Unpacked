/* "Install app" button. Shown only where the browser offers an install prompt (Android / desktop Chrome and Edge).
   On iPhone Safari there is no prompt: use Share → Add to Home Screen. */
import { useEffect, useState } from 'react';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach(f => f()); });
    window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach(f => f()); });
}

export function InstallButton() {
    const [, bump] = useState(0);
    useEffect(() => {
        const f = () => bump(n => n + 1);
        listeners.add(f);
        return () => { listeners.delete(f); };
    }, []);
    if (!deferred) return null;
    const go = async () => {
        const e = deferred;
        if (!e) return;
        deferred = null;
        bump(n => n + 1);
        try { await e.prompt(); await e.userChoice; } catch { /* ignore */ }
    };
    return <button type="button" className="btn small" id="installBtn" onClick={go}>Install app</button>;
}
