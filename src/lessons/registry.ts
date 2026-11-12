/* Subjects and lessons. A new subject only needs an entry here, plus a solver and a viz for its lessons. */
import { buildSteps, type SimplexProblem } from '../lib/simplex/solver';
import { graphicalSummary } from '../lib/graphical/solver';
import { transportSummary } from '../lib/transportation/solver';
import { lessonsOfSubject } from './dsa/meta';

export interface SavedSummary { method: string; result: string }
export interface LessonMeta {
    id: string;                 // storage id and route slug
    number: number;
    title: string;              // "Simplex Method"
    short: string;              // "Simplex" (pill switch)
    bullets: [string, string, string];
    thirdTab: 'Tables' | 'Graph';
    /** not built yet: shown on the lessons page as Coming soon */
    soon?: boolean;
    /** describes a saved problem of this lesson for the "Saved in this subject" table */
    summarize: (problem: unknown) => SavedSummary;
}
export interface SubjectSection { title: string; blurb: string; lessons: LessonMeta[] }
/** a subject can group its lessons in sections on its lessons page (each one numbers its own lessons from 1) */
export interface SubjectMeta { id: string; title: string; blurb: string; lessons: LessonMeta[]; sections?: SubjectSection[] }

const simplexSummary = (problem: unknown): SavedSummary => {
    const p = problem as SimplexProblem;
    const method = p.mode === 'max' ? 'Max' : 'Min';
    try {
        const r = buildSteps(p);
        if (r.error) return { method, result: '—' };
        if (!r.result) return { method, result: 'Unbounded' };
        if (!r.result.feasible) return { method, result: 'No feasible solution' };
        return { method, result: (p.mode === 'max' ? 'Max' : 'Min') + ' Z = ' + (p.cur || '') + r.result.z };
    } catch { return { method, result: '—' }; }
};

export const SUBJECTS: SubjectMeta[] = [
    {
        id: 'qm',
        title: 'Quantitative Methods',
        blurb: 'Optimization step by step: draw it, solve it with tables, and ship goods at the lowest cost.',
        lessons: [
            {
                id: 'graphical', number: 1, title: 'Graphical Method', short: 'Graphical', thirdTab: 'Graph',
                bullets: ['Plot each constraint line from its intercepts', 'Shade the feasible region and find its corners', 'Test every corner in the objective'],
                summarize: graphicalSummary
            },
            {
                id: 'simplex', number: 2, title: 'Simplex Method', short: 'Simplex', thirdTab: 'Tables',
                bullets: ['Max and Min problems with ≤, ≥ and = (Big-M)', 'Every Zj, Cj − Zj and ratio, one cell at a time', 'Arrows show where each number comes from'],
                summarize: simplexSummary
            },
            {
                id: 'transportation', number: 3, title: 'Transportation Problem', short: 'Transportation', thirdTab: 'Tables',
                bullets: ['Balance supply and demand with a Dummy', 'Northwest Corner or Least Cost starting solution', 'Improve it with MODI until the cost is lowest'],
                summarize: transportSummary
            }
        ]
    }
];

const cLessons = (subject: 'prog1' | 'prog2' | 'dsa') => lessonsOfSubject(subject).map((m, i) => ({
    id: m.id, number: i + 1, title: m.title, short: m.title, thirdTab: 'Tables' as const, bullets: m.bullets,
    summarize: () => ({ method: 'C code', result: '' })
}));
const prog1Section: SubjectSection = { title: 'Programming 1', blurb: 'The basics of C: syntax, variables, data types, loops and functions, up to your first pointer.', lessons: cLessons('prog1') };
const prog2Section: SubjectSection = { title: 'Programming 2', blurb: 'From pointers to linked lists: arrays, recursion, sorting, structs and dynamic memory.', lessons: cLessons('prog2') };
const dsaSection: SubjectSection = { title: 'Data Structures & Algorithms', blurb: 'Step through any C code and see the stack and heap.', lessons: cLessons('dsa') };
export const DSA_SUBJECT: SubjectMeta = {
    id: 'dsa',
    title: 'C Programming',
    blurb: 'Step through any C code and see the stack and heap.',
    lessons: [...prog1Section.lessons, ...prog2Section.lessons, ...dsaSection.lessons],
    sections: [prog1Section, prog2Section, dsaSection]       // Programming 1, then Programming 2, then Data Structures & Algorithms
};
SUBJECTS.push(DSA_SUBJECT);

export const findSubject = (id: string) => SUBJECTS.find(s => s.id === id);
export const findLesson = (subject: string, lesson: string) => findSubject(subject)?.lessons.find(l => l.id === lesson);
