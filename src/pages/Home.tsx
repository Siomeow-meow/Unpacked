/* The main page: subjects as cover cards, Continue for every subject with history, and the latest saved problems.
   Everything comes from the subject registry (src/subjects.ts) and the existing stores. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InstallButton } from '../components/InstallButton';
import { WhatsNewButton } from '../components/WhatsNew';
import { LATEST_VERSION } from '../changelog';
import { SUBJECT_ENTRIES, findLessonEntry, lessonCount, subjectCount, type SubjectEntry } from '../subjects';
import { continueCards, lessonStatuses, statusLine } from '../home/logic';
import { lessonSnapshot, loadAll, openSavedProblem, savedCounts, shortResult, type SavedView } from '../home/data';
import { isFinished } from '../home/logic';
import { Logo } from './homeParts';

type CSS = React.CSSProperties;
const vars = (s: SubjectEntry): CSS => ({ '--sc': s.color, '--si': s.ink, '--st': s.tint, '--so': s.on } as CSS);

/* ---------- search ---------- */
interface Hit { key: string; label: string; sub: string; run?: () => void; badge?: { letter: string; color: string } }

function SearchBox({ views, onOpen, inputRef, autoFocus }: { views: SavedView[]; onOpen: (to: string, v?: SavedView) => void; inputRef?: React.RefObject<HTMLInputElement | null>; autoFocus?: boolean }) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const [hi, setHi] = useState(0);
    const hits = useMemo<Hit[]>(() => {
        const t = q.trim().toLowerCase();
        if (!t) return [];
        const out: Hit[] = [];
        SUBJECT_ENTRIES.forEach(s => {
            if ((s.name + ' ' + s.tagline).toLowerCase().includes(t)) out.push({ key: 's:' + s.id, label: s.name, sub: s.available ? 'Course' : 'Course · Coming soon', run: s.available ? () => onOpen(s.route) : undefined });
            s.lessons.forEach(l => {
                if ((l.name + ' ' + s.name).toLowerCase().includes(t)) out.push({ key: 'l:' + l.id, label: l.name, sub: s.name + (l.available ? '' : ' · Coming soon'), badge: { letter: l.letter, color: l.color }, run: l.available ? () => onOpen(l.route) : undefined });
            });
        });
        views.forEach(v => {
            if ((v.item.name + ' ' + (v.lesson?.name || '') + ' ' + v.result).toLowerCase().includes(t)) out.push({ key: 'v:' + v.item.id, label: v.item.name, sub: (v.lesson?.name || '') + (v.result ? ' · ' + shortResult(v.result) : ''), badge: v.lesson ? { letter: v.lesson.letter, color: v.lesson.color } : undefined, run: () => onOpen('/' + v.item.lesson, v) });
        });
        return out.slice(0, 10);
    }, [q, views, onOpen]);
    useEffect(() => setHi(0), [q]);
    const go = (h?: Hit) => { if (h && h.run) { h.run(); setQ(''); setOpen(false); } };
    return (
        <div className="msbox">
            <label className="msin">
                <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                <input ref={inputRef} id="q" type="search" autoFocus={autoFocus} placeholder="Search courses, lessons, saved problems" aria-label="Search courses, lessons, saved problems"
                    value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
                    onKeyDown={e => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setHi(i => Math.min(i + 1, hits.length - 1)); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(i => Math.max(i - 1, 0)); }
                        else if (e.key === 'Enter') { e.preventDefault(); go(hits[hi]); }
                        else if (e.key === 'Escape') { setQ(''); setOpen(false); (e.target as HTMLInputElement).blur(); }
                    }} />
                <kbd>/</kbd>
            </label>
            {open && q.trim() && (
                <ul className="mres" role="listbox">
                    {hits.length === 0 && <li className="none">Nothing matches “{q.trim()}”.</li>}
                    {hits.map((h, i) => (
                        <li key={h.key} role="option" aria-selected={i === hi} className={(i === hi ? 'hi ' : '') + (h.run ? '' : 'off')} onMouseEnter={() => setHi(i)} onMouseDown={e => { e.preventDefault(); go(h); }}>
                            {h.badge ? <span className="mbadge" style={{ '--bc': h.badge.color } as CSS}>{h.badge.letter}</span> : <span className="mbadge sq" />}
                            <span className="mtx"><b>{h.label}</b><small>{h.sub}</small></span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function Home() {
    const nav = useNavigate();
    const [data, setData] = useState(loadAll());
    const [sheet, setSheet] = useState(false);
    const search = useRef<HTMLInputElement>(null);
    useEffect(() => { setData(loadAll()); }, []);
    const { progress, views } = data;

    const open = (to: string, v?: SavedView) => { if (v) openSavedProblem(v); setSheet(false); nav(to); };

    /* "/" jumps to the search (a full-width sheet on phones) */
    useEffect(() => {
        const k = (e: KeyboardEvent) => {
            const el = document.activeElement;
            if (e.key !== '/' || (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) || document.querySelector('dialog[open]')) return;
            e.preventDefault();
            if (window.matchMedia('(max-width: 700px)').matches) setSheet(true); else search.current?.focus();
        };
        document.addEventListener('keydown', k);
        return () => document.removeEventListener('keydown', k);
    }, []);
    useEffect(() => {
        if (!sheet) return;
        const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(false); };
        document.addEventListener('keydown', k);
        return () => document.removeEventListener('keydown', k);
    }, [sheet]);

    const counts = savedCounts(views);
    const cards = continueCards(SUBJECT_ENTRIES, progress, 2);
    const first = SUBJECT_ENTRIES[0].lessons[0];

    return (
        <div className="app mainpage">
            <header className="mh">
                <Link to="/" className="mbrand" aria-label="Unpacked"><Logo /><span>Unpacked</span></Link>
                <div className="mhsearch"><SearchBox views={views} onOpen={open} inputRef={search} /></div>
                <div className="mhr">
                    <InstallButton />
                    <button type="button" className="icobtn mph" aria-label="Search" onClick={() => setSheet(true)}>
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                    </button>
                    <WhatsNewButton />
                </div>
            </header>

            {sheet && (
                <div className="msheet" role="dialog" aria-label="Search">
                    <div className="shead"><SearchBox views={views} onOpen={open} autoFocus /><button type="button" className="icobtn" aria-label="Close search" onClick={() => setSheet(false)}>✕</button></div>
                </div>
            )}

            <main><section className="pane mainpane">
                <div className="mcol">
                    {/* ---- continue ---- */}
                    <section className="mcont" aria-label="Continue">
                        <span className="clabel">Continue</span>
                        <div className="ccards">
                            {cards.length === 0 ? (
                                <Link className="ccard start" style={vars(SUBJECT_ENTRIES[0])} to={first.route}>
                                    <span className="cthumb">{first.letter}</span>
                                    <span className="ctext"><small>{SUBJECT_ENTRIES[0].name}</small><b>Start with Lesson 1: {first.name}</b><code>{first.name === 'Graphical Method' ? 'Plot lines, shade, test the corners' : 'Step by step'}</code></span>
                                    <span className="cbtn">Start</span>
                                </Link>
                            ) : cards.map(c => {
                                const fin = isFinished(c.progress);
                                const snap = lessonSnapshot(c.lesson.id, views);
                                const detail = fin && snap.result ? snap.result : 'Step ' + (c.progress.idx + 1) + ' of ' + c.progress.total;
                                return (
                                    <Link key={c.lesson.id} className="ccard" style={vars(c.subject)} to={c.lesson.route}>
                                        <span className="cthumb">{c.lesson.letter}</span>
                                        <span className="ctext">
                                            <small><span className="full">{c.subject.name}</span><span className="shortn">{c.subject.short}</span></small>
                                            <b>{c.lesson.name}{snap.name ? ' · ' + snap.name : ''}</b>
                                            <code>{detail}</code>
                                        </span>
                                        <span className="cbtn">{fin ? 'Review' : 'Continue'}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>

                    {/* ---- subjects ---- */}
                    <div className="mshead"><h2>Courses</h2><span>{subjectCount()} courses · {lessonCount()} lessons</span></div>
                    <div className="mrow">
                        <div className="mcovers">
                            {SUBJECT_ENTRIES.map(s => {
                                const st = lessonStatuses(s.lessons, progress, counts);
                                const isNew = s.since === LATEST_VERSION;
                                const Cover = s.cover;
                                const inner = (
                                    <>
                                        <div className="band">
                                            <Cover />
                                            <div className="btxt"><span className="kick">{s.kicker}{isNew ? ' · NEW' : ''}</span><h3>{s.name}</h3><p>{s.tagline}</p></div>
                                        </div>
                                        <ul className="lrows">
                                            {s.lessons.map((l, i) => (
                                                <li key={l.id}><span className="ln">{String(i + 1).padStart(2, '0')}</span><span className="lname">{l.name}</span></li>
                                            ))}
                                        </ul>
                                        <div className="lfoot"><span className="open">{s.available ? 'Open →' : 'Coming soon'}</span></div>
                                    </>
                                );
                                const pinner = (
                                    <>
                                        <div className="pband"><div><span className="kick">{s.kicker}{isNew ? ' · NEW' : ''}</span><h3>{s.name}</h3></div>{s.available && <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>}</div>
                                        <div className="pbody"><p>{s.lessons.map(l => l.name).join(' · ')}</p><span className="pstat">{statusLine(s, st)}</span></div>
                                    </>
                                );
                                return s.available ? (
                                    <div key={s.id} className="msubj" style={vars(s)}>
                                        <Link className="mcard desk" to={s.route}>{inner}</Link>
                                        <Link className="pcard phoneonly" to={s.route}>{pinner}</Link>
                                    </div>
                                ) : (
                                    <div key={s.id} className="msubj" style={vars(s)}>
                                        <div className="mcard desk soon" aria-disabled="true">{inner}</div>
                                        <div className="pcard phoneonly soon" aria-disabled="true">{pinner}</div>
                                    </div>
                                );
                            })}
                        </div>
                        <aside className="mside">
                            <section className="msaved">
                                <div className="row between"><h2>Saved</h2><Link className="seeall" to="/qm">See all</Link></div>
                                {views.length === 0 ? <p className="mempty">Things you save show up here.</p> : (
                                    <ul>
                                        {views.slice(0, 4).map(v => (
                                            <li key={v.item.id}>
                                                <button type="button" onClick={() => open('/' + v.item.lesson, v)}>
                                                    <span className="mbadge" style={{ '--bc': v.lesson?.color || '#888' } as CSS}>{v.lesson?.letter || '?'}</span>
                                                    <span className="sname">{v.item.name}</span>
                                                    <span className="sres">{shortResultOf(v)}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                            <div className="mmore"><b>+ More courses</b><span>Coming soon</span></div>
                        </aside>
                    </div>

                    <div className="mfoot phoneonly">
                        <Link to="/qm" className="seeall">{views.length} saved →</Link>
                    </div>
                </div>
            </section></main>
        </div>
    );
}

const shortResultOf = (v: SavedView) => (v.result ? shortResult(v.result) : '');
