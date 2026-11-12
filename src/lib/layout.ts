/* Pure layout logic for the splittable workspace (no React, no DOM, so it can be tested on its own).

   A workspace is a tree. A Panel shows one editor; a Split cuts its space in two:
     horizontal = side by side (first is on the left),  vertical = stacked (first is on top).
   `ratio` is the share of the first child, from 0 to 1. Joining panels works on rectangles (0..1 on both axes),
   then rebuilds a clean tree from what is left. */

export type Editor = string;
export type Direction = 'horizontal' | 'vertical';
export interface Panel { type: 'panel'; id: string; editor: Editor }
export interface Split { type: 'split'; id: string; direction: Direction; ratio: number; first: LayoutNode; second: LayoutNode }
export type LayoutNode = Panel | Split;
export interface Rect { id: string; editor: Editor; x: number; y: number; w: number; h: number }
export type Side = 'left' | 'right' | 'top' | 'bottom';

/* ---------- numbers used by the rules ---------- */
export const MIN_PX = 48;                         // no panel may be smaller than this while resizing or splitting
export const SPLIT_MIN = 0.005, SPLIT_MAX = 0.995;   // where a new split may sit inside its panel
export const LIVE_MIN = 0.04, LIVE_MAX = 0.96;       // limits while a gutter is being dragged
export const FINAL_MIN = 0.12, FINAL_MAX = 0.88;     // limits once the gutter is released
export const COLLAPSE_LOW = 0.08, COLLAPSE_HIGH = 0.92;   // released beyond these, the small side is removed
const TOUCH = 0.006;                              // how close two edges must be to count as touching
const CUT = 1e-6;                                 // how exact a cut line must be when rebuilding a tree

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const uid = (): string => (globalThis.crypto && 'randomUUID' in globalThis.crypto
    ? globalThis.crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

export const panel = (editor: Editor, id = uid()): Panel => ({ type: 'panel', id, editor });
export const split = (direction: Direction, ratio: number, first: LayoutNode, second: LayoutNode, id = uid()): Split => ({ type: 'split', id, direction, ratio, first, second });

/* ---------- the three sample layouts ---------- */
export const SAMPLE_LAYOUTS: Record<'single' | 'two' | 'nested', (e: [Editor, Editor, Editor]) => LayoutNode> = {
    /** one panel */
    single: e => panel(e[0]),
    /** two panels side by side */
    two: e => split('horizontal', 0.5, panel(e[0]), panel(e[1])),
    /** a panel on the left; on the right, two panels stacked */
    nested: e => split('horizontal', 0.42, split('vertical', 0.62, panel(e[0]), panel(e[2])), panel(e[1]))
};

/** The starting arrangement of a workspace (a fresh tree with new ids every call).
    'single', 'two' and 'nested' are the three samples. A DSA lesson starts with About on the left and the Steps (with the
    call stack and the heap) on the right; Code is one menu click away. The Code visualizer starts with Code (85%) over
    Output (15%) on the left, and the Steps on the right. */
export function defaultLayout(workspace: string): LayoutNode {
    if (workspace === 'single') return SAMPLE_LAYOUTS.single(['code', 'steps', 'about']);
    if (workspace === 'two') return SAMPLE_LAYOUTS.two(['code', 'steps', 'about']);
    if (workspace.startsWith('dsa:')) {
        /* a lesson: About over Practice on the left, the Code in the middle, the Test cases on the right; the Code visualizer has Code, Output and Steps */
        if (workspace !== 'dsa:visualizer') return split('horizontal', 0.32, split('vertical', 0.5, panel('about'), panel('practice')), split('horizontal', 0.64, panel('code'), panel('tests')));
        return split('horizontal', 0.42, split('vertical', 0.85, panel('code'), panel('output')), panel('steps'));
    }
    return SAMPLE_LAYOUTS.nested(['code', 'steps', 'about']);
}

/* ---------- finding things ---------- */
export function findNode(node: LayoutNode, id: string): LayoutNode | null {
    if (node.id === id) return node;
    if (node.type === 'split') return findNode(node.first, id) || findNode(node.second, id);
    return null;
}
export function panelIds(node: LayoutNode, out: string[] = []): string[] {
    if (node.type === 'panel') out.push(node.id); else { panelIds(node.first, out); panelIds(node.second, out); }
    return out;
}
export function collectPanelRects(node: LayoutNode, r = { x: 0, y: 0, w: 1, h: 1 }, out: Rect[] = []): Rect[] {
    if (node.type === 'panel') { out.push({ id: node.id, editor: node.editor, ...r }); return out; }
    if (node.direction === 'horizontal') {
        const w1 = r.w * node.ratio;
        collectPanelRects(node.first, { x: r.x, y: r.y, w: w1, h: r.h }, out);
        collectPanelRects(node.second, { x: r.x + w1, y: r.y, w: r.w - w1, h: r.h }, out);
    } else {
        const h1 = r.h * node.ratio;
        collectPanelRects(node.first, { x: r.x, y: r.y, w: r.w, h: h1 }, out);
        collectPanelRects(node.second, { x: r.x, y: r.y + h1, w: r.w, h: r.h - h1 }, out);
    }
    return out;
}
/** the rectangle of any node (a panel or a split) in 0..1 coordinates */
export function nodeRect(root: LayoutNode, id: string, r = { x: 0, y: 0, w: 1, h: 1 }): { x: number; y: number; w: number; h: number } | null {
    if (root.id === id) return r;
    if (root.type === 'panel') return null;
    if (root.direction === 'horizontal') {
        const w1 = r.w * root.ratio;
        return nodeRect(root.first, id, { x: r.x, y: r.y, w: w1, h: r.h }) || nodeRect(root.second, id, { x: r.x + w1, y: r.y, w: r.w - w1, h: r.h });
    }
    const h1 = r.h * root.ratio;
    return nodeRect(root.first, id, { x: r.x, y: r.y, w: r.w, h: h1 }) || nodeRect(root.second, id, { x: r.x, y: r.y + h1, w: r.w, h: r.h - h1 });
}

function map(node: LayoutNode, id: string, fn: (n: LayoutNode) => LayoutNode): LayoutNode {
    if (node.id === id) return fn(node);
    if (node.type === 'panel') return node;
    const a = map(node.first, id, fn), b = map(node.second, id, fn);
    return a === node.first && b === node.second ? node : { ...node, first: a, second: b };
}

/* ---------- split ---------- */
/** Replaces a panel with a split: the original panel first, a new panel showing the SAME editor second.
    `ratio` is where the cut is inside the panel. `sizePx` (the panel's size along the cut) lets the minimum panel size apply. */
export function splitPanel(tree: LayoutNode, panelId: string, direction: Direction, ratio: number, sizePx?: number): LayoutNode | null {
    const target = findNode(tree, panelId);
    if (!target || target.type !== 'panel') return null;
    let r = clamp(ratio, SPLIT_MIN, SPLIT_MAX);
    if (sizePx && sizePx > 0) { const m = MIN_PX / sizePx; if (m < 0.5) r = clamp(r, m, 1 - m); }
    return map(tree, panelId, n => split(direction, r, n, panel((n as Panel).editor)));
}

/** which way a drag counts as: horizontal wins when it is clearly sideways, vertical when it is clearly up or down.
    Once chosen it is kept until the pointer moves `flip` px across the other axis. */
export function dragDirection(dx: number, dy: number, current: Direction | null, flip = 36): Direction | null {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (!current) { if (ax >= 1.2 * ay) return 'horizontal'; if (ay >= 1.2 * ax) return 'vertical'; return null; }
    if (current === 'horizontal' && ay - ax >= flip) return 'vertical';
    if (current === 'vertical' && ax - ay >= flip) return 'horizontal';
    return current;
}

/* ---------- adjacency, join, swap ---------- */
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);

/** the side of T that S touches (with some length of shared edge), or null */
export function sideTouched(s: Rect, t: Rect): Side | null {
    if (Math.abs(s.x + s.w - t.x) < TOUCH && overlap(s.y, s.y + s.h, t.y, t.y + t.h) > TOUCH) return 'left';
    if (Math.abs(s.x - (t.x + t.w)) < TOUCH && overlap(s.y, s.y + s.h, t.y, t.y + t.h) > TOUCH) return 'right';
    if (Math.abs(s.y + s.h - t.y) < TOUCH && overlap(s.x, s.x + s.w, t.x, t.x + t.w) > TOUCH) return 'top';
    if (Math.abs(s.y - (t.y + t.h)) < TOUCH && overlap(s.x, s.x + s.w, t.x, t.x + t.w) > TOUCH) return 'bottom';
    return null;
}
export function areAdjacent(tree: LayoutNode, aId: string, bId: string): boolean {
    const rs = collectPanelRects(tree), a = rs.find(r => r.id === aId), b = rs.find(r => r.id === bId);
    return !!a && !!b && a.id !== b.id && sideTouched(a, b) !== null;
}

/** The direction from the source toward the target, for the arrow (null if they do not touch). */
export function joinArrow(tree: LayoutNode, sourceId: string, targetId: string): 'right' | 'left' | 'down' | 'up' | null {
    const rs = collectPanelRects(tree), s = rs.find(r => r.id === sourceId), t = rs.find(r => r.id === targetId);
    if (!s || !t) return null;
    const side = sideTouched(s, t);
    return side === 'left' ? 'right' : side === 'right' ? 'left' : side === 'top' ? 'down' : side === 'bottom' ? 'up' : null;
}

/** Removes the target; the source and every panel that touches the same side of the target grow into its space.
    Allowed only when those panels together cover the target's whole edge and none of them sticks out past it.
    Returns the new tree, or null when the join is not allowed (nothing changes then). */
export function joinPanels(tree: LayoutNode, sourceId: string, targetId: string): LayoutNode | null {
    if (sourceId === targetId) return null;
    const rects = collectPanelRects(tree);
    const S = rects.find(r => r.id === sourceId), T = rects.find(r => r.id === targetId);
    if (!S || !T) return null;
    const side = sideTouched(S, T);
    if (!side) return null;
    const touching = rects.filter(r => r.id !== T.id && sideTouched(r, T) === side);
    const vertical = side === 'left' || side === 'right';           // the shared edge runs up and down
    const a0 = vertical ? T.y : T.x, a1 = vertical ? T.y + T.h : T.x + T.w;
    const span = (r: Rect): [number, number] => (vertical ? [r.y, r.y + r.h] : [r.x, r.x + r.w]);
    const parts = touching.map(span).sort((p, q) => p[0] - q[0]);
    if (parts.some(([s0, s1]) => s0 < a0 - TOUCH || s1 > a1 + TOUCH)) return null;   // one of them sticks out: misaligned
    let at = a0;
    for (const [s0, s1] of parts) { if (Math.abs(s0 - at) > TOUCH) return null; at = s1; }
    if (Math.abs(at - a1) > TOUCH) return null;                                        // a gap: the edge is not fully covered
    const ids = new Set(touching.map(r => r.id));
    const grown = rects.filter(r => r.id !== T.id).map(r => {
        if (!ids.has(r.id)) return r;
        if (side === 'left') return { ...r, w: T.x + T.w - r.x };
        if (side === 'right') return { ...r, w: r.x + r.w - T.x, x: T.x };
        if (side === 'top') return { ...r, h: T.y + T.h - r.y };
        return { ...r, h: r.y + r.h - T.y, y: T.y };
    });
    return buildLayoutFromRects(grown);
}

/** Swaps the editors of two panels that share an edge. The tree keeps its shape. */
export function swapPanels(tree: LayoutNode, aId: string, bId: string): LayoutNode | null {
    if (!areAdjacent(tree, aId, bId)) return null;
    const a = findNode(tree, aId) as Panel, b = findNode(tree, bId) as Panel;
    return map(map(tree, aId, () => ({ ...a, editor: b.editor })), bId, () => ({ ...b, editor: a.editor }));
}

/* ---------- rebuilding a tree from rectangles ---------- */
/** Looks for a full vertical cut, then a full horizontal cut, that separates the rectangles into two groups; recurses.
    Returns null when some group has no clean cut (for example a pinwheel arrangement). */
export function buildLayoutFromRects(rects: Rect[]): LayoutNode | null {
    if (!rects.length) return null;
    const x0 = Math.min(...rects.map(r => r.x)), y0 = Math.min(...rects.map(r => r.y));
    const x1 = Math.max(...rects.map(r => r.x + r.w)), y1 = Math.max(...rects.map(r => r.y + r.h));
    return build(rects, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
}
function build(rs: Rect[], b: { x: number; y: number; w: number; h: number }): LayoutNode | null {
    if (rs.length === 1) return panel(rs[0].editor, rs[0].id);
    const tryAxis = (dir: Direction): LayoutNode | null => {
        const horiz = dir === 'horizontal';
        const lo = (r: Rect) => (horiz ? r.x : r.y), hi = (r: Rect) => (horiz ? r.x + r.w : r.y + r.h);
        const start = horiz ? b.x : b.y, size = horiz ? b.w : b.h;
        const cuts = Array.from(new Set(rs.map(hi))).filter(c => c > start + CUT && c < start + size - CUT).sort((p, q) => p - q);
        for (const c of cuts) {
            const A = rs.filter(r => hi(r) <= c + CUT), B = rs.filter(r => lo(r) >= c - CUT);
            if (!A.length || !B.length || A.length + B.length !== rs.length) continue;
            const ba = horiz ? { x: b.x, y: b.y, w: c - b.x, h: b.h } : { x: b.x, y: b.y, w: b.w, h: c - b.y };
            const bb = horiz ? { x: c, y: b.y, w: b.x + b.w - c, h: b.h } : { x: b.x, y: c, w: b.w, h: b.y + b.h - c };
            const fa = build(A, ba), fb = build(B, bb);
            if (fa && fb) return split(dir, (c - start) / size, fa, fb);
        }
        return null;
    };
    return tryAxis('horizontal') || tryAxis('vertical');
}

/* ---------- resizing ---------- */
/** Moves one gutter. `start` is the tree when the drag began, `lengthPx` is the pixel length of that split along its axis.
    Panels that touch the gutter change size; panels farther away keep the pixel size they had at the start, because
    every ratio is recomputed from the start tree (so repeated moves never drift). */
export function resizeSplit(start: LayoutNode, splitId: string, ratio: number, lengthPx: number): LayoutNode {
    const S = findNode(start, splitId);
    if (!S || S.type !== 'split' || lengthPx <= 0) return start;
    const m = Math.min(0.5, MIN_PX / lengthPx);
    const r = clamp(ratio, Math.max(LIVE_MIN, m), Math.min(LIVE_MAX, 1 - m));
    const oldFirst = lengthPx * S.ratio, oldSecond = lengthPx * (1 - S.ratio);
    const first = keepFar(S.first, S.direction, lengthPx * r, oldFirst, 'end');
    const second = keepFar(S.second, S.direction, lengthPx * (1 - r), oldSecond, 'start');
    return map(start, splitId, () => ({ ...S, ratio: r, first, second }));
}
/** `node` sits next to the gutter, which is at its `touch` end. Inside it, whatever lies away from the gutter keeps its pixel size. */
function keepFar(node: LayoutNode, dir: Direction, newPx: number, oldPx: number, touch: 'start' | 'end'): LayoutNode {
    if (node.type === 'panel') return node;
    if (node.direction !== dir) return { ...node, first: keepFar(node.first, dir, newPx, oldPx, touch), second: keepFar(node.second, dir, newPx, oldPx, touch) };
    const lim = (v: number) => clamp(v, Math.min(0.5, MIN_PX / newPx), Math.max(0.5, 1 - MIN_PX / newPx));
    if (touch === 'end') {                                   // the gutter is at the end: node.first is the far part
        const farOld = oldPx * node.ratio, nr = lim(farOld / newPx), far = newPx * nr;
        return { ...node, ratio: nr, second: keepFar(node.second, dir, newPx - far, oldPx - farOld, touch) };
    }
    const farOld = oldPx * (1 - node.ratio), nr = lim(1 - farOld / newPx), far = newPx * (1 - nr);   // the gutter is at the start: node.second is the far part
    return { ...node, ratio: nr, first: keepFar(node.first, dir, newPx - far, oldPx - farOld, touch) };
}

/** Replaces a split with one of its children (the other side is removed). */
export function collapseSplit(tree: LayoutNode, splitId: string, keep: 'first' | 'second'): LayoutNode | null {
    const s = findNode(tree, splitId);
    if (!s || s.type !== 'split') return null;
    const kept = keep === 'first' ? s.first : s.second;
    return map(tree, splitId, () => kept);
}

/** What happens when the gutter is let go at `ratio`: past the edges the small side is removed, otherwise the ratio is clamped. */
export function finishResize(start: LayoutNode, splitId: string, ratio: number, lengthPx: number): { tree: LayoutNode; collapsed: boolean } {
    if (ratio < COLLAPSE_LOW) { const t = collapseSplit(start, splitId, 'second'); if (t) return { tree: t, collapsed: true }; }
    if (ratio > COLLAPSE_HIGH) { const t = collapseSplit(start, splitId, 'first'); if (t) return { tree: t, collapsed: true }; }
    return { tree: resizeSplit(start, splitId, clamp(ratio, FINAL_MIN, FINAL_MAX), lengthPx), collapsed: false };
}

export function setEditor(tree: LayoutNode, panelId: string, editor: Editor): LayoutNode {
    return map(tree, panelId, n => (n.type === 'panel' ? { ...n, editor } : n));
}

/* ---------- saving and loading ---------- */
/** true when the tree is well formed, every id is unique, and every editor is allowed */
export function validateLayout(node: unknown, allowed: readonly Editor[], seen = new Set<string>()): node is LayoutNode {
    if (!node || typeof node !== 'object') return false;
    const n = node as Record<string, unknown>;
    if (typeof n.id !== 'string' || !n.id || seen.has(n.id)) return false;
    seen.add(n.id);
    if (n.type === 'panel') return typeof n.editor === 'string' && allowed.includes(n.editor);
    if (n.type !== 'split') return false;
    if (n.direction !== 'horizontal' && n.direction !== 'vertical') return false;
    if (typeof n.ratio !== 'number' || !(n.ratio > 0 && n.ratio < 1)) return false;
    return validateLayout(n.first, allowed, seen) && validateLayout(n.second, allowed, seen);
}
/** the saved tree if it is valid, otherwise the default (also when it names an editor that is not allowed any more) */
export function loadLayout(saved: unknown, fallback: LayoutNode, allowed: readonly Editor[]): LayoutNode {
    return validateLayout(saved, allowed) ? saved : fallback;
}

/** Opens `editor` in a new panel beside the first panel that shows `near` (the new panel goes second, e.g. below it).
    Null when `editor` is already open or `near` is not on screen. */
export function openBeside(tree: LayoutNode, editor: Editor, near: Editor, direction: Direction, ratio: number): LayoutNode | null {
    const all = collectPanelRects(tree);
    if (all.some(r => r.editor === editor)) return null;
    const target = all.find(r => r.editor === near);
    if (!target) return null;
    const cut = splitPanel(tree, target.id, direction, ratio);
    if (!cut) return null;
    const parent = (function find(n: LayoutNode): Split | null {
        if (n.type === 'panel') return null;
        if (n.first.id === target.id) return n;
        return find(n.first) || find(n.second);
    })(cut);
    return parent ? setEditor(cut, parent.second.id, editor) : null;
}
