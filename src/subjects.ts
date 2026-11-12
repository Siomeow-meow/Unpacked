/* The subjects shown on the main page. Adding a subject = adding one entry here (and its cover in covers.tsx). */
import type { ComponentType } from 'react';
import { DsaCover, QmCover } from './covers';
import { DSA_META } from './lessons/dsa/meta';

export interface SubjectLesson {
    id: string;               // storage / route id of the lesson
    name: string;
    route: string;            // e.g. /qm/graphical
    available: boolean;
    letter: string;           // shown in thumbs and badges
    color: string;            // the lesson's own colour (badges)
}
export interface SubjectEntry {
    id: string;
    route: string;            // e.g. /qm
    name: string;
    short: string;            // phone cards
    kicker: string;           // "COURSE 1"
    tagline: string;
    since: string;            // version it appeared in; a subject added in the latest version is marked NEW
    color: string;            // accent (borders, buttons, in-progress); a CSS variable defined in app.css for both themes
    ink: string;              // accent used for text
    tint: string;             // tinted background
    on: string;               // text on a solid accent button
    cover: ComponentType;
    lessons: SubjectLesson[];
    /** false until any lesson of the subject is built: its card is not a link */
    available: boolean;
}

export const SUBJECT_ENTRIES: SubjectEntry[] = [
    {
        id: 'qm', route: '/qm', name: 'Quantitative Methods', short: 'Quant. Methods', kicker: 'COURSE 1', tagline: 'Linear programming, step by step', since: 'v1',
        color: 'var(--s-qm)', ink: 'var(--s-qm-ink)', tint: 'var(--s-qm-tint)', on: 'var(--s-qm-on)', cover: QmCover, available: true,
        lessons: [
            { id: 'graphical', name: 'Graphical Method', route: '/qm/graphical', available: true, letter: 'G', color: '#1c7ed6' },
            { id: 'simplex', name: 'Simplex Method', route: '/qm/simplex', available: true, letter: 'S', color: '#e8590c' },
            { id: 'transportation', name: 'Transportation', route: '/qm/transportation', available: true, letter: 'T', color: '#2b8a3e' }
        ]
    },
    {
        id: 'dsa', route: '/dsa', name: 'C Programming', short: 'C Programming', kicker: 'COURSE 2', tagline: 'Step through any C code and see the stack and heap', since: 'v2.0',
        color: 'var(--s-dsa)', ink: 'var(--s-dsa-ink)', tint: 'var(--s-dsa-tint)', on: 'var(--s-dsa-on)', cover: DsaCover, available: true,
        lessons: DSA_META.map(m => ({ id: m.id, name: m.title, route: '/dsa/' + m.id, available: true, letter: '{ }', color: '#e0a800' }))
    }
];

export const subjectCount = (s: SubjectEntry[] = SUBJECT_ENTRIES) => s.length;
export const lessonCount = (s: SubjectEntry[] = SUBJECT_ENTRIES) => s.reduce((n, x) => n + x.lessons.length, 0);
export const findLessonEntry = (lessonId: string) => {
    for (const s of SUBJECT_ENTRIES) { const l = s.lessons.find(x => x.id === lessonId); if (l) return { subject: s, lesson: l }; }
    return undefined;
};

/** the lesson after this one in its course, if there is one (a lesson at the end of a section goes on into the next section) */
export const nextLessonOf = (lessonId: string): SubjectLesson | undefined => {
    const f = findLessonEntry(lessonId);
    if (!f) return undefined;
    const i = f.subject.lessons.findIndex(l => l.id === lessonId);
    const n = f.subject.lessons[i + 1];
    return n && n.available ? n : undefined;
};
