/* "Install app" button. Shown only where the browser offers an install prompt (Android / desktop Chrome and Edge).
   It opens an in-app dialog first; the browser's own small confirm (which no page can restyle) comes after "Install".
   On iPhone Safari there is no prompt: use Share → Add to Home Screen. */
import { useEffect, useRef, useState } from 'react';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach(f => f()); });
    window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach(f => f()); });
}

export function InstallButton() {
    const [, bump] = useState(0);
    const dlg = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const f = () => bump(n => n + 1);
        listeners.add(f);
        return () => { listeners.delete(f); };
    }, []);
    /* already running as an installed app: nothing to install */
    const standalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    if (standalone) return null;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const open = () => { const d = dlg.current; if (d) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); } };
    const close = () => dlg.current?.close();
    const install = async () => {
        const e = deferred;
        close();
        if (!e) return;
        deferred = null;
        bump(n => n + 1);
        try { await e.prompt(); await e.userChoice; } catch { /* ignore */ }
    };
    return (
        <>
            <button type="button" className="btn small" id="installBtn" aria-haspopup="dialog" onClick={open}>Install app</button>
            <dialog id="installDlg" ref={dlg} aria-labelledby="installTitle" onClick={e => { if (e.target === dlg.current) close(); }}>
                <div className="dlgHead">
                    <h2 id="installTitle">Install Unpacked</h2>
                    <button className="btn small" type="button" aria-label="Close" onClick={close}>✕</button>
                </div>
                <div className="installBody">
                    <img src={import.meta.env.BASE_URL + 'icon-192.png'} width="64" height="64" alt="" />
                    <p>Add Unpacked to your device. It opens in its own window like an app and works offline.</p>
                    <ul>
                        <li>Opens in one tap from your home screen or desktop</li>
                        <li>All lessons available without internet</li>
                        <li>Your saved problems stay on this device</li>
                    </ul>
                    {!deferred && (
                        <p className="installHow">
                            {ios
                                ? <>On iPhone or iPad: tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>.</>
                                : <>Open your browser menu (⋮ or ⋯) and choose <b>Install app</b> or <b>Add to Home screen</b>. If you don't see it, this browser may not support installing.</>}
                        </p>
                    )}
                    <div className="installActions">
                        <button type="button" className="btn" onClick={close}>{deferred ? 'Not now' : 'Close'}</button>
                        {deferred && <button type="button" className="btn primary" onClick={install}>Install</button>}
                    </div>
                </div>
            </dialog>
        </>
    );
}
