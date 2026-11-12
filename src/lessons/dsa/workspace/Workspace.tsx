/* The splittable canvas: draws a layout tree, and handles splitting, joining, swapping and resizing with the pointer.
   All the rules live in src/lib/layout.ts; this file only measures, previews and calls them. */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
    MIN_PX, SPLIT_MAX, SPLIT_MIN, areAdjacent, dragDirection, finishResize, joinArrow, joinPanels, resizeSplit, setEditor, splitPanel, swapPanels,
    type Direction, type Editor, type LayoutNode, type Panel, type Split
} from '../../../lib/layout';
import type { WorkspaceApi } from './useWorkspace';
import '../../../styles/workspace.css';

export interface EditorOption { name: Editor; label: string; category: string }

type Mode = 'none' | 'split' | 'join' | 'swap';
interface Drag { source: string; kind: 'corner' | 'head'; x0: number; y0: number; mode: Mode; dir: Direction | null; ratio: number; sizePx: number; target: string | null; ok: boolean; arrow: 'left' | 'right' | 'up' | 'down' | null }

interface Env {
    ws: WorkspaceApi;
    options: EditorOption[];
    render: (editor: Editor, panelId: string) => ReactNode;
    drag: Drag | null;
    onCornerDown: (e: RPointerEvent<HTMLElement>, panelId: string) => void;
    onCornerMove: (e: RPointerEvent<HTMLElement>) => void;
    onCornerUp: (e: RPointerEvent<HTMLElement>) => void;
    onHeadDown: (e: RPointerEvent<HTMLElement>, panelId: string) => void;
    onHeadMove: (e: RPointerEvent<HTMLElement>) => void;
    onHeadUp: (e: RPointerEvent<HTMLElement>) => void;
}

const ARROW = { left: '←', right: '→', up: '↑', down: '↓' } as const;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function Workspace({ ws, options, render }: { ws: WorkspaceApi; options: EditorOption[]; render: (editor: Editor, panelId: string) => ReactNode }) {
    const root = useRef<HTMLDivElement>(null);
    const [drag, setDragState] = useState<Drag | null>(null);
    const dragRef = useRef<Drag | null>(null);
    const treeRef = useRef(ws.tree); treeRef.current = ws.tree;
    const setDrag = (d: Drag | null) => { dragRef.current = d; setDragState(d); };

    /** what the pointer would do right now */
    const evaluate = (d: Drag, e: { clientX: number; clientY: number; ctrlKey: boolean; metaKey: boolean }): Drag => {
        const r = root.current;
        if (!r) return d;
        const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
        const started = d.mode !== 'none' || Math.hypot(dx, dy) >= 12;      // short drags are ignored
        if (!started) return d;
        let target: string | null = null;
        for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
            const a = el.closest<HTMLElement>('[data-area-id]');
            if (a && r.contains(a)) { target = a.dataset.areaId || null; break; }
        }
        const base = { ...d, target };
        if (!target) return { ...base, mode: 'none', dir: d.dir, ok: false, arrow: null };
        const tree = treeRef.current;
        if (d.kind === 'head') {      // dragged by its header: swap places with a neighbour
            if (target === d.source) return { ...base, mode: 'none', ok: false, arrow: null };
            return { ...base, mode: 'swap', ok: areAdjacent(tree, d.source, target), arrow: null };
        }
        if (target === d.source) {
            const dir = dragDirection(dx, dy, d.dir);
            const el = r.querySelector<HTMLElement>('[data-area-id="' + d.source + '"]');
            if (!dir || !el) return { ...base, mode: 'none', dir, ok: false, arrow: null };
            const b = el.getBoundingClientRect(), size = dir === 'horizontal' ? b.width : b.height;
            let ratio = dir === 'horizontal' ? (e.clientX - b.left) / b.width : (e.clientY - b.top) / b.height;
            ratio = clamp(ratio, SPLIT_MIN, SPLIT_MAX);
            const m = MIN_PX / size; if (m < 0.5) ratio = clamp(ratio, m, 1 - m);
            return { ...base, mode: 'split', dir, ratio, sizePx: size, ok: true, arrow: null };
        }
        return { ...base, mode: 'join', ok: joinPanels(tree, d.source, target) !== null, arrow: joinArrow(tree, d.source, target) };
    };

    const onCornerDown = (e: RPointerEvent<HTMLElement>, panelId: string) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ source: panelId, kind: 'corner', x0: e.clientX, y0: e.clientY, mode: 'none', dir: null, ratio: 0.5, sizePx: 0, target: panelId, ok: false, arrow: null });
    };
    const onCornerMove = (e: RPointerEvent<HTMLElement>) => { const d = dragRef.current; if (d) setDrag(evaluate(d, e)); };
    const onCornerUp = (e: RPointerEvent<HTMLElement>) => {
        const d0 = dragRef.current;
        if (!d0) return;
        const d = evaluate(d0, e);
        setDrag(null);
        if (d.mode === 'split' && d.dir) ws.apply(t => splitPanel(t, d.source, d.dir as Direction, d.ratio, d.sizePx));
        else if (d.mode === 'join' && d.ok && d.target) ws.apply(t => joinPanels(t, d.source, d.target as string));
        else if (d.mode === 'swap' && d.ok && d.target) ws.apply(t => swapPanels(t, d.source, d.target as string));
    };
    /* The header is the handle for swapping places. With a mouse, press and drag. With a finger or a pen, press and HOLD for a moment
       first (so a swipe that only scrolls is left alone), then drag onto a neighbour. */
    const hold = useRef<{ timer: number; id: number; x: number; y: number; el: HTMLElement; panel: string } | null>(null);
    const cancelHold = () => { if (hold.current) { window.clearTimeout(hold.current.timer); hold.current = null; } };
    const arm = (panelId: string, el: HTMLElement, pointerId: number, x: number, y: number) => {
        try { el.setPointerCapture(pointerId); } catch { /* the pointer is already gone */ }
        setDrag({ source: panelId, kind: 'head', x0: x, y0: y, mode: 'none', dir: null, ratio: 0.5, sizePx: 0, target: panelId, ok: false, arrow: null });
    };
    const onHeadDown = (e: RPointerEvent<HTMLElement>, panelId: string) => {
        if (e.button !== 0 || (e.target as Element).closest('.pmenu')) return;
        const el = e.currentTarget;
        if (e.pointerType === 'mouse') { e.preventDefault(); arm(panelId, el, e.pointerId, e.clientX, e.clientY); return; }
        cancelHold();
        const h = { timer: 0, id: e.pointerId, x: e.clientX, y: e.clientY, el, panel: panelId };
        h.timer = window.setTimeout(() => {
            if (hold.current !== h) return;
            hold.current = null;
            if (navigator.vibrate) navigator.vibrate(12);
            arm(h.panel, h.el, h.id, h.x, h.y);
        }, 380);
        hold.current = h;
    };
    const onHeadMove = (e: RPointerEvent<HTMLElement>) => {
        const h = hold.current;
        if (h) { if (Math.hypot(e.clientX - h.x, e.clientY - h.y) > 10) cancelHold(); return; }     // moved before the hold was over: it is a swipe
        onCornerMove(e);
    };
    const onHeadUp = (e: RPointerEvent<HTMLElement>) => { cancelHold(); onCornerUp(e); };
    useEffect(() => cancelHold, []);   // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {     // Escape cancels a drag
        if (!drag) return;
        const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrag(null); };
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, [!!drag]);   // eslint-disable-line react-hooks/exhaustive-deps

    const env: Env = { ws, options, render, drag, onCornerDown, onCornerMove, onCornerUp, onHeadDown, onHeadMove, onHeadUp };
    return <div className={'ws' + (drag && drag.mode !== 'none' ? ' dragging ' + drag.mode : '')} ref={root}><NodeView node={ws.tree} env={env} /></div>;
}

function NodeView({ node, env }: { node: LayoutNode; env: Env }) {
    return node.type === 'panel' ? <PanelView node={node} env={env} /> : <SplitView node={node} env={env} />;
}

/* ---------- a split: two children and a gutter ---------- */
function SplitView({ node, env }: { node: Split; env: Env }) {
    const ref = useRef<HTMLDivElement>(null);
    const horiz = node.direction === 'horizontal';
    const start = useRef<{ tree: LayoutNode; origin: number; len: number; raw: number } | null>(null);
    const track = horiz ? { gridTemplateColumns: 'minmax(0, ' + node.ratio + 'fr) 8px minmax(0, ' + (1 - node.ratio) + 'fr)' } : { gridTemplateRows: 'minmax(0, ' + node.ratio + 'fr) 8px minmax(0, ' + (1 - node.ratio) + 'fr)' };

    const down = (e: RPointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 || !ref.current) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const b = ref.current.getBoundingClientRect();
        start.current = { tree: env.ws.tree, origin: (horiz ? b.left : b.top) + 4, len: (horiz ? b.width : b.height) - 8, raw: node.ratio };
    };
    const move = (e: RPointerEvent<HTMLDivElement>) => {
        const s = start.current;
        if (!s) return;
        s.raw = ((horiz ? e.clientX : e.clientY) - s.origin) / s.len;
        env.ws.live(resizeSplit(s.tree, node.id, s.raw, s.len));
    };
    const up = () => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const r = finishResize(s.tree, node.id, s.raw, s.len);     // past the edge the small side is removed (Reset layout brings it back)
        env.ws.commit(r.tree);
    };
    const key = (e: RKeyboardEvent<HTMLDivElement>) => {
        const dec = horiz ? 'ArrowLeft' : 'ArrowUp', inc = horiz ? 'ArrowRight' : 'ArrowDown';
        if ((e.key !== dec && e.key !== inc) || !ref.current) return;
        e.preventDefault();
        const b = ref.current.getBoundingClientRect(), len = (horiz ? b.width : b.height) - 8;
        env.ws.apply(t => resizeSplit(t, node.id, node.ratio + (e.key === inc ? 0.03 : -0.03), len));
    };

    return (
        <div className={'split ' + node.direction} ref={ref} style={track} data-split-id={node.id}>
            <NodeView node={node.first} env={env} />
            <div className="gutter" role="separator" aria-orientation={horiz ? 'vertical' : 'horizontal'} aria-label="Resize panels" tabIndex={0}
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}><i /></div>
            <NodeView node={node.second} env={env} />
        </div>
    );
}

/* ---------- a panel: a header with the editor menu, the editor, and a corner handle ---------- */
function PanelView({ node, env }: { node: Panel; env: Env }) {
    const d = env.drag, live = !!d && d.mode !== 'none';
    const isTarget = live && d.target === node.id && d.target !== d.source;
    const isSource = !!d && d.source === node.id;
    let cls = 'panel';
    if (isSource && live && d.kind === 'corner') cls += ' p-source';
    if (isSource && live && d.kind === 'head') cls += ' p-lifted';
    if (isSource && d.kind === 'head' && !live) cls += ' p-armed';
    if (isTarget && d.mode === 'join') cls += d.ok ? ' p-join' : ' p-bad';
    if (isTarget && d.mode === 'swap') cls += d.ok ? ' p-swap' : ' p-bad';
    const sym = isTarget ? (!d.ok ? '⊘' : d.mode === 'swap' ? '⇄' : d.arrow ? ARROW[d.arrow] : '') : '';
    return (
        <div className={cls} data-area-id={node.id}>
            <div className="phead" onPointerDown={e => env.onHeadDown(e, node.id)} onPointerMove={env.onHeadMove} onPointerUp={env.onHeadUp} onPointerCancel={env.onHeadUp} onContextMenu={e => e.preventDefault()}>
                <EditorMenu value={node.editor} options={env.options} onPick={ed => env.ws.apply(t => setEditor(t, node.id, ed))} />
                <span className="pgrip" title="Press and hold here, then drag onto a neighbour to swap places" aria-hidden="true"><i /><i /><i /></span>
            </div>
            <div className="pbody">{env.render(node.editor, node.id)}</div>
            {isTarget && <div className="pov" aria-hidden="true"><span>{sym}</span></div>}
            {isSource && d.mode === 'split' && d.dir && (
                <div className={'pghost ' + d.dir} style={d.dir === 'horizontal' ? { left: d.ratio * 100 + '%' } : { top: d.ratio * 100 + '%' }} aria-hidden="true" />
            )}
            <div className="pcorner" title="Drag inside to split. Drag onto a neighbour to join."
                onPointerDown={e => env.onCornerDown(e, node.id)} onPointerMove={env.onCornerMove} onPointerUp={env.onCornerUp} onPointerCancel={env.onCornerUp} />
        </div>
    );
}

/* ---------- the editor menu ---------- */
function EditorMenu({ value, options, onPick }: { value: Editor; options: EditorOption[]; onPick: (e: Editor) => void }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null);
    const btn = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
    const current = options.find(o => o.name === value);
    const cats = Array.from(new Set(options.map(o => o.category)));

    useLayoutEffect(() => {      // below the header, or above it when there is no room; at most 72% of the window tall
        if (!open || !btn.current || !menu.current) return;
        const r = btn.current.getBoundingClientRect(), vh = window.innerHeight, vw = window.innerWidth;
        const maxH = Math.floor(vh * 0.72), h = Math.min(menu.current.scrollHeight, maxH), w = menu.current.offsetWidth;
        const below = r.bottom + 4;
        const top = below + h <= vh - 8 || r.top - h - 4 < 8 ? Math.min(below, Math.max(8, vh - 8 - h)) : r.top - h - 4;
        setPos({ left: clamp(r.left, 8, Math.max(8, vw - w - 8)), top, maxH });
    }, [open]);
    useEffect(() => {
        if (!open) return;
        const away = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('pointerdown', away);
        return () => document.removeEventListener('pointerdown', away);
    }, [open]);
    useEffect(() => {      // once the menu is placed (and visible) the current item gets the focus
        if (!open || !pos) return;
        const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') || []);
        (items.find(i => i.dataset.name === value) || items[0])?.focus();
    }, [open, !!pos]);   // eslint-disable-line react-hooks/exhaustive-deps

    const close = () => { setOpen(false); setPos(null); btn.current?.focus(); };
    const onKey = (e: RKeyboardEvent<HTMLDivElement>) => {
        const list = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') || []);
        const i = list.indexOf(document.activeElement as HTMLElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
        else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); }
        else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus(); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'Tab') { e.preventDefault(); close(); }
    };
    return (
        <>
            <button type="button" ref={btn} className="pmenu" aria-haspopup="menu" aria-expanded={open} onClick={() => { setPos(null); setOpen(o => !o); }}
                onKeyDown={e => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setPos(null); setOpen(true); } }}>
                <span>{current ? current.label : value}</span><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {open && createPortal(
                <div className="pmenu-list" role="menu" aria-label="Editor" ref={menu} onKeyDown={onKey}
                    style={pos ? { left: pos.left, top: pos.top, maxHeight: pos.maxH } : { left: 0, top: 0, visibility: 'hidden', maxHeight: '72vh' }}>
                    {cats.map(c => (
                        <div key={c} role="group" aria-label={c}>
                            <div className="pmenu-cat">{c}</div>
                            {options.filter(o => o.category === c).map(o => (
                                <button key={o.name} type="button" role="menuitemradio" aria-checked={o.name === value} data-name={o.name} className={o.name === value ? 'on' : ''}
                                    onClick={() => { if (o.name !== value) onPick(o.name); close(); }}>{o.label}</button>
                            ))}
                        </div>
                    ))}
                </div>, document.body)}
        </>
    );
}
