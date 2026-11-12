/* A small C front end: lexer (with #define), parser and types, for the subset used in the DSA lessons:
   structs, typedefs, pointers, arrays, malloc/free, loops, functions. Compile problems are reported with a line number. */

export class CompileError extends Error { constructor(msg: string, public line: number, public col = 0) { super(msg); } }

/* ---------------- types ---------------- */
export interface Field { name: string; type: CType; offset: number }
export interface StructT { k: 'struct'; name: string; fields: Field[]; size: number; align: number }
export type CType =
    | { k: 'void' }
    | { k: 'int'; size: 1 | 2 | 4 | 8; signed: boolean; name: string }
    | { k: 'float'; size: 4 | 8; name: string }
    | { k: 'ptr'; to: CType }
    | { k: 'arr'; of: CType; n: number }
    | StructT;

export const T_INT: CType = { k: 'int', size: 4, signed: true, name: 'int' };
export const T_LONG: CType = { k: 'int', size: 8, signed: true, name: 'long' };
export const T_CHAR: CType = { k: 'int', size: 1, signed: true, name: 'char' };
export const T_BOOL: CType = { k: 'int', size: 1, signed: false, name: 'bool' };
export const T_DOUBLE: CType = { k: 'float', size: 8, name: 'double' };
export const T_VOID: CType = { k: 'void' };
/** FILE: only ever used through a pointer (FILE *fp), a handle that fopen gives out */
export const T_FILE: CType = { k: 'int', size: 8, signed: false, name: 'FILE' };
export const ptrTo = (t: CType): CType => ({ k: 'ptr', to: t });

export function sizeOf(t: CType): number {
    switch (t.k) { case 'void': return 1; case 'int': case 'float': return t.size; case 'ptr': return 8; case 'arr': return t.n * sizeOf(t.of); case 'struct': return t.size; }
}
export function alignOf(t: CType): number {
    switch (t.k) { case 'void': return 1; case 'int': case 'float': return t.size; case 'ptr': return 8; case 'arr': return alignOf(t.of); case 'struct': return t.align; }
}
export function typeName(t: CType): string {
    switch (t.k) {
        case 'void': return 'void'; case 'int': case 'float': return t.name; case 'struct': return t.name || 'struct';
        case 'ptr': return typeName(t.to) + '*';
        case 'arr': { const dims: number[] = []; let x: CType = t; while (x.k === 'arr') { dims.push(x.n); x = x.of; } return typeName(x) + dims.map(d => '[' + d + ']').join(''); }
    }
}

/* ---------------- lexer ---------------- */
export interface Tok { t: 'id' | 'num' | 'fnum' | 'chr' | 'str' | 'p' | 'eof'; v: string; n: number; pos: number; end: number; line: number; col: number }
const PUNCT = ['<<=', '>>=', '...', '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
    '+', '-', '*', '/', '%', '&', '|', '^', '~', '!', '<', '>', '=', '?', ':', ';', ',', '.', '(', ')', '[', ']', '{', '}'];
const BUILTIN_MACROS: Record<string, string> = { true: '1', false: '0', NULL: '0', INT_MAX: '2147483647', INT_MIN: '(-2147483647-1)', EOF: '(-1)', RAND_MAX: '2147483647', UINT_MAX: '4294967295', CHAR_BIT: '8', stdout: '20736', stderr: '20752' };

function escChar(src: string, i: number): [number, number] {
    // src[i] is the char after the backslash; returns [code, next index]
    const c = src[i];
    const map: Record<string, number> = { n: 10, t: 9, r: 13, '0': 0, '\\': 92, "'": 39, '"': 34, a: 7, b: 8, f: 12, v: 11 };
    if (c === 'x') { let j = i + 1, v = 0; while (/[0-9a-fA-F]/.test(src[j] || '')) { v = v * 16 + parseInt(src[j], 16); j++; } return [v, j]; }
    if (c in map) return [map[c], i + 1];
    return [c.charCodeAt(0), i + 1];
}

export function lex(src: string): Tok[] {
    const toks: Tok[] = [];
    const macros = new Map<string, Tok[]>();
    let i = 0, line = 1, lineStart = 0, atLineStart = true;
    const err = (m: string) => new CompileError(m, line, i - lineStart + 1);
    const push = (t: Tok['t'], v: string, n: number, pos: number, end: number, ln: number, col: number) => {
        if (t === 'id' && macros.has(v)) {
            const body = macros.get(v) as Tok[];
            body.forEach(b => toks.push({ ...b, pos, end, line: ln, col }));
            return;
        }
        if (t === 'id' && v in BUILTIN_MACROS) { const sub = lex(BUILTIN_MACROS[v]); sub.slice(0, -1).forEach(b => toks.push({ ...b, pos, end, line: ln, col })); return; }
        toks.push({ t, v, n, pos, end, line: ln, col });
    };
    while (i < src.length) {
        const c = src[i];
        if (c === '\n') { i++; line++; lineStart = i; atLineStart = true; continue; }
        if (/\s/.test(c)) { i++; continue; }
        if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
        if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') { line++; lineStart = i + 1; } i++; } i += 2; continue; }
        if (c === '#' && atLineStart) {
            let j = i;
            while (j < src.length && src[j] !== '\n') { if (src[j] === '\\' && src[j + 1] === '\n') { j += 2; line++; continue; } j++; }
            const text = src.slice(i + 1, j);
            const m = /^\s*define\s+([A-Za-z_]\w*)(\(?)(.*)$/s.exec(text);
            if (m && !m[2]) macros.set(m[1], lex(m[3]).slice(0, -1));
            i = j; continue;
        }
        atLineStart = false;
        const col = i - lineStart + 1, start = i;
        if (/[A-Za-z_]/.test(c)) { let j = i; while (j < src.length && /\w/.test(src[j])) j++; push('id', src.slice(i, j), 0, start, j, line, col); i = j; continue; }
        if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
            let j = i;
            if (c === '0' && /[xX]/.test(src[i + 1] || '')) { j = i + 2; while (/[0-9a-fA-F]/.test(src[j] || '')) j++; const v = parseInt(src.slice(i, j), 16); while (/[uUlL]/.test(src[j] || '')) j++; push('num', src.slice(i, j), v, start, j, line, col); i = j; continue; }
            while (/[0-9]/.test(src[j] || '')) j++;
            let isF = false;
            if (src[j] === '.') { isF = true; j++; while (/[0-9]/.test(src[j] || '')) j++; }
            if (/[eE]/.test(src[j] || '') && /[-+0-9]/.test(src[j + 1] || '')) { isF = true; j += 2; while (/[0-9]/.test(src[j] || '')) j++; }
            const num = parseFloat(src.slice(i, j));
            while (/[uUlLfF]/.test(src[j] || '')) { if (/[fF]/.test(src[j])) isF = true; j++; }
            push(isF ? 'fnum' : 'num', src.slice(i, j), num, start, j, line, col); i = j; continue;
        }
        if (c === "'") {
            let j = i + 1, v = 0;
            if (src[j] === '\\') { const r = escChar(src, j + 1); v = r[0]; j = r[1]; } else { v = src.charCodeAt(j); j++; }
            if (src[j] !== "'") throw err('Unterminated character constant');
            push('chr', src.slice(i, j + 1), v, start, j + 1, line, col); i = j + 1; continue;
        }
        if (c === '"') {
            let j = i + 1, s = '';
            while (j < src.length && src[j] !== '"') {
                if (src[j] === '\n') throw err('Unterminated string');
                if (src[j] === '\\') { const r = escChar(src, j + 1); s += String.fromCharCode(r[0]); j = r[1]; } else { s += src[j]; j++; }
            }
            if (src[j] !== '"') throw err('Unterminated string');
            /* adjacent string literals join */
            const prev = toks[toks.length - 1];
            if (prev && prev.t === 'str' && /^\s*$/.test(src.slice(prev.end, i))) { prev.v += s; prev.end = j + 1; } else push('str', s, 0, start, j + 1, line, col);
            i = j + 1; continue;
        }
        const p = PUNCT.find(q => src.startsWith(q, i));
        if (!p) throw err('Unexpected character "' + c + '"');
        push('p', p, 0, start, i + p.length, line, col); i += p.length;
    }
    toks.push({ t: 'eof', v: '<end of file>', n: 0, pos: src.length, end: src.length, line, col: 1 });
    return toks;
}

/* ---------------- AST ---------------- */
export interface E { k: string; pos: number; end: number; line: number; [x: string]: any }   // eslint-disable-line @typescript-eslint/no-explicit-any
export interface S { k: string; pos: number; end: number; line: number; [x: string]: any }   // eslint-disable-line @typescript-eslint/no-explicit-any
export interface Func { name: string; ret: CType; params: { name: string; type: CType }[]; body: S | null; line: number; endLine: number }
export interface Program { funcs: Map<string, Func>; globals: S[]; structs: Map<string, StructT>; src: string; toks: Tok[] }

const TYPE_WORDS = new Set(['void', 'char', 'short', 'int', 'long', 'float', 'double', 'signed', 'unsigned', 'struct', 'union', 'enum', 'const', 'volatile', 'static', 'extern', 'register', 'inline', '_Bool', 'bool', 'size_t']);

export function parse(src: string): Program {
    const toks = lex(src);
    let i = 0;
    const typedefs = new Map<string, CType>([['bool', T_BOOL], ['FILE', T_FILE], ['size_t', { k: 'int', size: 8, signed: false, name: 'size_t' }]]);
    const structs = new Map<string, StructT>();
    const funcs = new Map<string, Func>();
    const globals: S[] = [];
    const enums = new Map<string, number>();

    const peek = (o = 0) => toks[Math.min(i + o, toks.length - 1)];
    const err = (m: string, t = peek()) => new CompileError(m, t.line, t.col);
    const isP = (v: string, o = 0) => peek(o).t === 'p' && peek(o).v === v;
    const isId = (v: string, o = 0) => peek(o).t === 'id' && peek(o).v === v;
    const accept = (v: string) => { if (isP(v)) { i++; return true; } return false; };
    const expect = (v: string) => { if (!accept(v)) throw err('Expected "' + v + '" but found "' + peek().v + '"'); };
    const ident = () => { if (peek().t !== 'id') throw err('Expected a name but found "' + peek().v + '"'); return toks[i++].v; };
    const isTypeStart = (o = 0) => { const t = peek(o); return t.t === 'id' && (TYPE_WORDS.has(t.v) || typedefs.has(t.v)); };

    /* constant expressions (array sizes, enum values) */
    const constEval = (e: E): number => {
        switch (e.k) {
            case 'num': return e.v;
            case 'chr': return e.v;
            case 'id': if (enums.has(e.name)) return enums.get(e.name) as number; throw new CompileError('"' + e.name + '" is not a constant', e.line);
            case 'un': { const v = constEval(e.e); return e.op === '-' ? -v : e.op === '+' ? v : e.op === '~' ? ~v : e.op === '!' ? (v ? 0 : 1) : NaN; }
            case 'bin': { const a = constEval(e.l), b = constEval(e.r); switch (e.op) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return Math.trunc(a / b); case '%': return a % b; case '<<': return a << b; case '>>': return a >> b; default: throw new CompileError('Unsupported constant expression', e.line); } }
            case 'sizeofT': return sizeOf(e.type);
            case 'cast': return constEval(e.e);
            default: throw new CompileError('This array size is not a constant', e.line);
        }
    };

    /* ---- struct layout ---- */
    const layout = (s: StructT, fields: { name: string; type: CType }[]) => {
        let off = 0, al = 1;
        s.fields = fields.map(f => { const a = alignOf(f.type); off = Math.ceil(off / a) * a; const o = off; off += sizeOf(f.type); al = Math.max(al, a); return { name: f.name, type: f.type, offset: o }; });
        s.align = al; s.size = Math.max(1, Math.ceil(off / al) * al);
    };

    /* ---- declaration specifiers ---- */
    const specifiers = (): CType => {
        let unsigned = false, signed = false, long = 0, short = false, base: CType | null = null, sawAny = false;
        for (;;) {
            const t = peek();
            if (t.t !== 'id') break;
            const w = t.v;
            if (w === 'const' || w === 'volatile' || w === 'static' || w === 'extern' || w === 'register' || w === 'inline') { i++; sawAny = true; continue; }
            if (w === 'unsigned') { unsigned = true; i++; sawAny = true; continue; }
            if (w === 'signed') { signed = true; i++; sawAny = true; continue; }
            if (w === 'long') { long++; i++; sawAny = true; continue; }
            if (w === 'short') { short = true; i++; sawAny = true; continue; }
            if (w === 'void') { base = T_VOID; i++; sawAny = true; continue; }
            if (w === 'char') { base = T_CHAR; i++; sawAny = true; continue; }
            if (w === 'int') { base = T_INT; i++; sawAny = true; continue; }
            if (w === '_Bool') { base = T_BOOL; i++; sawAny = true; continue; }
            if (w === 'float') { base = { k: 'float', size: 4, name: 'float' }; i++; sawAny = true; continue; }
            if (w === 'double') { base = T_DOUBLE; i++; sawAny = true; continue; }
            if (w === 'struct' || w === 'union') {
                if (w === 'union') throw err('"union" is not supported yet');
                i++;
                let tag = '';
                if (peek().t === 'id' && !isP('{')) tag = ident();
                let st = tag ? structs.get(tag) : undefined;
                if (!st) { st = { k: 'struct', name: tag ? 'struct ' + tag : '', fields: [], size: 1, align: 1 }; if (tag) structs.set(tag, st); }
                if (isP('{')) {
                    i++;
                    const fl: { name: string; type: CType }[] = [];
                    while (!isP('}')) {
                        const bt = specifiers();
                        do { const d = declarator(bt); if (!d.name) throw err('Expected a field name'); fl.push({ name: d.name, type: d.type }); } while (accept(','));
                        expect(';');
                    }
                    expect('}');
                    layout(st, fl);
                }
                base = st; sawAny = true; continue;
            }
            if (w === 'enum') {
                i++;
                if (peek().t === 'id' && !isP('{')) i++;
                if (accept('{')) {
                    let v = 0;
                    while (!isP('}')) { const nm = ident(); if (accept('=')) v = constEval(assign()); enums.set(nm, v++); if (!accept(',')) break; }
                    expect('}');
                }
                base = T_INT; sawAny = true; continue;
            }
            if (!base && !sawAny && typedefs.has(w)) { base = typedefs.get(w) as CType; i++; sawAny = true; continue; }
            if (!base && !unsigned && !signed && !long && !short && typedefs.has(w)) { base = typedefs.get(w) as CType; i++; sawAny = true; continue; }
            break;
        }
        if (!sawAny) throw err('Expected a type but found "' + peek().v + '"');
        if (!base || (base.k === 'int' && base.name === 'int')) {
            if (short) return { k: 'int', size: 2, signed: !unsigned, name: unsigned ? 'unsigned short' : 'short' };
            if (long) return { k: 'int', size: 8, signed: !unsigned, name: unsigned ? 'unsigned long' : 'long' };
            if (unsigned) return { k: 'int', size: 4, signed: false, name: 'unsigned int' };
            if (!base) return T_INT;
        }
        if (base.k === 'int' && base.name === 'char' && unsigned) return { k: 'int', size: 1, signed: false, name: 'unsigned char' };
        void signed;
        if (base.k === 'float' && base.name === 'double' && long) return { k: 'float', size: 8, name: 'long double' };
        return base;
    };

    /* ---- declarators: pointers, names, arrays ---- */
    interface Decl { name: string; type: CType; params?: { name: string; type: CType }[]; isFunc?: boolean }
    function declarator(base: CType): Decl {
        let t = base;
        while (isP('*')) { i++; while (isId('const') || isId('volatile')) i++; t = ptrTo(t); }
        let name = '';
        if (isP('(') && isP('*', 1)) throw err('Function pointers are not supported yet');
        if (peek().t === 'id' && !TYPE_WORDS.has(peek().v) ) name = ident();
        else if (peek().t === 'id' && typedefs.has(peek().v) && !name) { /* a parameter without a name */ }
        if (isP('(') && name) {
            // function declarator
            i++;
            const params: { name: string; type: CType }[] = [];
            if (isId('void') && isP(')', 1)) i++;
            else if (!isP(')')) {
                do {
                    if (accept('...')) break;
                    const pb = specifiers();
                    const pd = declarator(pb);
                    params.push({ name: pd.name, type: pd.type.k === 'arr' ? ptrTo(pd.type.of) : pd.type });
                } while (accept(','));
            }
            expect(')');
            return { name, type: t, params, isFunc: true };
        }
        const dims: (number | null)[] = [];
        while (accept('[')) { if (isP(']')) dims.push(null); else dims.push(constEval(assign())); expect(']'); }
        for (let k = dims.length - 1; k >= 0; k--) t = { k: 'arr', of: t, n: dims[k] ?? 0 };
        return { name, type: t };
    }

    /* ---------------- expressions ---------------- */
    const node = (k: string, a: Tok, extra: object, endTok = toks[i - 1]): E => ({ k, pos: a.pos, end: endTok.end, line: a.line, ...extra });
    function expr(): E { let e = assign(); while (isP(',')) { const a = peek(); i++; const r = assign(); e = { k: 'comma', pos: e.pos, end: r.end, line: a.line, l: e, r }; } return e; }
    const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);
    function assign(): E {
        const l = cond();
        if (peek().t === 'p' && ASSIGN_OPS.has(peek().v)) { const op = toks[i++].v; const r = assign(); return { k: 'assign', op, l, r, pos: l.pos, end: r.end, line: l.line }; }
        return l;
    }
    function cond(): E {
        const c = binary(0);
        if (isP('?')) { i++; const a = expr(); expect(':'); const b = cond(); return { k: 'cond', c, a, b, pos: c.pos, end: b.end, line: c.line }; }
        return c;
    }
    const LEVELS: string[][] = [['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!='], ['<', '>', '<=', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];
    function binary(level: number): E {
        if (level >= LEVELS.length) return unary();
        let l = binary(level + 1);
        while (peek().t === 'p' && LEVELS[level].includes(peek().v)) { const op = toks[i++].v; const r = binary(level + 1); l = { k: 'bin', op, l, r, pos: l.pos, end: r.end, line: l.line }; }
        return l;
    }
    function typeName_(): CType { const b = specifiers(); const d = declarator(b); return d.type; }
    function unary(): E {
        const a = peek();
        if (a.t === 'p') {
            if (a.v === '++' || a.v === '--') { i++; const e = unary(); return { k: 'pre', op: a.v, e, pos: a.pos, end: e.end, line: a.line }; }
            if (['-', '+', '!', '~', '*', '&'].includes(a.v)) { i++; const e = unary(); return { k: 'un', op: a.v, e, pos: a.pos, end: e.end, line: a.line }; }
            if (a.v === '(' && isTypeStart(1)) { i++; const type = typeName_(); expect(')'); const e = unary(); return { k: 'cast', type, e, pos: a.pos, end: e.end, line: a.line }; }
        }
        if (a.t === 'id' && a.v === 'sizeof') {
            i++;
            if (isP('(') && isTypeStart(1)) { i++; const type = typeName_(); expect(')'); return node('sizeofT', a, { type }); }
            const e = unary(); return { k: 'sizeofE', e, pos: a.pos, end: e.end, line: a.line };
        }
        return postfix();
    }
    function postfix(): E {
        let e = primary();
        for (;;) {
            const a = peek();
            if (a.t !== 'p') break;
            if (a.v === '[') { i++; const idx = expr(); expect(']'); e = { k: 'idx', a: e, i: idx, pos: e.pos, end: toks[i - 1].end, line: e.line }; }
            else if (a.v === '(') {
                i++; const args: E[] = [];
                if (!isP(')')) do { args.push(assign()); } while (accept(','));
                expect(')'); e = { k: 'call', f: e, args, pos: e.pos, end: toks[i - 1].end, line: e.line };
            }
            else if (a.v === '.' || a.v === '->') { i++; const name = ident(); e = { k: a.v === '.' ? 'mem' : 'arrow', e, name, pos: e.pos, end: toks[i - 1].end, line: e.line }; }
            else if (a.v === '++' || a.v === '--') { i++; e = { k: 'post', op: a.v, e, pos: e.pos, end: a.end, line: e.line }; }
            else break;
        }
        return e;
    }
    function primary(): E {
        const a = peek();
        if (a.t === 'num') { i++; return node('num', a, { v: a.n, big: a.n > 2147483647 }); }
        if (a.t === 'fnum') { i++; return node('fnum', a, { v: a.n, single: /[fF]$/.test(a.v) }); }
        if (a.t === 'chr') { i++; return node('chr', a, { v: a.n }); }
        if (a.t === 'str') { i++; return node('str', a, { v: a.v }); }
        if (a.t === 'id') {
            if (enums.has(a.v)) { i++; return node('num', a, { v: enums.get(a.v) }); }
            i++; return node('id', a, { name: a.v });
        }
        if (a.t === 'p' && a.v === '(') { i++; const e = expr(); expect(')'); return { ...e, pos: a.pos, end: toks[i - 1].end, paren: true }; }
        throw err('Unexpected "' + a.v + '"');
    }

    /* ---------------- statements ---------------- */
    function initializer(): E {
        if (isP('{')) {
            const a = toks[i++]; const items: E[] = [];
            while (!isP('}')) { items.push(initializer()); if (!accept(',')) break; }
            expect('}');
            return { k: 'init', items, pos: a.pos, end: toks[i - 1].end, line: a.line };
        }
        return assign();
    }
    function declaration(base: CType, first: Tok): S {
        const decls: { name: string; type: CType; init: E | null; pos: number; end: number }[] = [];
        do {
            const st = peek();
            const d = declarator(base);
            if (!d.name) throw err('Expected a variable name');
            let type = d.type;
            let init: E | null = null;
            if (accept('=')) init = initializer();
            if (type.k === 'arr' && type.n === 0 && init && init.k === 'init') type = { k: 'arr', of: type.of, n: init.items.length };
            if (type.k === 'arr' && type.n === 0 && init && init.k === 'str') type = { k: 'arr', of: type.of, n: init.v.length + 1 };
            decls.push({ name: d.name, type, init, pos: st.pos, end: toks[i - 1].end });
        } while (accept(','));
        expect(';');
        return { k: 'decl', decls, pos: first.pos, end: toks[i - 1].end, line: first.line };
    }
    function statement(): S {
        const a = peek();
        if (a.t === 'p' && a.v === '{') return block();
        if (a.t === 'p' && a.v === ';') { i++; return { k: 'empty', pos: a.pos, end: a.end, line: a.line }; }
        if (a.t === 'id') {
            switch (a.v) {
                case 'if': {
                    i++; expect('('); const c = expr(); expect(')'); const then = statement(); let els: S | null = null;
                    if (isId('else')) { i++; els = statement(); }
                    return { k: 'if', c, then, els, pos: a.pos, end: toks[i - 1].end, line: a.line, condEnd: c.end };
                }
                case 'while': { i++; expect('('); const c = expr(); expect(')'); const body = statement(); return { k: 'while', c, body, pos: a.pos, end: toks[i - 1].end, line: a.line }; }
                case 'do': { i++; const body = statement(); if (!isId('while')) throw err('Expected "while" after the do body'); i++; expect('('); const c = expr(); expect(')'); expect(';'); return { k: 'do', c, body, pos: a.pos, end: toks[i - 1].end, line: a.line }; }
                case 'for': {
                    i++; expect('(');
                    let init: S | null = null;
                    if (isP(';')) i++;
                    else if (isTypeStart()) { const b = specifiers(); init = declaration(b, a); }
                    else { const e = expr(); expect(';'); init = { k: 'expr', e, pos: e.pos, end: e.end, line: e.line }; }
                    const c = isP(';') ? null : expr(); expect(';');
                    const step = isP(')') ? null : expr(); expect(')');
                    const body = statement();
                    return { k: 'for', init, c, step, body, pos: a.pos, end: toks[i - 1].end, line: a.line };
                }
                case 'return': { i++; const e = isP(';') ? null : expr(); expect(';'); return { k: 'return', e, pos: a.pos, end: toks[i - 1].end, line: a.line }; }
                case 'break': { i++; expect(';'); return { k: 'break', pos: a.pos, end: toks[i - 1].end, line: a.line }; }
                case 'continue': { i++; expect(';'); return { k: 'continue', pos: a.pos, end: toks[i - 1].end, line: a.line }; }
                case 'switch': throw err('"switch" is not supported yet');
                case 'goto': throw err('"goto" is not supported');
            }
            if (isTypeStart()) { const b = specifiers(); return declaration(b, a); }
        }
        const e = expr(); expect(';');
        return { k: 'expr', e, pos: e.pos, end: toks[i - 1].end, line: a.line };
    }
    function block(): S {
        const a = toks[i++];
        const items: S[] = [];
        while (!isP('}')) { if (peek().t === 'eof') throw err('Missing "}" for the block that starts on line ' + a.line, a); items.push(statement()); }
        const z = toks[i++];
        return { k: 'block', items, pos: a.pos, end: z.end, line: a.line, endLine: z.line };
    }

    /* ---------------- top level ---------------- */
    while (peek().t !== 'eof') {
        const a = peek();
        if (accept(';')) continue;
        if (isId('typedef')) {
            i++;
            const base = specifiers();
            do {
                const d = declarator(base);
                if (!d.name) throw err('Expected a name for the typedef');
                let t = d.type;
                if (t.k === 'struct' && !t.name) t.name = d.name;
                else if (base.k === 'struct' && base === t && !base.name) base.name = d.name;
                typedefs.set(d.name, t);
                /* the first alias of an anonymous struct names it (List, Stack...) */
                if (t.k === 'struct' && !t.name) t.name = d.name;
            } while (accept(','));
            expect(';');
            continue;
        }
        const base = specifiers();
        if (accept(';')) continue;     // "struct X { ... };"
        const d = declarator(base);
        if (d.isFunc) {
            if (isP('{')) {
                const body = block();
                if (funcs.get(d.name)?.body) throw new CompileError('Function "' + d.name + '" is defined twice', a.line);
                funcs.set(d.name, { name: d.name, ret: d.type, params: d.params as { name: string; type: CType }[], body, line: a.line, endLine: body.endLine });
            } else { expect(';'); if (!funcs.has(d.name)) funcs.set(d.name, { name: d.name, ret: d.type, params: d.params as { name: string; type: CType }[], body: null, line: a.line, endLine: a.line }); }
            continue;
        }
        // global variable(s)
        const decls: { name: string; type: CType; init: E | null; pos: number; end: number }[] = [];
        let cur: Decl | null = d;
        for (;;) {
            let type = (cur as Decl).type; let init: E | null = null;
            if (accept('=')) init = initializer();
            if (type.k === 'arr' && type.n === 0 && init && init.k === 'init') type = { k: 'arr', of: type.of, n: init.items.length };
            decls.push({ name: (cur as Decl).name, type, init, pos: a.pos, end: toks[i - 1].end });
            if (!accept(',')) break;
            cur = declarator(base);
        }
        expect(';');
        globals.push({ k: 'decl', decls, pos: a.pos, end: toks[i - 1].end, line: a.line, global: true });
    }
    return { funcs, globals, structs, src, toks };
}
