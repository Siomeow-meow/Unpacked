/* The rules behind the main page, kept free of React so they can be tested:
   lesson statuses ("Finished", "In progress", "Up next"...), segmented progress bars, and the order of the Continue cards. */
import type { LessonProgress, ProgressMap } from '../lib/storage';
import type { SubjectEntry, SubjectLesson } from '../subjects';

export type StatusKind = 'finished' | 'progress' | 'next' | 'saved' | 'soon' | 'none';
export interface Status { kind: StatusKind; label: string }

export const isStarted = (p?: LessonProgress): boolean => !!p && p.total > 0;
export const isFinished = (p?: LessonProgress): boolean => !!p && p.total > 0 && p.max >= p.total - 1;
/** In progress = it has a saved step but is not finished */
export const isInProgress = (p?: LessonProgress): boolean => isStarted(p) && !isFinished(p);

/** The first available lesson, in order, that has not been started. */
export function upNextId(lessons: SubjectLesson[], progress: ProgressMap): string | undefined {
    return lessons.find(l => l.available && !isStarted(progress[l.id]))?.id;
}

export function lessonStatuses(lessons: SubjectLesson[], progress: ProgressMap, saved: Record<string, number> = {}): Status[] {
    const next = upNextId(lessons, progress);
    return lessons.map(l => {
        const p = progress[l.id];
        if (!l.available) return { kind: 'soon', label: 'Coming soon' };
        if (isFinished(p)) return { kind: 'finished', label: '✓ Finished' };
        if (isInProgress(p)) return { kind: 'progress', label: 'In progress' };
        if (l.id === next) return { kind: 'next', label: 'Up next' };
        if ((saved[l.id] || 0) > 0) return { kind: 'saved', label: saved[l.id] + ' saved' };
        return { kind: 'none', label: 'Not started' };
    });
}

/** One segment per lesson: finished, in progress, or not started. */
/** "1 finished · next: Transportation" (the phone card's status line) */
export function statusLine(subject: SubjectEntry, st: Status[]): string {
    if (!subject.available) return 'Coming soon';
    const done = st.filter(s => s.kind === 'finished').length;
    const nextI = st.findIndex(s => s.kind === 'next');
    const parts: string[] = [];
    if (done) parts.push(done + ' finished');
    const prog = st.filter(s => s.kind === 'progress').length;
    if (prog) parts.push(prog + ' in progress');
    if (nextI >= 0) parts.push('next: ' + subject.lessons[nextI].name);
    return parts.length ? parts.join(' · ') : 'Not started';
}

export interface ContinueCard { subject: SubjectEntry; lesson: SubjectLesson; progress: LessonProgress }

/** The most recently opened lesson of every subject that has history, newest first (at most `limit`). */
export function continueCards(subjects: SubjectEntry[], progress: ProgressMap, limit = 2): ContinueCard[] {
    const cards: (ContinueCard & { order: number })[] = [];
    subjects.forEach((subject, order) => {
        let best: ContinueCard | null = null;
        subject.lessons.forEach(lesson => {
            const p = progress[lesson.id];
            if (!lesson.available || !isStarted(p)) return;
            if (!best || (p!.ts || 0) > (best.progress.ts || 0)) best = { subject, lesson, progress: p as LessonProgress };
        });
        if (best) cards.push({ ...(best as ContinueCard), order });
    });
    cards.sort((a, b) => (b.progress.ts || 0) - (a.progress.ts || 0) || a.order - b.order);
    return cards.slice(0, limit).map(({ order, ...c }) => { void order; return c; });
}
