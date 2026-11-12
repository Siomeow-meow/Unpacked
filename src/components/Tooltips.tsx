/* One tooltip for the whole app, in the same style as the rest of the design (instead of each browser's own grey box).
   Anything with a title="..." gets it: the first time the pointer (or keyboard focus) reaches the element, its title is moved to
   data-tip, so the browser's own tooltip never shows, and a button with no text keeps its name through aria-label.
   On touch screens there is no hover, so nothing is shown. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Tip { text: string; rect: DOMRect }

export function Tooltips() {
    const [tip, setTip] = useState<Tip | null>(null);
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    const box = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;
        let timer = 0;
        let cur: Element | null = null;
        const find = (t: EventTarget | null) => (t instanceof Element ? t.closest('[title],[data-tip]') : null);
        const hide = () => { window.clearTimeout(timer); cur = null; setTip(null); setPos(null); };
        const start = (el: Element, delay: number) => {
            const t = el.getAttribute('title');
            if (t !== null) {                 // take the title over from the browser
                if (t) el.setAttribute('data-tip', t);
                el.removeAttribute('title');
                if (t && !el.getAttribute('aria-label') && !(el.textContent || '').trim()) el.setAttribute('aria-label', t);
            }
            const text = el.getAttribute('data-tip');
            if (!text || el === cur) return;
            hide();
            cur = el;
            timer = window.setTimeout(() => { if (cur === el && el.isConnected) { setPos(null); setTip({ text, rect: el.getBoundingClientRect() }); } }, delay);
        };
        const over = (e: Event) => { const el = find(e.target); if (el) start(el, 450); };
        const out = (e: Event) => {
            const el = find(e.target), to = (e as MouseEvent).relatedTarget;
            if (el && el === cur && !(to instanceof Node && el.contains(to))) hide();
        };
        const focus = (e: Event) => { const el = find(e.target); if (el) start(el, 200); };
        const key = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
        document.addEventListener('pointerover', over);
        document.addEventListener('pointerout', out);
        document.addEventListener('focusin', focus);
        document.addEventListener('focusout', hide);
        document.addEventListener('pointerdown', hide);
        document.addEventListener('keydown', key);
        window.addEventListener('scroll', hide, true);
        window.addEventListener('resize', hide);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('pointerover', over);
            document.removeEventListener('pointerout', out);
            document.removeEventListener('focusin', focus);
            document.removeEventListener('focusout', hide);
            document.removeEventListener('pointerdown', hide);
            document.removeEventListener('keydown', key);
            window.removeEventListener('scroll', hide, true);
            window.removeEventListener('resize', hide);
        };
    }, []);

    /* place it under the element, or above when there is no room, and keep it inside the window */
    useLayoutEffect(() => {
        if (!tip || !box.current) return;
        const w = box.current.offsetWidth, h = box.current.offsetHeight, r = tip.rect, m = 8;
        const x = Math.min(Math.max(m, r.left + r.width / 2 - w / 2), window.innerWidth - w - m);
        const below = r.bottom + 8 + h <= window.innerHeight - m;
        setPos({ x, y: below ? r.bottom + 8 : Math.max(m, r.top - h - 8) });
    }, [tip]);

    if (!tip) return null;
    return (
        <div ref={box} className={'tip' + (pos ? ' on' : '')} role="tooltip" style={{ left: pos ? pos.x : 0, top: pos ? pos.y : 0 }}>{tip.text}</div>
    );
}
