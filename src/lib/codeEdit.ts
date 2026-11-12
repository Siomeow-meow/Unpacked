/* Editing help for the code box: Tab indents (instead of moving the focus), Shift+Tab outdents, Enter keeps the indentation
   and adds one more after a "{", and a "}" typed on an empty indented line steps back. Pure functions, so they can be tested. */

export const INDENT = 4;
export interface Edit { value: string; start: number; end: number }

const spaces = (n: number) => ' '.repeat(Math.max(0, n));
const lineStart = (v: string, i: number) => v.lastIndexOf('\n', i - 1) + 1;
const lineEnd = (v: string, i: number) => { const e = v.indexOf('\n', i); return e < 0 ? v.length : e; };
const indentOf = (line: string) => (/^[ \t]*/.exec(line) as RegExpExecArray)[0];

/** Tab: with nothing selected (or a selection inside one line) insert spaces up to the next tab stop; across lines, indent every line. */
function tab(v: string, s: number, e: number): Edit {
    const a = lineStart(v, s), b = lineEnd(v, e > s && v[e - 1] === '\n' ? e - 1 : e);
    if (v.slice(s, e).includes('\n')) {
        const lines = v.slice(a, b).split('\n').map(l => spaces(INDENT) + l);
        const out = v.slice(0, a) + lines.join('\n') + v.slice(b);
        return { value: out, start: s + INDENT, end: e + INDENT * lines.length };
    }
    const col = s - a, add = INDENT - (col % INDENT);
    return { value: v.slice(0, s) + spaces(add) + v.slice(e), start: s + add, end: s + add };
}

/** Shift+Tab: take up to one indent off the start of every line the selection touches. */
function untab(v: string, s: number, e: number): Edit {
    const a = lineStart(v, s), b = lineEnd(v, e > s && v[e - 1] === '\n' ? e - 1 : e);
    const lines = v.slice(a, b).split('\n');
    const cut: number[] = [];
    const out = lines.map(l => {
        const m = /^( {1,4}|\t)/.exec(l);
        const n = m ? m[0].length : 0;
        cut.push(n);
        return l.slice(n);
    });
    const value = v.slice(0, a) + out.join('\n') + v.slice(b);
    const start = Math.max(a, s - cut[0]);
    const end = e - cut.reduce((x, y) => x + y, 0);
    return { value, start, end: Math.max(start, end) };
}

/** Enter: a new line with the same indentation; one more level after "{"; and between "{" and "}" the closing brace gets its own line. */
function enter(v: string, s: number, e: number): Edit {
    const ls = lineStart(v, s);
    const indent = indentOf(v.slice(ls, s));
    const before = v.slice(0, s).trimEnd().slice(-1);
    const after = v.slice(e).replace(/^[ \t]*/, '').charAt(0);
    if (before === '{' && after === '}') {
        const inner = '\n' + indent + spaces(INDENT);
        const out = v.slice(0, s) + inner + '\n' + indent + v.slice(e).replace(/^[ \t]*/, '');
        return { value: out, start: s + inner.length, end: s + inner.length };
    }
    const extra = before === '{' ? INDENT : 0;
    const ins = '\n' + indent + spaces(extra);
    return { value: v.slice(0, s) + ins + v.slice(e), start: s + ins.length, end: s + ins.length };
}

/** "}": when the line so far is only spaces, step back one indent before the brace goes in. */
function closeBrace(v: string, s: number, e: number): Edit | null {
    const ls = lineStart(v, s), before = v.slice(ls, s);
    if (!/^ +$/.test(before)) return null;
    const n = Math.min(before.length, before.length % INDENT || INDENT);
    const value = v.slice(0, s - n) + '}' + v.slice(e);
    return { value, start: s - n + 1, end: s - n + 1 };
}

/** What a key press in the code box should do, or null to let the browser handle it. `mod` is true when Ctrl, Alt or Cmd is held. */
export function editKey(value: string, start: number, end: number, key: string, shift: boolean, mod: boolean): Edit | null {
    if (mod) return null;
    if (key === 'Tab') return shift ? untab(value, start, end) : tab(value, start, end);
    if (key === 'Enter' && !shift) return enter(value, start, end);
    if (key === '}') return closeBrace(value, start, end);
    return null;
}
