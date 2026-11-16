/* The picture of the machine at one step: the call stack (one card per running function) and the heap (one card per
   malloc block), with an arrow from every pointer to what it points at. */
import { Fragment, createContext, useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { fmtAddr } from '../../lib/c/machine';
import type { BlockView, Cell, Snapshot } from '../../lib/c/machine';

interface Row { label: string; cell: Cell }

/** what existed in a snapshot: every cell id and block, and where each pointer pointed */
export function inventory(snap: Snapshot | null): { ids: Set<string>; ptr: Map<string, number> } {
    const ids = new Set<string>(), ptr = new Map<string, number>();
    const walk = (c: Cell) => { ids.add(c.id); if (c.kind === 'ptr' && c.init) ptr.set(c.id, c.target || 0); c.children?.forEach(walk); };
    if (!snap) return { ids, ptr };
    snap.frames.forEach(f => f.vars.forEach(walk)); snap.globals.forEach(walk);
    snap.heap.forEach(b => { ids.add('b' + b.addr); b.cells.forEach(walk); });
    return { ids, ptr };
}
type Inv = ReturnType<typeof inventory>;

/** structs become one row per field ("L.count"); arrays of scalars stay a row of boxes */
function rowsOf(c: Cell, prefix = '', out: Row[] = []): Row[] {
    const label = prefix + c.name;
    if (c.kind === 'struct' && c.children) { c.children.forEach(ch => rowsOf(ch, label + '.', out)); return out; }
    if (c.kind === 'array' && c.children && c.children.length && c.children[0].kind === 'struct') {
        c.children.slice(0, 6).forEach(ch => rowsOf(ch, label, out));
        if (c.children.length > 6 || (c.more || 0) > 0) out.push({ label: label + '…', cell: { ...c, kind: 'string', text: '…', children: undefined } });
        return out;
    }
    out.push({ label, cell: c });
    return out;
}

const hex = fmtAddr;
const rwClass = (c: Cell) => (c.rw === 'r' ? ' r' : c.rw === 'w' ? ' w' : c.rw === 'rw' ? ' r w' : '');

/* one variable: the value in a box, and the address of that box written underneath it */
function Value({ c, inv }: { c: Cell; inv: Inv | null }) {
    return <span className="vbox" data-a={c.addr} data-s={c.size}><Inner c={c} inv={inv} /><small className="vaddr">{hex(c.addr)}</small></span>;
}

/** the characters of a text, one box each, with the index under it: a char array, or what a char* points to */
function CharRow({ chars, cells, more, text }: { chars: string[]; cells?: Cell[]; more: number; text?: string }) {
    return (
        <span className="minia vb chrow" title={text !== undefined ? '"' + text + '"' : undefined}>
            {chars.map((ch, i) => (
                <i key={i} className={'mc ch' + (ch === '\\0' ? ' nul' : '') + (cells ? rwClass(cells[i]) + (cells[i].init ? '' : ' un') : '')} data-a={cells ? cells[i].addr : undefined} data-s={cells ? 1 : undefined}>
                    {ch}<small>{i}</small>
                </i>
            ))}
            {more > 0 && <em>+{more}</em>}
        </span>
    );
}

function Inner({ c, inv }: { c: Cell; inv: Inv | null }) {
    if (c.kind === 'ptr' && c.init && c.target) {
        const arrow = <span className="vb ptrv" data-target={c.target} data-pid={c.id} data-hot={inv && inv.ptr.get(c.id) !== c.target ? '1' : undefined}>→ {c.text}</span>;
        if (!c.chars) return arrow;
        return <span className="strptr">{arrow}<CharRow chars={c.chars} more={c.more || 0} text={c.strText} /></span>;
    }
    if (c.kind === 'array' && c.children && c.strText !== undefined) {
        return <CharRow chars={c.children.map(ch => ch.text)} cells={c.children} more={c.more || 0} text={c.strText} />;
    }
    if (c.kind === 'array' && c.children) {
        return (
            <span className="minia vb">
                {c.children.map(ch => <i key={ch.id} className={'mc' + rwClass(ch) + (ch.init ? '' : ' un')} data-a={ch.addr} data-s={ch.size}>{ch.kind === 'ptr' ? (ch.init ? (ch.target ? '→' : 'NULL') : '?') : ch.text}</i>)}
                {(c.more || 0) > 0 && <em>+{c.more}</em>}
            </span>
        );
    }
    return <span className={'vb val' + (c.init ? '' : ' un')}>{c.text}</span>;
}

function VarRows({ cells, inv }: { cells: Cell[]; inv: Inv | null }) {
    return (
        <>
            {cells.flatMap(c => rowsOf(c)).map(r => (
                <div key={r.cell.id + r.label} className={'vrow' + rwClass(r.cell)} data-new={inv && !inv.ids.has(r.cell.id) ? 'var' : undefined}>
                    <span className="vn">{r.label}</span><Value c={r.cell} inv={inv} />
                </div>
            ))}
        </>
    );
}

function Block({ b, inv }: { b: BlockView; inv: Inv | null }) {
    return (
        <div className={'blk' + (b.freed ? ' freed' : '')} data-block={b.addr} data-a={b.addr} data-s={b.size} data-new={inv && !inv.ids.has('b' + b.addr) ? 'blk' : undefined}>
            <div className="bh"><b>{hex(b.addr)}</b><span>{b.elemType}[{b.cells.length + b.more}]{b.freed ? ' · freed' : ' · malloc in ' + b.site + '()'}</span></div>
            {b.freed ? <div className="bfree">This block was freed. Using it now is a bug.</div> : (
                <div className="cells">
                    {b.cells.map((c, i) => (
                        <div key={c.id} className="cw" data-new={inv && !inv.ids.has(c.id) ? 'cell' : undefined}>
                            {c.kind === 'struct' ? (
                                <div className={'sc' + rwClass(c)} data-a={c.addr} data-s={c.size}>{(c.children || []).flatMap(ch => rowsOf(ch, '')).map(r => <div key={r.label} className={'vrow' + rwClass(r.cell)}><span className="vn">{r.label}</span><Value c={r.cell} inv={inv} /></div>)}</div>
                            ) : (
                                <div className={'cb' + rwClass(c) + (c.init ? '' : ' un')} data-a={c.addr} data-s={c.size}>{c.kind === 'ptr' ? (c.init ? (c.target ? <span className="ptrv" data-target={c.target} data-pid={c.id} data-hot={inv && inv.ptr.get(c.id) !== c.target ? '1' : undefined}>●</span> : 'NULL') : '?') : c.text}</div>
                            )}
                            <small title={'index ' + i}>{hex(c.addr)}</small>
                        </div>
                    ))}
                    {b.more > 0 && <div className="cw more"><div className="cb">…</div><small>+{b.more}</small></div>}
                </div>
            )}
        </div>
    );
}

/** how a line is named: "line 12", or "file2.c line 3" when the program has several files (set by the lesson page) */
export const LineLabelCtx = createContext<(n: number) => string>(n => 'line ' + n);

/* ---------- the call stack, and the heap: two separate views that can live in different panels ---------- */
export function StackView({ snap, prev }: { snap: Snapshot; prev?: Snapshot | null }) {
    const inv = useMemo(() => (prev ? inventory(prev) : null), [prev]);
    const label = useContext(LineLabelCtx);
    return (
        <div className="dcol sv">
            <h4>Call stack</h4>
            {snap.frames.map((f, i) => (
                <div key={i} className={'frame' + (i === 0 ? ' run' : '')}>
                    <div className="fh"><b>{f.fn}()</b><span>{i === 0 ? 'running' : 'waiting'} · {label(f.line)}</span></div>
                    {f.vars.length ? <VarRows cells={f.vars} inv={inv} /> : <div className="vrow none">no variables yet</div>}
                </div>
            ))}
            {snap.globals.length > 0 && <div className="frame glob"><div className="fh"><b>globals</b></div><VarRows cells={snap.globals} inv={inv} /></div>}
        </div>
    );
}

export function HeapView({ snap, prev, usesHeap }: { snap: Snapshot; prev?: Snapshot | null; usesHeap: boolean }) {
    const inv = useMemo(() => (prev ? inventory(prev) : null), [prev]);
    return (
        <div className="dcol hv">
            <h4>Heap</h4>
            {!usesHeap
                ? <div className="noheap">This program does not use the heap: it never calls <code>malloc</code>, so everything lives on the call stack.</div>
                : snap.heap.length === 0
                    ? <div className="noheap">Nothing on the heap yet. <code>malloc</code> puts blocks here.</div>
                    : snap.heap.map(b => <Block key={b.addr} b={b} inv={inv} />)}
        </div>
    );
}

/* ---------- the arrows: ONE layer over the whole workspace, so a pointer in one panel can point into another ---------- */
function ArrowLayer({ snap, prev }: { snap: Snapshot; prev?: Snapshot | null }) {
    const svg = useRef<SVGSVGElement>(null);
    const stop = useRef<() => void>(() => undefined);
    const drawRef = useRef<(play: boolean) => void>(() => undefined);

    drawRef.current = (play: boolean) => {
        const s = svg.current, w = s?.parentElement;
        if (!s || !w) return;
        stop.current();
        const timers: number[] = [];
        let raf = 0;
        stop.current = () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); };

        const wr = () => w.getBoundingClientRect();
        const box = (el: Element) => { const r = el.getBoundingClientRect(), o = wr(); return { l: r.left - o.left + w.scrollLeft, t: r.top - o.top + w.scrollTop, w: r.width, h: r.height }; };
        type B = ReturnType<typeof box>;
        const curve = (a: B, b: B, ty: number | null): string => {
            if (b.l > a.l + a.w - 2 || b.l + b.w < a.l + 2) {
                const right = b.l > a.l, x1 = right ? a.l + a.w : a.l, x2 = right ? b.l : b.l + b.w;
                const y1 = a.t + a.h / 2, y2 = b.t + (ty === null ? b.h / 2 : Math.min(b.h / 2, ty));
                const dx = Math.max(30, Math.abs(x2 - x1) / 2) * (right ? 1 : -1);
                return 'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2;
            }
            const down = b.t > a.t, x1 = a.l + a.w / 2, x2 = b.l + b.w / 2;
            const y1 = down ? a.t + a.h : a.t, y2 = down ? b.t : b.t + b.h;
            const dy = Math.max(22, Math.abs(y2 - y1) / 2) * (down ? 1 : -1);
            return 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + (y1 + dy) + ' ' + x2 + ',' + (y2 - dy) + ' ' + x2 + ',' + y2;
        };

        /* ---- stages: new variables, then new heap blocks, then the cells inside them (in whichever panels they are) ---- */
        let t = 0;
        const reveal = (sel: string, gap: number, tail: number) => {
            const els = Array.from(w.querySelectorAll<HTMLElement>(sel));
            if (!els.length) return;
            els.forEach((e, i) => { e.style.animationDelay = (t + i * gap) + 'ms'; });
            t += gap * (els.length - 1) + tail;
        };
        if (play) { reveal('[data-new="var"]', 180, 520); reveal('[data-new="blk"]', 180, 560); reveal('[data-new="cell"]', 120, 480); }

        /* ---- arrows ---- */
        w.classList.add('measuring');      // measure the finished layout, not the pop-in scale
        s.setAttribute('width', '0'); s.setAttribute('height', '0');      // measure the boxes alone: an old, bigger arrow layer must not keep the view wide (a stray horizontal scroll bar)
        s.setAttribute('width', String(w.scrollWidth)); s.setAttribute('height', String(w.scrollHeight));
        const els = Array.from(w.querySelectorAll<HTMLElement>('[data-a]')).map(e => ({ e, a: +(e.dataset.a || 0), sz: +(e.dataset.s || 1) }));
        let h = '<defs><marker id="dah" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 1L10 5L0 9z" fill="var(--accent)"/></marker></defs>';
        const grow = (d: string, at: number) => '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2" class="ln" data-at="' + at + '"/><path class="hd" d="M-7 -3.5L0 0L-7 3.5z" fill="var(--accent)" opacity="0"/>';

        /* pointer arrows: the ones that just changed are drawn one at a time, the rest are simply there */
        let pn = 0; const ptrAt = t;
        w.querySelectorAll<HTMLElement>('[data-target]').forEach(p => {
            const tg = +(p.dataset.target || 0);
            const hits = els.filter(x => tg >= x.a && tg < x.a + x.sz && !x.e.contains(p));
            if (!hits.length) return;
            hits.sort((x, y) => (x.a === tg ? 0 : 1) - (y.a === tg ? 0 : 1) || x.sz - y.sz);
            const d = curve(box(p), box(hits[0].e), 14);
            const hot = play && p.dataset.hot === '1';
            const at = hot ? ptrAt + pn++ * 750 : 0;
            if (hot) p.style.animationDelay = at + 'ms';
            h += hot ? grow(d, at) : '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2" data-mk="dah"/>';
        });
        w.classList.remove('measuring');
        s.innerHTML = h;
        s.querySelectorAll<SVGPathElement>('path[data-mk]').forEach(p => p.setAttribute('marker-end', 'url(#' + p.getAttribute('data-mk') + ')'));

        /* the line grows from A to B with its head at the tip (like the arrows in the calculation lessons) */
        const grown = Array.from(s.querySelectorAll<SVGPathElement>('path.ln')).map(line => {
            const head = line.nextElementSibling as SVGPathElement, len = line.getTotalLength();
            line.style.strokeDasharray = String(len); line.style.strokeDashoffset = String(len);
            return { line, head, len, at: +(line.getAttribute('data-at') || 0) };
        });
        const place = (g: (typeof grown)[number], k: number) => {
            g.line.style.strokeDashoffset = String(g.len * (1 - k));
            const pt = g.line.getPointAtLength(g.len * k), q = g.line.getPointAtLength(Math.max(0, g.len * k - 2));
            g.head.setAttribute('transform', 'translate(' + pt.x + ',' + pt.y + ') rotate(' + Math.atan2(pt.y - q.y, pt.x - q.x) * 180 / Math.PI + ')');
            g.head.setAttribute('opacity', k > 0 ? '1' : '0');
        };
        const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const t0 = performance.now(), DUR = 650;
        if (grown.length) {
            if (still) grown.forEach(g => place(g, 1));
            else {
                const tick = () => {
                    const now = performance.now() - t0; let live = false;
                    grown.forEach(g => { const k = Math.min(1, Math.max(0, (now - g.at) / DUR)); if (k < 1) live = true; place(g, k * k * (3 - 2 * k)); });
                    if (live) raf = requestAnimationFrame(tick);
                };
                tick();
            }
        }
    };

    /* a new step: play it. A resize (the panel was made bigger or smaller): just re-place the arrows. They scroll along with the boxes. */
    useLayoutEffect(() => { drawRef.current(!!prev); }, [snap, prev]);
    useLayoutEffect(() => {
        const w = svg.current?.parentElement;
        if (!w) return;
        const again = () => drawRef.current(false);
        let first = true;      // a ResizeObserver reports once when it starts: that is not a resize
        const ro = window.ResizeObserver ? new ResizeObserver(() => { if (first) { first = false; return; } again(); }) : null;
        ro?.observe(w);
        return () => { ro?.disconnect(); stop.current(); };
    }, []);

    return <svg className="darrows" ref={svg} aria-hidden="true" />;
}

/** the picture of the machine at one step: the call stack and, when the program uses it, the heap */
export function DsaViz({ snap, prev, usesHeap }: { snap: Snapshot; prev?: Snapshot | null; usesHeap: boolean }) {
    return (
        <div className={'dviz' + (usesHeap ? '' : ' solo')}>
            <ArrowLayer snap={snap} prev={prev} />
            <StackView snap={snap} prev={prev} />
            {usesHeap && <HeapView snap={snap} prev={prev} usesHeap />}
        </div>
    );
}
