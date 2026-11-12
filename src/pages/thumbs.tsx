/* One small picture per Data Structures & Algorithms lesson, each one showing what the lesson is about (72 x 56 units).
   Yellow marks the thing being looked at, green the thing that changes. */
import type { ReactNode } from 'react';

const Y = '#e0a800', G = '#2b8a3e';
const MONO = 'ui-monospace, Consolas, monospace';
const box = { fill: 'var(--card)', stroke: 'var(--line)', strokeWidth: 1.2 } as const;
const T = (x: number, y: number, t: string, fill = 'var(--ink)', size = 7) => <text x={x} y={y} textAnchor="middle" fontFamily={MONO} fontSize={size} fontWeight="700" fill={fill}>{t}</text>;
const head = (x: number, y: number, dir: 'r' | 'l' | 'u' | 'd', c: string) => {
    const d = { r: 'M-4 -2.6L0 0L-4 2.6', l: 'M4 -2.6L0 0L4 2.6', d: 'M-2.6 -4L0 0L2.6 -4', u: 'M-2.6 4L0 0L2.6 4' }[dir];
    return <path d={d} transform={'translate(' + x + ',' + y + ')'} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />;
};
const S = ({ children }: { children: ReactNode }) => <svg viewBox="0 0 72 56" preserveAspectRatio="xMaxYMid meet" className="thumb" aria-hidden="true">{children}</svg>;

export const DSA_THUMBS: Record<string, ReactNode> = {
    /* an array list with a new value inserted at position 1 */
    adt: (
        <S>
            {[10, 15, 20, 30].map((v, i) => (
                <g key={i}>
                    <rect x={8 + i * 14} y="26" width="14" height="14" {...box} fill={i === 1 ? 'color-mix(in srgb, ' + G + ' 28%, var(--card))' : 'var(--card)'} stroke={i === 1 ? G : 'var(--line)'} />
                    {T(15 + i * 14, 36, String(v), i === 1 ? G : 'var(--ink)')}
                    {T(15 + i * 14, 48, String(i), 'var(--muted)', 5)}
                </g>
            ))}
            <path d="M29 6V22" stroke={G} strokeWidth="1.6" fill="none" />{head(29, 24, 'd', G)}
        </S>
    ),
    /* cells that hold the index of the next cell instead of a pointer */
    cursor: (
        <S>
            {['2', '', '3', '×'].map((v, i) => (
                <g key={i}>
                    <rect x={6 + i * 16} y="30" width="15" height="14" {...box} stroke={i === 0 ? Y : 'var(--line)'} />
                    {T(13.5 + i * 16, 40, v, v === '×' ? 'var(--muted)' : 'var(--ink)')}
                    {T(13.5 + i * 16, 52, String(i), 'var(--muted)', 5)}
                </g>
            ))}
            <path d="M13.5 28Q29.5 8 45.5 27" stroke={Y} strokeWidth="1.6" fill="none" />{head(45.5, 28, 'd', Y)}
            <path d="M45.5 28Q53.5 14 61.5 27" stroke={Y} strokeWidth="1.6" fill="none" />{head(61.5, 28, 'd', Y)}
        </S>
    ),
    /* a stack (push and pop at the top) next to a queue (in at the back, out at the front) */
    stackqueue: (
        <S>
            {[0, 1, 2].map(i => <rect key={i} x="8" y={14 + i * 12} width="22" height="10" rx="2" {...box} stroke={i === 0 ? Y : 'var(--line)'} />)}
            <path d="M19 2V10" stroke={Y} strokeWidth="1.6" fill="none" />{head(19, 12, 'd', Y)}
            {[0, 1, 2].map(i => <rect key={i} x={40 + i * 10.5} y="22" width="10" height="14" rx="2" {...box} stroke={i === 2 ? G : 'var(--line)'} />)}
            <path d="M40 46H66" stroke="var(--muted)" strokeWidth="1.6" fill="none" />{head(68, 46, 'r', 'var(--muted)')}
        </S>
    ),
    /* keys that map to values */
    dictionary: (
        <S>
            {[['101', 'Ana'], ['205', 'Ben'], ['309', 'Cy']].map(([k, v], i) => (
                <g key={i}>
                    <rect x="6" y={8 + i * 14} width="22" height="11" rx="2" {...box} stroke={i === 1 ? Y : 'var(--line)'} />
                    {T(17, 16.2 + i * 14, k, i === 1 ? Y : 'var(--ink)', 6.5)}
                    <path d={'M30 ' + (13.5 + i * 14) + 'H40'} stroke="var(--muted)" strokeWidth="1.3" fill="none" />{head(42, 13.5 + i * 14, 'r', 'var(--muted)')}
                    <rect x="44" y={8 + i * 14} width="22" height="11" rx="2" {...box} stroke={i === 1 ? G : 'var(--line)'} />
                    {T(55, 16.2 + i * 14, v, i === 1 ? G : 'var(--ink)', 6.5)}
                </g>
            ))}
        </S>
    ),
    /* a key goes through a hash function into one slot of a table */
    hashing: (
        <S>
            <rect x="5" y="20" width="18" height="16" rx="3" {...box} stroke={Y} />{T(14, 31, '42', Y)}
            <path d="M25 28H42" stroke={G} strokeWidth="1.6" fill="none" />{head(44, 28.5, 'r', G)}
            {T(34, 24, 'h(k)', 'var(--muted)', 5.5)}
            {[0, 1, 2, 3, 4].map(i => (
                <g key={i}>
                    <rect x="46" y={5 + i * 9.5} width="20" height="8.5" {...box} fill={i === 2 ? 'color-mix(in srgb, ' + G + ' 28%, var(--card))' : 'var(--card)'} stroke={i === 2 ? G : 'var(--line)'} />
                    {T(51, 11.6 + i * 9.5, String(i), 'var(--muted)', 5)}
                </g>
            ))}
        </S>
    ),
    /* a set stored as a row of bits */
    sets: (
        <S>
            {T(36, 15, '{ 0, 2, 3, 5 }', Y, 6.5)}
            {[1, 0, 1, 1, 0, 1, 0, 0].map((b, i) => (
                <g key={i}>
                    <rect x={4 + i * 8.5} y="22" width="8.5" height="13" {...box} fill={b ? 'color-mix(in srgb, ' + Y + ' 30%, var(--card))' : 'var(--card)'} stroke={b ? Y : 'var(--line)'} />
                    {T(8.25 + i * 8.5, 31.5, String(b), b ? 'var(--ink)' : 'var(--muted)', 6.5)}
                    {T(8.25 + i * 8.5, 45, String(i), 'var(--muted)', 5)}
                </g>
            ))}
        </S>
    ),
    /* a binary tree, with the path of a search lit */
    trees: (
        <S>
            {[[36, 10, 20, 26], [36, 10, 52, 26], [20, 26, 12, 44], [20, 26, 28, 44], [52, 26, 60, 44]].map(([x1, y1, x2, y2], i) => (
                <path key={i} d={'M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2} stroke={i === 0 || i === 3 ? Y : 'var(--line)'} strokeWidth={i === 0 || i === 3 ? 1.8 : 1.3} fill="none" />
            ))}
            {[[36, 10, 1], [20, 26, 1], [52, 26, 0], [12, 44, 0], [28, 44, 1], [60, 44, 0]].map(([x, y, on], i) => <circle key={i} cx={x} cy={y} r="6" {...box} stroke={on ? Y : 'var(--line)'} strokeWidth={on ? 1.8 : 1.2} />)}
        </S>
    ),
    /* a min-heap: the smallest on top, drawn as a tree with its array underneath */
    heap: (
        <S>
            {[[36, 8, 20, 22], [36, 8, 52, 22]].map(([x1, y1, x2, y2], i) => <path key={i} d={'M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2} stroke="var(--line)" strokeWidth="1.3" fill="none" />)}
            {[[36, 8, '1', 1], [20, 22, '3', 0], [52, 22, '5', 0]].map(([x, y, t, on], i) => <g key={i}><circle cx={x as number} cy={y as number} r="6.5" {...box} stroke={on ? Y : 'var(--line)'} strokeWidth={on ? 1.8 : 1.2} />{T(x as number, (y as number) + 2.5, String(t), on ? Y : 'var(--ink)', 7)}</g>)}
            {[1, 3, 5, 7, 4].map((v, i) => <g key={i}><rect x={11 + i * 10} y="38" width="10" height="12" {...box} stroke={i === 0 ? Y : 'var(--line)'} />{T(16 + i * 10, 47, String(v), i === 0 ? Y : 'var(--muted)', 6)}</g>)}
        </S>
    ),
    /* a text file: lines of text, with a pen writing */
    files: (
        <S>
            <path d="M16 6H44L54 16V50H16Z" {...box} stroke={Y} strokeWidth="1.6" />
            <path d="M44 6V16H54" fill="none" stroke={Y} strokeWidth="1.4" />
            {[24, 31, 38, 45].map((y, i) => <path key={i} d={'M22 ' + y + 'H' + (i === 3 ? 34 : 48)} stroke={i === 3 ? G : 'var(--line)'} strokeWidth="2" strokeLinecap="round" />)}
            <path d="M52 40L62 30" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </S>
    ),
    /* nodes joined by edges, with one path lit */
    graphs: (
        <S>
            {[[14, 16, 36, 9], [36, 9, 58, 16], [14, 16, 24, 42], [36, 9, 24, 42], [36, 9, 50, 42], [58, 16, 50, 42], [24, 42, 50, 42]].map(([x1, y1, x2, y2], i) => (
                <path key={i} d={'M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2} stroke={i === 1 || i === 5 ? Y : 'var(--line)'} strokeWidth={i === 1 || i === 5 ? 1.8 : 1.3} fill="none" />
            ))}
            {[[14, 16, 0], [36, 9, 1], [58, 16, 1], [24, 42, 0], [50, 42, 1]].map(([x, y, on], i) => <circle key={i} cx={x} cy={y} r="6" {...box} stroke={on ? Y : 'var(--line)'} strokeWidth={on ? 1.8 : 1.2} />)}
        </S>
    ),
    /* every call gets its own frame on the stack, and returns one by one */
    recursion: (
        <S>
            {[[6, 8, 54, 'n = 3'], [12, 22, 42, 'n = 2'], [18, 36, 30, 'n = 1']].map(([x, y, w, t], i) => (
                <g key={i}>
                    <rect x={x as number} y={y as number} width={w as number} height="12" rx="3" {...box} stroke={i === 2 ? Y : 'var(--line)'} />
                    {T((x as number) + (w as number) / 2, (y as number) + 9, String(t), i === 2 ? Y : 'var(--ink)', 6.5)}
                </g>
            ))}
            <path d="M64 42V16" stroke={G} strokeWidth="1.6" fill="none" strokeDasharray="3 2" />{head(64, 12, 'u', G)}
        </S>
    ),
    /* bars being sorted: two neighbours swap */
    sorting: (
        <S>
            {[30, 18, 38, 12, 26].map((h, i) => <rect key={i} x={7 + i * 12.5} y={50 - h} width="9.5" height={h} rx="1.5" fill={i === 1 || i === 2 ? 'color-mix(in srgb, ' + Y + ' 40%, var(--card))' : 'var(--card)'} stroke={i === 1 || i === 2 ? Y : 'var(--line)'} strokeWidth="1.2" />)}
            <path d="M23 10Q31 0 39 10" stroke={G} strokeWidth="1.6" fill="none" />{head(39, 11, 'd', G)}{head(23, 11, 'd', G)}
        </S>
    ),
    /* a program's first line of output */
    hello: (
        <S>
            <rect x="6" y="8" width="60" height="40" rx="4" {...box} />
            <circle cx="12" cy="14" r="1.6" fill="#e03131" /><circle cx="18" cy="14" r="1.6" fill={Y} /><circle cx="24" cy="14" r="1.6" fill={G} />
            <path d="M6 19.5H66" stroke="var(--line)" strokeWidth="1" />
            {T(24, 31, '> Hello,', G, 7.5)}{T(22, 41, 'world!', G, 7.5)}
            <rect x="38" y="35" width="4" height="7" fill={G} opacity=".8" />
        </S>
    ),
    /* three variables of different types */
    variables: (
        <S>
            {[['int', '19', Y], ['float', '2.5', G], ['char', "'A'", 'var(--ink)']].map(([ty, v, c], i) => (
                <g key={i}>
                    {T(14 + i * 22, 20, ty, 'var(--muted)', 5.5)}
                    <rect x={5 + i * 22} y="24" width="18" height="16" rx="2.5" {...box} stroke={c} strokeWidth="1.6" />
                    {T(14 + i * 22, 35, v, c, 7)}
                    {T(14 + i * 22, 49, ['age', 'price', 'grade'][i], 'var(--muted)', 5.5)}
                </g>
            ))}
        </S>
    ),
    /* the arithmetic operators */
    operators: (
        <S>
            {['+', '−', '×', '÷'].map((o, i) => (
                <g key={i}>
                    <rect x={8 + (i % 2) * 30} y={8 + Math.floor(i / 2) * 24} width="26" height="20" rx="5" {...box} stroke={i === 3 ? Y : 'var(--line)'} strokeWidth={i === 3 ? 1.8 : 1.2} />
                    {T(21 + (i % 2) * 30, 23 + Math.floor(i / 2) * 24, o, i === 3 ? Y : 'var(--ink)', 13)}
                </g>
            ))}
        </S>
    ),
    /* a decision with two ways out */
    conditions: (
        <S>
            <path d="M36 5L52 17L36 29L20 17Z" {...box} stroke={Y} strokeWidth="1.6" />
            {T(36, 20, 'x > 0', Y, 6)}
            <path d="M24 24L14 36" stroke="var(--muted)" strokeWidth="1.4" fill="none" />{head(13, 37, 'd', 'var(--muted)')}
            <path d="M48 24L58 36" stroke={G} strokeWidth="1.6" fill="none" />{head(59, 37, 'd', G)}
            <rect x="4" y="39" width="22" height="12" rx="3" {...box} />{T(15, 48, 'else', 'var(--muted)', 6.5)}
            <rect x="46" y="39" width="22" height="12" rx="3" {...box} stroke={G} />{T(57, 48, 'then', G, 6.5)}
        </S>
    ),
    /* a loop going round */
    loops: (
        <S>
            <path d="M52 20A18 18 0 1 0 54 34" stroke={Y} strokeWidth="2.4" fill="none" strokeLinecap="round" />{head(53, 36, 'd', Y)}
            {T(36, 33, 'i++', 'var(--ink)', 10)}
            {T(60, 12, '×5', G, 7)}
        </S>
    ),
    /* an array and its indexes */
    arrays: (
        <S>
            {[7, 3, 9, 1, 5].map((v, i) => (
                <g key={i}>
                    <rect x={5 + i * 12.5} y="24" width="12.5" height="14" {...box} fill={i === 2 ? 'color-mix(in srgb, ' + Y + ' 30%, var(--card))' : 'var(--card)'} stroke={i === 2 ? Y : 'var(--line)'} strokeWidth={i === 2 ? 1.8 : 1.2} />
                    {T(11.25 + i * 12.5, 34, String(v), i === 2 ? Y : 'var(--ink)', 7)}
                    {T(11.25 + i * 12.5, 47, String(i), 'var(--muted)', 5.5)}
                </g>
            ))}
            {T(36, 15, 'a[2]', Y, 7)}<path d="M36 18V22" stroke={Y} strokeWidth="1.4" fill="none" />
        </S>
    ),
    /* a value goes in, a value comes out */
    functions: (
        <S>
            <rect x="3" y="21" width="14" height="14" rx="3" {...box} />{T(10, 31, '6', 'var(--ink)', 8)}
            <path d="M18 28H26" stroke="var(--muted)" strokeWidth="1.5" fill="none" />{head(28, 28, 'r', 'var(--muted)')}
            <rect x="29" y="14" width="22" height="28" rx="5" {...box} stroke={Y} strokeWidth="1.8" />{T(40, 31, 'f()', Y, 8)}
            <path d="M52 28H60" stroke="var(--muted)" strokeWidth="1.5" fill="none" />{head(62, 28, 'r', 'var(--muted)')}
            <rect x="55" y="21" width="14" height="14" rx="3" {...box} stroke={G} />{T(62, 31, '36', G, 7)}
        </S>
    ),
    /* a pointer pointing at a variable */
    pointers1: (
        <S>
            <rect x="5" y="22" width="20" height="14" rx="3" {...box} stroke="var(--accent)" strokeWidth="1.6" />{T(15, 32, '→', 'var(--accent)', 9)}{T(15, 46, 'p', 'var(--muted)', 6)}
            <path d="M26 29H42" stroke="var(--accent)" strokeWidth="1.6" fill="none" />{head(45, 29, 'r', 'var(--accent)')}
            <rect x="47" y="22" width="20" height="14" rx="3" {...box} stroke={G} strokeWidth="1.6" />{T(57, 32, '25', G, 8)}{T(57, 46, 'x', 'var(--muted)', 6)}
        </S>
    ),
    /* a pointer moving along an array */
    pointers: (
        <S>
            {[10, 20, 30, 40].map((v, i) => (
                <g key={i}>
                    <rect x={6 + i * 15} y="14" width="15" height="14" {...box} stroke={i === 1 ? Y : 'var(--line)'} strokeWidth={i === 1 ? 1.8 : 1.2} />
                    {T(13.5 + i * 15, 24, String(v), i === 1 ? Y : 'var(--ink)', 7)}
                </g>
            ))}
            <path d="M28.5 46V32" stroke={Y} strokeWidth="1.6" fill="none" />{head(28.5, 30, 'u', Y)}
            {T(28.5, 53, 'p + 1', Y, 6.5)}
            <path d="M13 40Q20 34 26 38" stroke="var(--muted)" strokeWidth="1.2" fill="none" strokeDasharray="2 2" />
        </S>
    ),
    /* a record with named fields */
    structs: (
        <S>
            <rect x="10" y="6" width="52" height="44" rx="5" {...box} stroke={Y} strokeWidth="1.6" />
            {[['id', '7'], ['name', 'Ana'], ['gpa', '3.5']].map(([k, v], i) => (
                <g key={i}>
                    {i > 0 && <path d={'M10 ' + (6 + i * 14.7) + 'H62'} stroke="var(--line)" strokeWidth="1" />}
                    {T(24, 18 + i * 14.7, k, 'var(--muted)', 6.5)}{T(48, 18 + i * 14.7, v, 'var(--ink)', 7.5)}
                </g>
            ))}
        </S>
    ),
    /* a pointer to a block on the heap */
    dynamic: (
        <S>
            <rect x="4" y="12" width="18" height="12" rx="3" {...box} stroke="var(--accent)" />{T(13, 21, '→', 'var(--accent)', 8)}
            <path d="M23 18H31" stroke="var(--accent)" strokeWidth="1.5" fill="none" />{head(33, 18, 'r', 'var(--accent)')}
            {[0, 1, 2, 3].map(i => <rect key={i} x={35 + i * 8.5} y="11" width="8.5" height="14" {...box} stroke={G} />)}
            {T(52, 8, 'malloc', G, 5.5)}
            {[0, 1, 2].map(i => <rect key={i} x={35 + i * 8.5} y="36" width="8.5" height="14" fill="none" stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="2 2" />)}
            {T(14, 44, 'free', 'var(--muted)', 6.5)}
        </S>
    ),
    /* nodes joined by next pointers */
    linkedlist: (
        <S>
            {[10, 20, 30].map((v, i) => (
                <g key={i}>
                    <rect x={4 + i * 22} y="22" width="16" height="13" {...box} stroke={i === 0 ? Y : 'var(--line)'} strokeWidth={i === 0 ? 1.8 : 1.2} />
                    <rect x={20 + i * 22} y="22" width="6" height="13" {...box} fill="color-mix(in srgb, var(--accent) 20%, var(--card))" />
                    {T(12 + i * 22, 32, String(v), 'var(--ink)', 7)}
                    {i < 2 && <><path d={'M' + (23 + i * 22) + ' 28.5H' + (28 + i * 22)} stroke="var(--accent)" strokeWidth="1.4" fill="none" />{head(30 + i * 22, 28.5, 'r', 'var(--accent)')}</>}
                </g>
            ))}
            {T(64, 44, 'NULL', 'var(--muted)', 5.5)}
            {T(8, 17, 'head', Y, 6)}
        </S>
    ),
    /* the code visualizer: lines of code and a stack frame */
    visualizer: (
        <S>
            {[0, 1, 2, 3].map(i => <path key={i} d={'M8 ' + (14 + i * 9) + 'h' + [26, 18, 30, 14][i]} stroke={i === 1 ? Y : 'var(--line)'} strokeWidth={i === 1 ? 3 : 2.4} strokeLinecap="round" fill="none" />)}
            <rect x="44" y="10" width="22" height="16" rx="3" {...box} stroke={Y} />{T(55, 21, 'x = 3', 'var(--ink)', 6)}
            <rect x="44" y="30" width="22" height="14" rx="3" {...box} />{T(55, 40, 'main', 'var(--muted)', 6)}
        </S>
    )
};
