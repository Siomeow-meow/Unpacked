/* The files of a code editor, like the tabs of a web browser: click to open, double-click to rename, x to close, + to add a file. */
import { useState } from 'react';

export interface FileTab { id: string; label: string }

interface Props {
    tabs: FileTab[];
    active: string;
    /** the open file has been changed */
    edited?: boolean;
    onPick: (id: string) => void;
    onAdd: () => void;
    onClose: (id: string) => void;
    onRename: (id: string, label: string) => void;
    /** a file that cannot be closed (e.g. the one the Check runs); default: all can be closed while more than one is open */
    keep?: string;
}

export function FileTabsBar({ tabs, active, edited, onPick, onAdd, onClose, onRename, keep }: Props) {
    const [ren, setRen] = useState<string | null>(null);
    const done = (id: string, v: string) => { setRen(null); onRename(id, v); };
    return (
        <div className="ftabs" role="tablist" aria-label="Files">
            {tabs.map(t => {
                const on = t.id === active;
                return (
                    <div key={t.id} className={'ftb' + (on ? ' on' : '')} role="presentation">
                        {ren === t.id ? (
                            <input className="ftn" autoFocus defaultValue={t.label} aria-label="File name" maxLength={40} onFocus={e => e.currentTarget.select()}
                                onBlur={e => done(t.id, e.currentTarget.value)}
                                onKeyDown={e => { if (e.key === 'Enter') done(t.id, e.currentTarget.value); else if (e.key === 'Escape') setRen(null); }} />
                        ) : (
                            <button type="button" role="tab" aria-selected={on} className="ftl" title={on ? 'Double-click to rename' : t.label}
                                onClick={() => onPick(t.id)} onDoubleClick={() => { onPick(t.id); setRen(t.id); }}>{t.label}{on && edited ? ' •' : ''}</button>
                        )}
                        {tabs.length > 1 && t.id !== keep && <button type="button" className="ftx" aria-label={'Close ' + t.label} title="Close file" onClick={() => onClose(t.id)}>×</button>}
                    </div>
                );
            })}
            <button type="button" className="ftplus" aria-label="New file" title="New file" onClick={onAdd}>+</button>
        </div>
    );
}

/** the next free name: file2.c, file3.c ... */
export function nextFileName(tabs: FileTab[]): string {
    const used = new Set(tabs.map(t => t.label));
    let n = tabs.length + 1;
    while (used.has('file' + n + '.c')) n++;
    return 'file' + n + '.c';
}

/** a typed name made safe: no path characters, ends with an extension */
export function cleanFileName(name: string): string {
    let v = name.trim().replace(/[\\/:*?"<>|]/g, '');
    if (v && !/\.[A-Za-z]+$/.test(v)) v += '.c';
    return v;
}
