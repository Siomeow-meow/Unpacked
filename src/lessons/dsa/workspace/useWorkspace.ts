/* One workspace's layout tree, with saving. Dragging a gutter calls live() for every move and commit() once at the end. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultLayout, loadLayout, type Editor, type LayoutNode } from '../../../lib/layout';
import { store } from '../../../lib/storage';

/* the lesson layout is v6 (it changed: About over Practice, then Code, then Test cases); the Code visualizer's is still v5 */
export const layoutKey = (workspace: string) => 'unpacked:layout:' + workspace + (workspace === 'dsa:visualizer' ? ':v5' : ':v6');

export interface WorkspaceApi {
    tree: LayoutNode;
    /** change the tree while dragging */
    live: (tree: LayoutNode) => void;
    /** make `to` the layout when a drag ends */
    commit: (to: LayoutNode) => void;
    /** apply a change to the current tree; null from `fn` means "not allowed, change nothing" */
    apply: (fn: (t: LayoutNode) => LayoutNode | null) => boolean;
    reset: () => void;
}

export function useWorkspace(workspace: string, allowed: readonly Editor[]): WorkspaceApi {
    const [tree, setTree] = useState<LayoutNode>(() => loadLayout(store.get<unknown>(layoutKey(workspace), null), defaultLayout(workspace), allowed));
    const cur = useRef(tree); cur.current = tree;
    useEffect(() => { store.set(layoutKey(workspace), tree); }, [workspace, tree]);

    const live = useCallback((t: LayoutNode) => setTree(t), []);
    const commit = useCallback((t: LayoutNode) => setTree(t), []);
    const apply = useCallback((fn: (t: LayoutNode) => LayoutNode | null): boolean => {
        const n = fn(cur.current);
        if (!n) return false;
        setTree(n);
        return true;
    }, []);
    const reset = useCallback(() => setTree(defaultLayout(workspace)), [workspace]);
    return { tree, live, commit, apply, reset };
}
