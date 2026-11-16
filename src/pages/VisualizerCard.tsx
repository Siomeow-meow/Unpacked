/* The code visualizer on the DSA lessons page: write or paste any C code and watch it run step by step. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KEYS, store } from '../lib/storage';
import { openVisualizer } from '../home/data';
import { PLAYGROUND_STARTER } from '../lessons/dsa/lessons';

const startCode = (): string => {
    const s = store.get<{ edits?: Record<string, string> } | null>(KEYS.lesson('visualizer'), null);
    return (s && s.edits && s.edits['playground.c']) || PLAYGROUND_STARTER;
};

export function VisualizerCard() {
    const nav = useNavigate();
    const [src, setSrc] = useState(startCode);
    const go = () => { openVisualizer(src); nav('/dsa/visualizer'); };
    /* the code types itself in, character by character, like someone writing it (any click or key stops it) */
    const [typed, setTyped] = useState<number | null>(0);
    const [round, setRound] = useState(0);
    useEffect(() => {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setTyped(null); return; }
        setTyped(0);
        let n = 0;
        const step = Math.max(1, Math.ceil(src.length / 130));          // a long program still finishes in about 4 seconds
        const id = setInterval(() => {
            n += step;
            if (n >= src.length) { clearInterval(id); setTyped(null); } else setTyped(n);
        }, 32);
        return () => clearInterval(id);
    }, [round]);       // eslint-disable-line react-hooks/exhaustive-deps
    const stop = () => setTyped(null);
    return (
        <section className="card vizcard">
            <div className="vzt">
                <span className="eyebrow">Code visualizer</span>
                <h2>See your own C code run</h2>
                <p className="muted">Paste or write any C program, press Visualize, and step through it one statement at a time. Unpacked shows the call stack, the heap and every pointer, and explains a crash instead of hiding it.</p>
                <ul className="vzl"><li>Variables, arrays and structs on the stack</li><li><code>malloc</code> and <code>free</code> blocks on the heap</li><li>Arrows from pointers to what they point at</li></ul>
                <div className="pickBtns"><button className="btn primary" type="button" onClick={go}>▶ Visualize this code</button><button className="btn" type="button" onClick={() => { setSrc(PLAYGROUND_STARTER); setRound(r => r + 1); }}>Reset example</button></div>
            </div>
            <textarea className="vzsrc" spellCheck={false} value={typed === null ? src : src.slice(0, typed) + '▌'} readOnly={typed !== null} onChange={e => setSrc(e.target.value)} aria-label="C code to visualize"
                onPointerDown={stop} onFocus={stop}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') go(); }} />
        </section>
    );
}
