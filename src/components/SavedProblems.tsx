/* "Examples" and "Saved problems" for any lesson. Saved problems live in one shared list (see storage.ts),
   each item tagged with its lesson. Export / Import use the same JSON shape as the original app. */
import { useEffect, useState } from 'react';
import { clone } from '../lib/util';
import { loadSaved, saveSaved, type SavedItem } from '../lib/storage';

export interface ExampleItem { key: string; name: string; meta: string }

export function ExamplesList({ items, onLoad }: { items: ExampleItem[]; onLoad: (key: string) => void }) {
    return (
        <>
            <h2>Examples</h2>
            <ul id="exampleList" className="plist">
                {items.map(it => (
                    <li key={it.key} onClick={() => onLoad(it.key)}>
                        <span className="nm">{it.name}</span><span className="meta">{it.meta}</span>
                        <button className="btn small" type="button">Load</button>
                    </li>
                ))}
            </ul>
        </>
    );
}

interface SavedProps<P> {
    lesson: string;
    problem: P;
    isValid: (p: unknown) => boolean;
    /** short text shown next to the name, e.g. "Max" */
    meta: (p: P) => string;
    onLoad: (p: P) => void;
    onError: (msg: string) => void;
    fileName: string;
}

export function SavedProblems<P>({ lesson, problem, isValid, meta, onLoad, onError, fileName }: SavedProps<P>) {
    const [all, setAll] = useState<SavedItem[]>(() => loadSaved());
    const [name, setName] = useState('');
    useEffect(() => { setAll(loadSaved()); }, []);
    const mine = all.filter(s => s.lesson === lesson);

    const write = (list: SavedItem[]) => { setAll(list); return saveSaved(list); };

    const save = () => {
        const nm = name.trim() || ('Problem ' + new Date().toLocaleString());
        const list = loadSaved();
        list.unshift({ id: String(Date.now()) + Math.random().toString(36).slice(2, 6), name: nm, ts: Date.now(), lesson, problem: clone(problem) });
        if (!write(list)) onError('Could not save (browser storage is blocked).');
        setName('');
    };
    const del = (id: string) => write(loadSaved().filter(x => x.id !== id));
    const load = (id: string) => {
        const s = loadSaved().find(x => x.id === id);
        if (s) onLoad(clone(s.problem) as P);
    };
    const doExport = () => {
        const blob = new Blob([JSON.stringify({ saved: loadSaved().filter(s => s.lesson === lesson), current: problem }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = fileName; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const doImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        const input = e.target;
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
            try {
                const d = JSON.parse(String(rd.result));
                const incoming = ((d.saved || []) as SavedItem[]).filter(s => s && isValid(s.problem) && s.name);
                const list = loadSaved();
                incoming.forEach(s => { if (!list.some(x => x.id === String(s.id))) list.push({ id: String(s.id), name: String(s.name), ts: +s.ts || Date.now(), lesson, problem: s.problem }); });
                write(list);
                if (isValid(d.current)) onLoad(d.current as P);
            } catch { onError('That file is not a valid export.'); }
        };
        rd.readAsText(f);
        input.value = '';
    };

    return (
        <>
            <div className="row between h2b">
                <h2>Saved problems <small>(this browser only)</small></h2>
                <div className="row gap tight">
                    <button className="btn small" id="exportBtn" type="button" onClick={doExport}>Export</button>
                    <label className="btn small filebtn">Import<input type="file" id="importFile" accept="application/json" hidden onChange={doImport} /></label>
                </div>
            </div>
            <div className="saveRow">
                <input id="saveName" placeholder="Name, e.g. Quiz 2 #3" value={name} onChange={e => setName(e.target.value)} />
                <button className="btn small" id="saveBtn" type="button" onClick={save}>Save current</button>
            </div>
            <ul id="savedList">
                {mine.map(s => (
                    <li key={s.id}>
                        <span className="nm">{s.name}</span>
                        <span className="meta">{meta(s.problem as P)} · {new Date(s.ts).toLocaleDateString()}</span>
                        <button className="btn small" type="button" onClick={() => load(s.id)}>Load</button>
                        <button className="btn small" type="button" onClick={() => del(s.id)}>Delete</button>
                    </li>
                ))}
            </ul>
            <p className="note">Your inputs and progress are saved automatically in this browser. Nothing is sent anywhere.</p>
        </>
    );
}
