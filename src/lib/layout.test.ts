import { describe, expect, it } from 'vitest';
import {
    SAMPLE_LAYOUTS, areAdjacent, buildLayoutFromRects, collapseSplit, collectPanelRects, dragDirection, finishResize, joinArrow, joinPanels,
    defaultLayout, loadLayout, nodeRect, panel, panelIds, resizeSplit, split, splitPanel, swapPanels, validateLayout, type LayoutNode, type Rect, type Split
} from './layout';

const P = (id: string, editor = id) => panel(editor, id);
const rects = (t: LayoutNode) => collectPanelRects(t).map(r => ({ id: r.id, x: +r.x.toFixed(6), y: +r.y.toFixed(6), w: +r.w.toFixed(6), h: +r.h.toFixed(6) }));
const byId = (t: LayoutNode, id: string) => collectPanelRects(t).find(r => r.id === id)!;
const asSplit = (n: LayoutNode | null) => n as Split;

describe('splitPanel', () => {
    it('replaces the panel with a split: the original first, a new panel with the same editor second', () => {
        const t = splitPanel(P('a', 'code'), 'a', 'horizontal', 0.3)!;
        expect(t.type).toBe('split');
        const s = asSplit(t);
        expect(s.direction).toBe('horizontal'); expect(s.ratio).toBeCloseTo(0.3);
        expect(s.first).toMatchObject({ type: 'panel', id: 'a', editor: 'code' });
        expect(s.second).toMatchObject({ type: 'panel', editor: 'code' });
        expect(s.second.id).not.toBe('a');
    });
    it('splits a panel deep inside a tree and leaves the rest alone', () => {
        const t = split('horizontal', 0.5, P('a'), P('b'), 's');
        const r = asSplit(splitPanel(t, 'b', 'vertical', 0.5));
        expect(r.first).toBe(t.first);
        expect(asSplit(r.second).direction).toBe('vertical');
    });
    it('clamps the ratio to 0.005..0.995', () => {
        expect(asSplit(splitPanel(P('a'), 'a', 'vertical', 0))!.ratio).toBe(0.005);
        expect(asSplit(splitPanel(P('a'), 'a', 'vertical', 2))!.ratio).toBe(0.995);
    });
    it('keeps both halves at least 48px when the panel size is known', () => {
        expect(asSplit(splitPanel(P('a'), 'a', 'horizontal', 0.01, 400))!.ratio).toBeCloseTo(48 / 400);
        expect(asSplit(splitPanel(P('a'), 'a', 'horizontal', 0.99, 400))!.ratio).toBeCloseTo(1 - 48 / 400);
    });
    it('does nothing for an unknown panel', () => { expect(splitPanel(P('a'), 'zzz', 'vertical', 0.5)).toBeNull(); });
});

describe('dragDirection', () => {
    it('picks the dominant axis, and stays undecided on a diagonal', () => {
        expect(dragDirection(30, 10, null)).toBe('horizontal');
        expect(dragDirection(5, -40, null)).toBe('vertical');
        expect(dragDirection(20, 20, null)).toBeNull();
    });
    it('keeps its choice, and flips after 36px across the other axis', () => {
        expect(dragDirection(100, 90, 'horizontal')).toBe('horizontal');
        expect(dragDirection(10, 60, 'horizontal')).toBe('vertical');
        expect(dragDirection(60, 10, 'vertical')).toBe('horizontal');
    });
});

describe('joinPanels', () => {
    it('joins two equal neighbours, whichever one is the source', () => {
        const t = split('horizontal', 0.5, P('a'), P('b'));
        const j1 = joinPanels(t, 'a', 'b')!, j2 = joinPanels(t, 'b', 'a')!;
        expect(j1).toMatchObject({ type: 'panel', id: 'a' });
        expect(j2).toMatchObject({ type: 'panel', id: 'b' });
    });
    it('joins stacked neighbours', () => {
        const t = split('vertical', 0.3, P('a'), P('b'));
        expect(joinPanels(t, 'a', 'b')).toMatchObject({ type: 'panel', id: 'a' });
    });
    it('several aligned neighbours all stretch into the target', () => {
        const t = split('horizontal', 0.5, split('vertical', 0.4, P('a'), P('b')), P('c'));
        const j = joinPanels(t, 'a', 'c')!;
        expect(j.type).toBe('split');
        expect(rects(j)).toEqual([{ id: 'a', x: 0, y: 0, w: 1, h: 0.4 }, { id: 'b', x: 0, y: 0.4, w: 1, h: 0.6 }]);
        expect(panelIds(j).includes('c')).toBe(false);
    });
    it('the target can have neighbours on its other side too: only the source side grows', () => {
        const t = split('horizontal', 0.3, P('a'), split('horizontal', 0.5, P('b'), P('c')));
        const j = joinPanels(t, 'a', 'b')!;
        expect(rects(j)).toEqual([{ id: 'a', x: 0, y: 0, w: 0.65, h: 1 }, { id: 'c', x: 0.65, y: 0, w: 0.35, h: 1 }]);
    });
    it('fails when the neighbours do not line up with the target', () => {
        const t = split('horizontal', 0.5, split('vertical', 0.3, P('a'), P('b')), split('vertical', 0.6, P('c'), P('d')));
        expect(joinPanels(t, 'a', 'c')).toBeNull();      // b sticks out below c
        expect(joinPanels(t, 'c', 'a')).toBeNull();      // d sticks out below a
    });
    it('two neighbours that together cover the whole edge may both grow, whichever of them is the source', () => {
        const t = split('horizontal', 0.5, P('a'), split('vertical', 0.5, P('b'), P('c')));
        const j = joinPanels(t, 'b', 'a')!;
        expect(rects(j)).toEqual([{ id: 'b', x: 0, y: 0, w: 1, h: 0.5 }, { id: 'c', x: 0, y: 0.5, w: 1, h: 0.5 }]);
        expect(rects(joinPanels(t, 'c', 'a')!)).toEqual(rects(j));
    });
    it('fails when source and target do not touch', () => {
        const t = split('horizontal', 0.5, split('vertical', 0.5, P('a'), P('b')), split('vertical', 0.5, P('c'), P('d')));
        expect(joinPanels(t, 'a', 'd')).toBeNull();
        expect(joinPanels(t, 'a', 'a')).toBeNull();
        expect(joinPanels(t, 'a', 'nope')).toBeNull();
    });
    it('does not change the tree it was given', () => {
        const t = split('horizontal', 0.5, P('a'), P('b'));
        const copy = JSON.stringify(t);
        joinPanels(t, 'a', 'b');
        expect(JSON.stringify(t)).toBe(copy);
    });
    it('names the direction for the arrow', () => {
        const t = split('horizontal', 0.5, P('a'), split('vertical', 0.5, P('b'), P('c')));
        expect(joinArrow(t, 'a', 'b')).toBe('right');
        expect(joinArrow(t, 'b', 'a')).toBe('left');
        expect(joinArrow(t, 'b', 'c')).toBe('down');
        expect(joinArrow(t, 'c', 'b')).toBe('up');
    });
});

describe('buildLayoutFromRects', () => {
    const r = (id: string, x: number, y: number, w: number, h: number): Rect => ({ id, editor: id, x, y, w, h });
    const sorted = <T extends { id: string }>(l: T[]) => [...l].sort((p, q) => p.id.localeCompare(q.id));
    const same = (a: Rect[], t: LayoutNode) => expect(sorted(rects(t))).toEqual(sorted(a.map(q => ({ id: q.id, x: q.x, y: q.y, w: q.w, h: q.h }))));
    it('rebuilds an L-shaped arrangement', () => {
        const rs = [r('a', 0, 0, 0.5, 1), r('b', 0.5, 0, 0.5, 0.4), r('c', 0.5, 0.4, 0.5, 0.6)];
        const t = buildLayoutFromRects(rs)!;
        expect(t).not.toBeNull(); same(rs, t);
    });
    it('rebuilds a 2 x 2 grid', () => {
        const rs = [r('a', 0, 0, 0.5, 0.5), r('b', 0.5, 0, 0.5, 0.5), r('c', 0, 0.5, 0.5, 0.5), r('d', 0.5, 0.5, 0.5, 0.5)];
        const t = buildLayoutFromRects(rs)!;
        expect(t).not.toBeNull(); same(rs, t);
        expect(validateLayout(t, ['a', 'b', 'c', 'd'])).toBe(true);
    });
    it('rebuilds a grid whose rows are cut differently', () => {
        const rs = [r('a', 0, 0, 0.3, 0.5), r('b', 0.3, 0, 0.7, 0.5), r('c', 0, 0.5, 0.6, 0.5), r('d', 0.6, 0.5, 0.4, 0.5)];
        const t = buildLayoutFromRects(rs)!;
        expect(asSplit(t).direction).toBe('vertical');
        same(rs, t);
    });
    it('rebuilds a nested layout from a real tree', () => {
        const t0 = SAMPLE_LAYOUTS.nested(['code', 'steps', 'about']);
        const t1 = buildLayoutFromRects(collectPanelRects(t0))!;
        expect(sorted(rects(t1))).toEqual(sorted(rects(t0)));
    });
    it('gives one panel for one rectangle, and null for a pinwheel that has no clean cut', () => {
        expect(buildLayoutFromRects([r('a', 0, 0, 1, 1)])).toMatchObject({ type: 'panel', id: 'a' });
        const pin = [r('a', 0, 0, 0.6, 0.4), r('b', 0.6, 0, 0.4, 0.6), r('c', 0.4, 0.6, 0.6, 0.4), r('d', 0, 0.4, 0.4, 0.6), r('e', 0.4, 0.4, 0.2, 0.2)];
        expect(buildLayoutFromRects(pin)).toBeNull();
    });
    it('every split has a ratio strictly between 0 and 1', () => {
        const t = buildLayoutFromRects([r('a', 0, 0, 0.25, 1), r('b', 0.25, 0, 0.5, 1), r('c', 0.75, 0, 0.25, 1)])!;
        const walk = (n: LayoutNode): void => { if (n.type === 'split') { expect(n.ratio).toBeGreaterThan(0); expect(n.ratio).toBeLessThan(1); walk(n.first); walk(n.second); } };
        walk(t);
    });
});

describe('swapPanels', () => {
    const t = split('horizontal', 0.5, split('vertical', 0.5, P('a', 'code'), P('c', 'about')), split('vertical', 0.5, P('b', 'steps'), P('d', 'output')));
    it('swaps the editors of neighbours and keeps the shape', () => {
        const s = swapPanels(t, 'a', 'b')!;
        expect(collectPanelRects(s).map(r => r.editor)).toEqual(['steps', 'about', 'code', 'output']);
        expect(rects(s)).toEqual(rects(t));
    });
    it('does nothing for panels that only meet at a corner', () => {
        expect(areAdjacent(t, 'a', 'd')).toBe(false);
        expect(swapPanels(t, 'a', 'd')).toBeNull();
    });
});

describe('resizeSplit', () => {
    const t = split('horizontal', 0.5, split('horizontal', 0.5, P('a'), P('b')), P('c'), 'outer');   // 1000px: a 250, b 250, c 500
    const px = (tree: LayoutNode, id: string) => byId(tree, id).w * 1000;
    it('panels away from the gutter keep their pixel size; the ones touching it change', () => {
        const r = resizeSplit(t, 'outer', 0.7, 1000);
        expect(px(r, 'a')).toBeCloseTo(250); expect(px(r, 'b')).toBeCloseTo(450); expect(px(r, 'c')).toBeCloseTo(300);
    });
    it('does not drift: the result depends only on the start tree and the final position', () => {
        let last: LayoutNode = t;
        for (const q of [0.55, 0.9, 0.3, 0.7]) last = resizeSplit(t, 'outer', q, 1000);
        expect(rects(last)).toEqual(rects(resizeSplit(t, 'outer', 0.7, 1000)));
    });
    it('the far side keeps its size on the other side as well', () => {
        const u = split('horizontal', 0.5, P('c'), split('horizontal', 0.5, P('a'), P('b')), 'outer');
        const r = resizeSplit(u, 'outer', 0.3, 1000);
        expect(byId(r, 'b').w * 1000).toBeCloseTo(250); expect(byId(r, 'c').w * 1000).toBeCloseTo(300); expect(byId(r, 'a').w * 1000).toBeCloseTo(450);
    });
    it('clamps to 0.04..0.96 and to 48px', () => {
        expect((resizeSplit(t, 'outer', -1, 2000) as Split).ratio).toBeCloseTo(0.04);
        expect((resizeSplit(t, 'outer', 2, 2000) as Split).ratio).toBeCloseTo(0.96);
        expect((resizeSplit(t, 'outer', 0, 300) as Split).ratio).toBeCloseTo(48 / 300);
    });
    it('a split that runs the other way is not touched', () => {
        const v = split('horizontal', 0.5, split('vertical', 0.3, P('a'), P('b')), P('c'), 'outer');
        const r = resizeSplit(v, 'outer', 0.6, 1000) as Split;
        expect((r.first as Split).ratio).toBe(0.3);
    });
});

describe('collapse', () => {
    const t = split('horizontal', 0.5, P('a'), split('vertical', 0.5, P('b'), P('c'), 'inner'), 'outer');
    it('keeps the chosen child', () => {
        expect(collapseSplit(t, 'outer', 'first')).toMatchObject({ type: 'panel', id: 'a' });
        expect(collapseSplit(t, 'outer', 'second')).toMatchObject({ type: 'split', id: 'inner' });
        expect(panelIds(collapseSplit(t, 'inner', 'second')!)).toEqual(['a', 'c']);
    });
    it('finishResize collapses past 8% and 92%, and otherwise clamps to 0.12..0.88', () => {
        const a = finishResize(t, 'outer', 0.05, 1000);
        expect(a.collapsed).toBe(true); expect(a.tree).toMatchObject({ id: 'inner' });
        const b = finishResize(t, 'outer', 0.95, 1000);
        expect(b.collapsed).toBe(true); expect(b.tree).toMatchObject({ id: 'a' });
        expect(((finishResize(t, 'outer', 0.1, 1000).tree) as Split).ratio).toBeCloseTo(0.12);
        expect(((finishResize(t, 'outer', 0.9, 1000).tree) as Split).ratio).toBeCloseTo(0.88);
        expect(((finishResize(t, 'outer', 0.4, 1000).tree) as Split).ratio).toBeCloseTo(0.4);
    });
});

describe('defaultLayout', () => {
    it('has one single-panel, one two-panel and one nested three-panel sample', () => {
        expect(panelIds(defaultLayout('single')).length).toBe(1);
        expect(panelIds(defaultLayout('two')).length).toBe(2);
        expect(panelIds(defaultLayout('nested')).length).toBe(3);
    });
    it('a DSA lesson starts with About over Practice, the Code in the middle and the Test cases on the right', () => {
        expect(collectPanelRects(defaultLayout('dsa:hashing')).map(r => r.editor)).toEqual(['about', 'practice', 'code', 'tests']);
    });
    it('the Code visualizer starts with Code (85%) over Output (15%), and the Steps on the right', () => {
        const rs = collectPanelRects(defaultLayout('dsa:visualizer'));
        expect(rs.map(r => r.editor).sort()).toEqual(['code', 'output', 'steps']);
        expect(rs.find(r => r.editor === 'code')!.h).toBeCloseTo(0.85);
        expect(rs.find(r => r.editor === 'output')!.h).toBeCloseTo(0.15);
    });
    it('every call makes fresh ids, and the result is valid', () => {
        const a = defaultLayout('dsa:adt'), b = defaultLayout('dsa:adt');
        expect(panelIds(a)[0]).not.toBe(panelIds(b)[0]);
        expect(validateLayout(a, ['about', 'practice', 'code', 'tests'])).toBe(true);
    });
});

describe('saved layouts', () => {
    const ok = ['code', 'steps', 'about'] as const;
    const fallback = SAMPLE_LAYOUTS.nested(['code', 'steps', 'about']);
    it('a valid saved layout is used', () => {
        const saved = JSON.parse(JSON.stringify(SAMPLE_LAYOUTS.two(['steps', 'code', 'about'])));
        expect(loadLayout(saved, fallback, ok)).toEqual(saved);
    });
    it('a layout that names an unknown editor falls back to the default', () => {
        const saved = JSON.parse(JSON.stringify(SAMPLE_LAYOUTS.two(['steps', 'terminal', 'about'])));
        expect(loadLayout(saved, fallback, ok)).toBe(fallback);
    });
    it('an editor that is no longer allowed falls back as well', () => {
        const saved = SAMPLE_LAYOUTS.two(['steps', 'about', 'about']);
        expect(loadLayout(saved, fallback, ['code', 'steps'])).toBe(fallback);
    });
    it('broken data falls back: wrong types, bad ratios, repeated ids, null', () => {
        expect(loadLayout(null, fallback, ok)).toBe(fallback);
        expect(loadLayout('x', fallback, ok)).toBe(fallback);
        expect(loadLayout({ type: 'split', id: 's', direction: 'diagonal', ratio: 0.5, first: P('a', 'code'), second: P('b', 'code') }, fallback, ok)).toBe(fallback);
        expect(loadLayout({ type: 'split', id: 's', direction: 'horizontal', ratio: 1.5, first: P('a', 'code'), second: P('b', 'code') }, fallback, ok)).toBe(fallback);
        expect(loadLayout({ type: 'split', id: 's', direction: 'horizontal', ratio: 0.5, first: P('a', 'code'), second: P('a', 'steps') }, fallback, ok)).toBe(fallback);
    });
    it('node rectangles are available for any node', () => {
        const t = split('horizontal', 0.25, P('a'), split('vertical', 0.5, P('b'), P('c'), 'in'), 'out');
        expect(nodeRect(t, 'in')).toEqual({ x: 0.25, y: 0, w: 0.75, h: 1 });
    });
});

describe('openBeside', () => {
    it('opens an editor below another one, once', async () => {
        const { openBeside, split, panel, collectPanelRects } = await import('./layout');
        const t = split('horizontal', 0.4, panel('about'), panel('steps'));
        const n = openBeside(t, 'tests', 'about', 'vertical', 0.6)!;
        expect(collectPanelRects(n).map(r => r.editor).sort()).toEqual(['about', 'steps', 'tests']);
        const a = collectPanelRects(n).find(r => r.editor === 'about')!, b = collectPanelRects(n).find(r => r.editor === 'tests')!;
        expect(b.y).toBeGreaterThan(a.y);
        expect(openBeside(n, 'tests', 'about', 'vertical', 0.6)).toBeNull();
        expect(openBeside(t, 'tests', 'code', 'vertical', 0.6)).toBeNull();
    });
});
