import { describe, expect, it } from 'vitest';
import { SUBJECT_ENTRIES, findLessonEntry, lessonCount, subjectCount, type SubjectEntry } from '../subjects';
import { continueCards, isFinished, isInProgress, lessonStatuses, statusLine, upNextId } from './logic';
import type { ProgressMap } from '../lib/storage';
import { LATEST_VERSION } from '../changelog';
import { findLesson } from '../lessons/registry';

const qm = SUBJECT_ENTRIES[0], dsa = SUBJECT_ENTRIES[1];
const P = (idx: number, max: number, total: number, ts: number) => ({ idx, max, total, ts });

describe('subject registry', () => {
    it('has the courses Quantitative Methods and C Programming, in that order', () => {
        expect(SUBJECT_ENTRIES.map(s => s.id)).toEqual(['qm', 'dsa']);
        expect(qm.tagline).toBe('Linear programming, step by step');
        expect(dsa.tagline).toBe('Step through any C code and see the stack and heap');
    });
    it('lists the lessons in order, and the counts come from the registry', () => {
        expect(qm.lessons.map(l => l.name)).toEqual(['Graphical Method', 'Simplex Method', 'Transportation']);
        expect(dsa.lessons.length).toBe(24);
        expect(dsa.lessons[0].name).toBe('Hello World & Syntax');
        expect(subjectCount()).toBe(2);
        expect(lessonCount()).toBe(3 + dsa.lessons.length);
    });
    it('both subjects are available with every lesson built', () => {
        expect(qm.available).toBe(true); expect(qm.lessons.every(l => l.available)).toBe(true);
        expect(dsa.available).toBe(true); expect(dsa.lessons.every(l => l.available)).toBe(true);
    });
    it('every available lesson exists in the lesson registry', () => {
        qm.lessons.forEach(l => expect(findLesson('qm', l.id)).toBeDefined());
    });
    it('only the subject added in the latest version is marked NEW', () => {
        expect(SUBJECT_ENTRIES.filter(s => s.since === LATEST_VERSION).map(s => s.id)).toEqual(['dsa']);
    });
    it('finds a lesson and its subject by id', () => { expect(findLessonEntry('simplex')?.subject.id).toBe('qm'); expect(findLessonEntry('nope')).toBeUndefined(); });
    it('adding a third subject needs only a registry entry', () => {
        const third: SubjectEntry = { ...qm, id: 'x', route: '/x', name: 'X', lessons: [{ id: 'x1', name: 'X1', route: '/x/x1', available: true, letter: 'X', color: '#000' }] };
        const all = [...SUBJECT_ENTRIES, third];
        expect(subjectCount(all)).toBe(3);
        expect(continueCards(all, { x1: P(2, 2, 10, 999) }, 5)[0].subject.id).toBe('x');
    });
});

describe('finished / in progress', () => {
    it('finished = reached the last step at some point', () => {
        expect(isFinished(P(18, 18, 19, 1))).toBe(true);
        expect(isFinished(P(3, 18, 19, 1))).toBe(true);        // went back, but it was finished
        expect(isFinished(P(3, 3, 19, 1))).toBe(false);
        expect(isFinished(undefined)).toBe(false);
    });
    it('in progress = has a saved step but is not finished', () => {
        expect(isInProgress(P(0, 0, 19, 1))).toBe(true);
        expect(isInProgress(P(18, 18, 19, 1))).toBe(false);
        expect(isInProgress(undefined)).toBe(false);
    });
});

describe('lesson statuses and Up next', () => {
    it('a fresh user: the first lesson is Up next, the others Not started', () => {
        const st = lessonStatuses(qm.lessons, {});
        expect(st.map(s => s.label)).toEqual(['Up next', 'Not started', 'Not started']);
        expect(upNextId(qm.lessons, {})).toBe('graphical');
    });
    it('Finished, In progress and Up next together', () => {
        const prog: ProgressMap = { graphical: P(18, 18, 19, 1) };
        expect(lessonStatuses(qm.lessons, prog).map(s => s.label)).toEqual(['✓ Finished', 'Up next', 'Not started']);
        const prog2: ProgressMap = { graphical: P(18, 18, 19, 1), simplex: P(5, 5, 62, 2) };
        expect(lessonStatuses(qm.lessons, prog2).map(s => s.label)).toEqual(['✓ Finished', 'In progress', 'Up next']);
        expect(upNextId(qm.lessons, prog2)).toBe('transportation');
    });
    it('"N saved" shows for a lesson that has saved problems and is not the next one', () => {
        const st = lessonStatuses(qm.lessons, { graphical: P(18, 18, 19, 1) }, { transportation: 2 });
        expect(st.map(s => s.label)).toEqual(['✓ Finished', 'Up next', '2 saved']);
    });
    it('lessons that are not built read Coming soon and are never Up next', () => {
        const unbuilt = [{ ...dsa.lessons[0] }, { ...dsa.lessons[1], available: false }];
        expect(lessonStatuses(unbuilt, {}).map(s => s.label)).toEqual(['Up next', 'Coming soon']);
        expect(lessonStatuses(unbuilt, { [dsa.lessons[0].id]: P(3, 3, 52, 1) }).map(s => s.label)).toEqual(['In progress', 'Coming soon']);
        expect(upNextId(unbuilt, { [dsa.lessons[0].id]: P(3, 3, 52, 1) })).toBeUndefined();
    });
    it('everything finished: no Up next', () => {
        const all: ProgressMap = { graphical: P(1, 1, 2, 1), simplex: P(1, 1, 2, 1), transportation: P(1, 1, 2, 1) };
        expect(lessonStatuses(qm.lessons, all).every(s => s.kind === 'finished')).toBe(true);
        expect(upNextId(qm.lessons, all)).toBeUndefined();
    });
    it('the phone status line', () => {
        const prog: ProgressMap = { graphical: P(18, 18, 19, 1), simplex: P(5, 5, 62, 2) };
        const st = lessonStatuses(qm.lessons, prog);
        expect(statusLine(qm, st)).toBe('1 finished · 1 in progress · next: Transportation');
        expect(statusLine(qm, lessonStatuses(qm.lessons, { graphical: P(18, 18, 19, 1) }))).toBe('1 finished · next: Simplex Method');
        expect(statusLine(dsa, lessonStatuses(dsa.lessons, {}))).toBe('next: Hello World & Syntax');
    });
});

describe('Continue ordering', () => {
    it('nothing started: no cards (the page shows "Start with Lesson 1")', () => { expect(continueCards(SUBJECT_ENTRIES, {})).toEqual([]); });
    it('one card per subject: its most recently opened lesson', () => {
        const prog: ProgressMap = { graphical: P(18, 18, 19, 100), simplex: P(5, 5, 62, 300), transportation: P(1, 1, 92, 200) };
        const c = continueCards(SUBJECT_ENTRIES, prog);
        expect(c).toHaveLength(1);
        expect(c[0].lesson.id).toBe('simplex');
    });
    it('newest first across subjects, at most the limit', () => {
        const third: SubjectEntry = { ...qm, id: 'x', route: '/x', name: 'X', lessons: [{ id: 'x1', name: 'X1', route: '/x/x1', available: true, letter: 'X', color: '#000' }] };
        const fourth: SubjectEntry = { ...third, id: 'y', lessons: [{ ...third.lessons[0], id: 'y1' }] };
        const subs = [qm, third, fourth];
        const prog: ProgressMap = { graphical: P(0, 0, 19, 10), x1: P(0, 0, 5, 30), y1: P(0, 0, 5, 20) };
        expect(continueCards(subs, prog, 2).map(c => c.lesson.id)).toEqual(['x1', 'y1']);
        expect(continueCards(subs, prog, 5).map(c => c.lesson.id)).toEqual(['x1', 'y1', 'graphical']);
    });
    it('ties keep the registry order, and lessons that are not available never appear', () => {
        const subsX = [qm, { ...dsa, lessons: [{ ...dsa.lessons[0], available: false }] }];
        const prog: ProgressMap = { graphical: P(0, 0, 19, 5), adt: P(0, 0, 10, 99) };
        expect(continueCards(subsX, prog).map(c => c.lesson.id)).toEqual(["graphical"]);
        const subs = [qm, { ...qm, id: 'q2', lessons: [{ ...qm.lessons[0], id: 'g2' }] }];
        expect(continueCards(subs, { graphical: P(0, 0, 19, 5), g2: P(0, 0, 19, 5) }).map(c => c.lesson.id)).toEqual(['graphical', 'g2']);
    });
});

describe('the C Programming lessons page has three sections', () => {
    it('Programming 1, Programming 2, then Data Structures & Algorithms, each numbering its own lessons', async () => {
        const { findSubject } = await import('../lessons/registry');
        const sections = findSubject('dsa')!.sections!;
        expect(sections.map(x => x.title)).toEqual(['Programming 1', 'Programming 2', 'Data Structures & Algorithms']);
        expect(sections.map(x => x.lessons.length)).toEqual([8, 8, 8]);
        expect(sections[1].lessons.map(l => l.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        expect(sections[1].lessons.map(l => l.title)).toContain('Linked List');
        expect(sections[2].lessons.map(l => l.title)).toEqual(['Stack & Queue', 'Cursor-Based', 'Sets', 'Hashing', 'Dictionary', 'Trees', 'Binary Heap', 'Graphs']);
    });
});

describe('nextLessonOf: the Next lesson button', () => {
    it('is the next lesson of the same course', async () => {
        const { nextLessonOf } = await import('../subjects');
        expect(nextLessonOf('graphical')?.id).toBe('simplex');
        expect(nextLessonOf('simplex')?.route).toBe('/qm/transportation');
        expect(nextLessonOf('hello')?.id).toBe('variables');
    });
    it('goes on from one section into the next, and ends with the last lesson', async () => {
        const { nextLessonOf } = await import('../subjects');
        expect(nextLessonOf('pointers1')?.id).toBe('pointers');        // Programming 1 -> Programming 2
        expect(nextLessonOf('linkedlist')?.id).toBe('stackqueue');     // Programming 2 -> Data Structures & Algorithms
        expect(nextLessonOf('graphs')).toBeUndefined();
        expect(nextLessonOf('transportation')).toBeUndefined();
        expect(nextLessonOf('visualizer')).toBeUndefined();
    });
});
