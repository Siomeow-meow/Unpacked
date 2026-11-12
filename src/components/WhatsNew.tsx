/* The What's New dialog (red dot until the current version has been opened). Same markup/CSS as the original. */
import { useEffect, useRef, useState } from 'react';
import { KEYS, store } from '../lib/storage';
import { CHANGELOG, LATEST_VERSION } from '../changelog';

export function WhatsNewButton() {
    const dlg = useRef<HTMLDialogElement>(null);
    const [seen, setSeen] = useState(() => store.get<string>(KEYS.whatsnew, '') === LATEST_VERSION);

    const open = () => {
        const d = dlg.current;
        if (!d) return;
        d.querySelectorAll('details.ver').forEach((x, i) => { (x as HTMLDetailsElement).open = i === 0; });   // newest open, older ones collapsed
        if (d.showModal) d.showModal(); else d.setAttribute('open', '');
        setSeen(true);
    };
    /* counts as "seen" only once the user closes it (button, click outside, Esc) */
    useEffect(() => {
        const d = dlg.current;
        if (!d) return;
        const onClose = () => store.set(KEYS.whatsnew, LATEST_VERSION);
        d.addEventListener('close', onClose);
        return () => d.removeEventListener('close', onClose);
    }, []);

    return (
        <>
            <button className="btn small newbtn" id="newBtn" type="button" aria-haspopup="dialog" onClick={open}>
                <span className="wn-text">What's New</span>
                <svg className="wn-ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></svg>
                {!seen && <i className="dot" id="newDot" />}
            </button>
            <dialog id="newDlg" ref={dlg} aria-labelledby="newTitle" onClick={e => { if (e.target === dlg.current) dlg.current?.close(); }}>
                <div className="dlgHead">
                    <h2 id="newTitle">What's New</h2>
                    <button className="btn small" id="newClose" type="button" aria-label="Close" onClick={() => dlg.current?.close()}>✕</button>
                </div>
                <div className="dlgBody">
                    {CHANGELOG.map((v, i) => (
                        <details className="ver" key={v.version} open={i === 0}>
                            <summary>
                                <span className="vt">{v.title}{v.tag && <> <span className={'tag' + (v.tag.old ? ' old' : '')}>{v.tag.text}</span></>}<small>{v.blurb}</small></span>
                                <span className="chev" aria-hidden="true" />
                            </summary>
                            <div className="vbody">
                                {v.sections.map(sec => (
                                    <div key={sec.h}>
                                        <h4>{sec.h}</h4>
                                        <ul>{sec.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: it }} />)}</ul>
                                    </div>
                                ))}
                            </div>
                        </details>
                    ))}
                </div>
            </dialog>
        </>
    );
}
