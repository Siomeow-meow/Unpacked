import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { findSubject, type LessonMeta } from '../lessons/registry';
import { InstallButton } from '../components/InstallButton';
import { WhatsNewButton } from '../components/WhatsNew';
import { KEYS, loadLast, loadProgress, loadSaved, store, type LastLesson, type SavedItem } from '../lib/storage';
import { LessonPreview, Logo, Thumb, useOfflineReady } from './homeParts';
import { VisualizerCard } from './VisualizerCard';

const BADGE: Record<string, { letter: string; color: string }> = {
    graphical: { letter: 'G', color: '#1c7ed6' },
    simplex: { letter: 'S', color: '#e8590c' },
    transportation: { letter: 'T', color: '#2b8a3e' }
};
/** "P = ₱41000 at (30, 40)" -> "₱41000" */
const shortResult = (r: string) => r.split(' at ')[0].split('=').pop()?.trim() || r;

export default function SubjectPage() {
    const nav = useNavigate();
    const { subject: sid = '' } = useParams();
    const subject = findSubject(sid);
    const [q, setQ] = useState('');
    const [last, setLast] = useState<LastLesson | null>(null);
    const [saved, setSaved] = useState<SavedItem[]>([]);
    const [progress, setProgress] = useState(loadProgress());
    const search = useRef<HTMLInputElement>(null);
    const offline = useOfflineReady();
    useEffect(() => { setLast(loadLast()); setSaved(loadSaved().filter(x => !!subject && subject.lessons.some(l => l.id === x.lesson))); setProgress(loadProgress()); }, []);

    /* press "/" to jump to the search box */
    useEffect(() => {
        const k = (e: KeyboardEvent) => {
            const el = document.activeElement;
            if (e.key === '/' && !(el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) && !document.querySelector('dialog[open]')) { e.preventDefault(); search.current?.focus(); }
        };
        document.addEventListener('keydown', k);
        return () => document.removeEventListener('keydown', k);
    }, []);

    const lessons = subject ? subject.lessons.map(l => ({ subject, lesson: l })) : [];
    const find = (id: string) => lessons.find(x => x.lesson.id === id);
    const route = (l: LessonMeta, sid = 'qm') => '/' + sid + '/' + l.id;
    const summary = (it: SavedItem) => { const x = find(it.lesson); return x ? x.lesson.summarize(it.problem) : { method: '', result: '' }; };

    /* the lesson you were last on, with its problem's result */
    const cont = last ? find(last.lesson) : undefined;
    const contSession = cont ? store.get<{ P?: unknown; solvedP?: unknown } | null>(KEYS.lesson(cont.lesson.id), null) : null;
    const contProblem = contSession ? (contSession.solvedP || contSession.P) : null;
    const contSum = cont && contProblem ? cont.lesson.summarize(contProblem) : null;
    const contName = contProblem ? saved.find(s => JSON.stringify(s.problem) === JSON.stringify(contProblem))?.name : undefined;
    const prog = last ? progress[last.lesson] : undefined;
    const finished = !!prog && prog.max >= prog.total - 1;

    /* "solve a new problem" opens the lesson on its Problem tab */
    const newProblem = () => {
        if (!cont) return;
        const s = store.get<Record<string, unknown> | null>(KEYS.lesson(cont.lesson.id), null);
        if (s) store.set(KEYS.lesson(cont.lesson.id), { ...s, tab: 1 });
        nav(route(cont.lesson, cont.subject.id));
    };

    const query = q.trim().toLowerCase();
    const hitLessons = useMemo(() => lessons.filter(({ lesson, subject }) => (lesson.title + ' ' + subject.title + ' ' + lesson.bullets.join(' ')).toLowerCase().includes(query)), [query, subject]);   // eslint-disable-line react-hooks/exhaustive-deps
    const hitSaved = useMemo(() => saved.filter(it => { const x = find(it.lesson), s = summary(it); return (it.name + ' ' + (x?.lesson.title || '') + ' ' + s.method + ' ' + s.result).toLowerCase().includes(query); }), [query, saved]);   // eslint-disable-line react-hooks/exhaustive-deps

    const nextId = last && lessons.some(x => x.lesson.id === last.lesson && !x.lesson.soon) ? last.lesson : undefined;   // highlighted: the lesson you left off at
    const savedCount = (id: string) => saved.filter(s => s.lesson === id).length;

    const lessonStatus = (l: LessonMeta) => (l.soon ? <span className="st">Coming soon</span> : <span className="st go">Start lesson →</span>);

    if (!subject) return <Navigate to="/" replace />;

    return (
        <div className="app home">
            <header className="hh">
                <Link to="/" className="brandlink" aria-label="Unpacked home"><Logo /><span>Unpacked</span></Link>
                <label className="searchbox">
                    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                    <input ref={search} id="q" type="search" placeholder="Search lessons, methods, saved problems" aria-label="Search lessons, methods, saved problems" value={q} onChange={e => setQ(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') { setQ(''); search.current?.blur(); } }} />
                    <kbd>/</kbd>
                </label>
                <div className="hhr">
                    {offline && <span className="ready"><i />Offline ready</span>}
                    <InstallButton />
                    <WhatsNewButton />
                </div>
            </header>

            <main><section className="pane">
                <div className={'homegrid multi'}>
                    {query ? (
                        <section className="card results">
                            <h2>Lessons</h2>
                            {hitLessons.length === 0 && <p className="hint">No lesson matches “{q.trim()}”.</p>}
                            <div className="rl">
                                {hitLessons.map(({ subject, lesson }) => (
                                    <Link key={lesson.id} className="ritem" to={route(lesson, subject.id)}><Thumb id={lesson.id} /><span><b>{lesson.title}</b><small>{subject.title} · Lesson {lesson.number}</small></span></Link>
                                ))}
                            </div>
                            <h2>Saved problems</h2>
                            {hitSaved.length === 0 && <p className="hint">No saved problem matches.</p>}
                            <div className="rl">
                                {hitSaved.map(it => { const s = summary(it), b = BADGE[it.lesson]; return (
                                    <Link key={it.id} className="ritem" to={'/qm/' + it.lesson}><span className="badge" style={{ background: b?.color }}>{b?.letter}</span><span><b>{it.name}</b><small>{find(it.lesson)?.lesson.short} · {s.method}</small></span><span className="val">{shortResult(s.result)}</span></Link>
                                ); })}
                            </div>
                        </section>
                    ) : (
                        <>
                            {subject.id === 'dsa' ? <VisualizerCard /> : (
                                <>
                            <section className="card pick">
                                {cont && last ? (
                                    <>
                                        <div className="pickText">
                                            <span className="eyebrow">Pick up where you left off</span>
                                            <h2>{cont.lesson.title}</h2>
                                            <p className="muted">{contName || 'Your problem'} · {cont.subject.title}</p>
                                            {contSum && contSum.result !== '—' && <span className="chipres">{contSum.result}</span>}
                                            {prog && <span className="muted small">{finished ? 'Finished · ' + prog.total + ' of ' + prog.total + ' steps' : 'Step ' + (prog.idx + 1) + ' of ' + prog.total}</span>}
                                            <div className="pickBtns">
                                                <Link className="btn primary" to={route(cont.lesson, cont.subject.id)}>{finished ? 'Review the steps' : 'Continue'}</Link>
                                                <button className="btn" type="button" onClick={newProblem}>Solve a new problem</button>
                                            </div>
                                        </div>
                                        <LessonPreview lesson={cont.lesson.id} />
                                    </>
                                ) : (
                                    <div className="pickText">
                                        <span className="eyebrow">Start here</span>
                                        <h2>{lessons[0].lesson.title}</h2>
                                        <p className="muted">{lessons[0].subject.title}. {lessons[0].lesson.bullets[0]}.</p>
                                        <div className="pickBtns"><Link className="btn primary" to={route(lessons[0].lesson, lessons[0].subject.id)}>Open the first lesson</Link></div>
                                    </div>
                                )}
                            </section>

                            <section className="card savedcard">
                                <div className="row between"><h2>Saved problems</h2></div>
                                {saved.length === 0 ? <p className="hint">Nothing saved yet. Save a problem inside a lesson and it will show up here.</p> : (
                                    <ul className="sl">
                                        {saved.slice(0, 4).map(it => { const s = summary(it), b = BADGE[it.lesson], x = find(it.lesson); return (
                                            <li key={it.id}><Link to={'/qm/' + it.lesson}>
                                                <span className="badge" style={{ background: b?.color }}>{b?.letter}</span>
                                                <span className="sn"><b>{it.name}</b><small>{x?.lesson.short} · {s.method}</small></span>
                                                <span className="val">{shortResult(s.result)}</span>
                                            </Link></li>
                                        ); })}
                                    </ul>
                                )}
                                <p className="note">Stored only in this browser. Use Export inside a lesson to back up.</p>
                            </section>

                                </>
                            )}
                            <section className="subjrow">
                                {(subject!.sections || [{ title: subject!.title, blurb: subject!.blurb, lessons: subject!.lessons }]).map((s, si, all) => (
                                    <div key={s.title} className="subjwrap">
                                        <div className="row between subjhead">
                                            <h2>{s.title} <small>{s.blurb}</small></h2>
                                            <span className="muted small">{s.lessons.filter(l => progress[l.id]).length} of {s.lessons.length} lessons tried</span>
                                        </div>
                                        <div className={'path many'}>
                                            {s.lessons.map((l, i) => (
                                                <div key={l.id} className="pstep">
                                                    {l.soon ? (
                                                        <div className="card lcardH soon" aria-disabled="true">
                                                            <div className="lvis"><Thumb id={l.id} /><b className="lvt"><span className="num">{l.number}</span><span>{l.title}</span></b></div>
                                                            <div className="lt"><ul>{l.bullets.map(x => <li key={x}>{x}</li>)}</ul>{lessonStatus(l)}</div>
                                                        </div>
                                                    ) : (
                                                        <Link className={'card lcardH' + (l.id === nextId ? ' next' : '')} to={route(l, subject!.id)}>
                                                            <div className="lvis"><Thumb id={l.id} /><b className="lvt"><span className="num">{l.number}</span><span>{l.title}</span></b></div>
                                                            <div className="lt"><ul>{l.bullets.map(x => <li key={x}>{x}</li>)}</ul>{lessonStatus(l)}</div>
                                                        </Link>
                                                    )}
                                                    {i < s.lessons.length - 1 && (
                                                        <svg className="arrw" viewBox="0 0 40 24" aria-hidden="true"><path d="M2 18q14-16 32-8" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" /><path d="M30 5l5 5-7 3" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                    )}
                                                </div>
                                            ))}
                                            {si === all.length - 1 && <div className="card more"><b>{s.lessons.length > 4 ? '+ More lessons' : '+ More courses'}</b><span className="muted small">Coming soon</span></div>}
                                        </div>
                                    </div>
                                ))}
                            </section>
                        </>
                    )}
                </div>
            </section></main>
        </div>
    );
}
