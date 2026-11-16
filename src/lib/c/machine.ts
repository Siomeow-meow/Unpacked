/* Runs a parsed C program on a simulated machine (byte-addressed stack, heap and data segment) and records a step for
   every statement: the call stack, the heap, what was read and written, and a plain-English explanation. */
import { CompileError, T_CHAR, T_DOUBLE, T_FILE, T_INT, T_LONG, T_VOID, alignOf, parse, ptrTo, sizeOf, typeName, type CType, type E, type Func, type Program, type S, type StructT } from './parse';

export class RuntimeError extends Error { constructor(msg: string, public line: number) { super(msg); } }
class ExitSignal { constructor(public code: number) { } }
class WaitSignal { constructor(public line: number) { } }
class ReturnSignal { constructor(public val: RV | null) { } }

/* ---------------- what a trace contains ---------------- */
export interface Cell {
    id: string; name: string; type: string; text: string; init: boolean; addr: number; size: number;
    kind: 'scalar' | 'ptr' | 'struct' | 'array' | 'string';
    target?: number; pt?: CType; children?: Cell[]; more?: number; rw?: 'r' | 'w' | 'rw';
    /** a char array, or a char* that points to text: the text, and one entry per character (a char array has them in children too) */
    strText?: string; chars?: string[];
}
export interface FrameView { fn: string; line: number; args: string; vars: Cell[] }
export interface BlockView { addr: number; size: number; freed: boolean; site: string; elemType: string; cells: Cell[]; more: number }
export interface Snapshot { frames: FrameView[]; heap: BlockView[]; globals: Cell[] }
export interface FormulaPart { t: string; k?: 'r' | 'w' | 'v' }
export interface TraceStep { n: number; kind: string; line: number; depth: number; title: string; html: string; formula: FormulaPart[]; snap: Snapshot; outLen: number; error?: boolean }
export interface Trace { steps: TraceStep[]; output: string; error?: string; errorLine?: number; exitCode?: number; truncated?: boolean; waiting?: boolean }
/** interactive: a scanf / getchar that has no input left makes the run stop and wait (the page asks for a line and runs again); typed text is echoed to the output like a terminal. eof: the input was ended (Ctrl+D), so reading returns EOF. */
export interface RunOptions { input?: string; maxSteps?: number; interactive?: boolean; eof?: boolean }

/** one character as a box shows it: the letter, '\0' for the end of a text, the number for the rest */
const charText = (b: number): string => (b === 0 ? '\\0' : b === 32 ? '␣' : b > 32 && b < 127 ? String.fromCharCode(b) : String(b));

/* ---------------- values ---------------- */
interface Num { t: CType; n: number }
interface Agg { t: StructT; bytes: Uint8Array; init: Uint8Array }
type RV = Num | Agg
interface LV { t: CType; addr: number }
interface Var { name: string; t: CType; addr: number; line: number }
interface Frame { fn: Func; scopes: Map<string, Var>[]; vars: Var[]; sp0: number; line: number; args: string }
interface Block { addr: number; size: number; freed: boolean; site: string }

const STACK_SIZE = 256 * 1024, STACK_HI = 0x7ffc8000, STACK_LO = STACK_HI - STACK_SIZE;
const DATA_BASE = 0x1000, DATA_SIZE = 0x4000;
const HEAP_BASE = 0x5a10, HEAP_SIZE = 1 << 20;
/** addresses are shown as simple labels, a letter and three digits (A100 … A999, B100 … Z999): the heap counts up from A100,
    globals start at M100, and the stack counts down from Z999. Real hex is only used for odd values such as garbage pointers. */
const label = (i: number): string => String.fromCharCode(65 + Math.floor(i / 900)) + (100 + (i % 900));
export const fmtAddr = (n: number): string => {
    const LAST = 26 * 900 - 1;
    if (n >= HEAP_BASE && n < HEAP_BASE + HEAP_SIZE) return label(Math.min(LAST, n - HEAP_BASE));
    if (n > STACK_LO && n <= STACK_HI) return label(Math.max(0, LAST - (STACK_HI - n)));
    if (n >= DATA_BASE && n < DATA_BASE + DATA_SIZE) return label(Math.min(LAST, 12 * 900 + Math.max(0, n - DATA_BASE - 0x3000)));
    if (n >= 0x5200 && n < 0x5300) return 'file ' + ((n - 0x5200) / 16 + 1);
    return '0x' + n.toString(16);
};
const hex = fmtAddr;
const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const isAgg = (v: RV): v is Agg => 'bytes' in v;
const isScalarT = (t: CType) => t.k === 'int' || t.k === 'float' || t.k === 'ptr';

function wrap(n: number, size: number, signed: boolean): number {
    if (!Number.isFinite(n)) return 0;
    n = Math.trunc(n);
    if (size === 8) return n;
    const bits = size * 8, mod = 2 ** bits;
    n = ((n % mod) + mod) % mod;
    return signed && n >= mod / 2 ? n - mod : n;
}

export class Machine {
    prog: Program;
    stack = new Uint8Array(STACK_SIZE); stackInit = new Uint8Array(STACK_SIZE);
    data = new Uint8Array(DATA_SIZE); dataInit = new Uint8Array(DATA_SIZE);
    heap = new Uint8Array(HEAP_SIZE); heapInit = new Uint8Array(HEAP_SIZE);
    blocks: Block[] = []; heapNext = HEAP_BASE; dataNext = DATA_BASE;
    sp = STACK_HI;
    frames: Frame[] = [];
    globalsVars: Var[] = [];
    strings = new Map<string, number>();
    statics = new Map<object, Var>(); staticNext = DATA_BASE + 0x3c00;
    out = ''; input = ''; inPos = 0; interactive = false; eof = false; echoed = 0;
    /* the in-memory disk: file name -> text, and the open files (handle -> where it is up to) */
    files = new Map<string, string>();
    fhs = new Map<number, { name: string; mode: string; pos: number; eof: boolean }>();
    fnext = 0x5200;
    steps: TraceStep[] = [];
    maxSteps: number;
    ticks = 0;
    tracking = true;
    reads: [number, number][] = []; writes: [number, number][] = [];
    notes: string[] = []; uninitRead = false;
    curLine = 1;

    constructor(prog: Program, opts: RunOptions = {}) { this.prog = prog; this.input = opts.input || ''; this.maxSteps = opts.maxSteps || 4000; this.interactive = !!opts.interactive; this.eof = !!opts.eof; }
    /** reading with no input left: an interactive run waits for the user */
    need(line: number): void { if (this.interactive && !this.eof && this.inPos >= this.input.length) throw new WaitSignal(line); }
    /** what was typed is shown in the output, a whole line at a time, like a terminal does */
    echoIn(): void {
        if (!this.interactive || this.inPos <= 0) return;
        const nl = this.input.indexOf('\n', this.inPos - 1), upto = nl < 0 ? this.input.length : nl + 1;
        if (upto > this.echoed) { this.out += this.input.slice(this.echoed, upto); this.echoed = upto; }
    }

    /* ======== memory ======== */
    err(msg: string, line = this.curLine): never { throw new RuntimeError(msg, line); }
    seg(addr: number, len: number, write: boolean): { buf: Uint8Array; init: Uint8Array; off: number } {
        if (addr >= 0 && addr < 0x1000) this.err((write ? 'Writing to' : 'Reading from') + ' a NULL pointer. A pointer that is NULL (or close to it) points at nothing, so the program crashes (segmentation fault).');
        if (addr >= STACK_LO && addr + len <= STACK_HI) return { buf: this.stack, init: this.stackInit, off: addr - STACK_LO };
        if (addr >= DATA_BASE && addr + len <= DATA_BASE + DATA_SIZE) return { buf: this.data, init: this.dataInit, off: addr - DATA_BASE };
        if (addr >= HEAP_BASE && addr < HEAP_BASE + HEAP_SIZE) {
            const b = this.blocks.find(x => addr >= x.addr && addr < x.addr + x.size);
            if (b) {
                if (b.freed) this.err('Use after free: the block at ' + hex(b.addr) + ' was already freed, but the program still ' + (write ? 'writes to' : 'reads from') + ' it.');
                if (addr + len > b.addr + b.size) this.err('Heap overflow: ' + (write ? 'writing' : 'reading') + ' ' + len + ' byte(s) at ' + hex(addr) + ' goes past the end of the ' + b.size + '-byte block at ' + hex(b.addr) + '.');
                return { buf: this.heap, init: this.heapInit, off: addr - HEAP_BASE };
            }
            const near = this.blocks.find(x => addr >= x.addr + x.size && addr < x.addr + x.size + 16);
            if (near) this.err('Heap overflow: address ' + hex(addr) + ' is just past the ' + near.size + '-byte block at ' + hex(near.addr) + '.');
        }
        return this.err(this.badPtr(addr));
    }
    /** the explanation for an address that cannot be used */
    badPtr(addr: number): string {
        if (addr > 2 ** 47) return 'Segmentation fault: this pointer holds garbage (0xabab…) because it was never given a value before it was used. Set it first, for example with malloc or by assigning the address of something.';
        return 'Segmentation fault: ' + hex(addr) + ' is not a valid address. The pointer was probably never set to anything sensible.';
    }
    rawLoad(addr: number, len: number): { bytes: Uint8Array; init: Uint8Array } {
        const s = this.seg(addr, len, false);
        return { bytes: s.buf.slice(s.off, s.off + len), init: s.init.slice(s.off, s.off + len) };
    }
    rawStore(addr: number, bytes: Uint8Array, init: Uint8Array | null): void {
        const s = this.seg(addr, bytes.length, true);
        s.buf.set(bytes, s.off);
        if (init) s.init.set(init, s.off); else s.init.fill(1, s.off, s.off + bytes.length);
    }
    track(list: [number, number][], addr: number, len: number) { if (this.tracking) list.push([addr, len]); }
    load(t: CType, addr: number): number {
        const size = sizeOf(t);
        const { bytes, init } = this.rawLoad(addr, size);
        this.track(this.reads, addr, size);
        if (this.tracking && init.some(x => !x)) this.uninitRead = true;
        const dv = new DataView(bytes.buffer, bytes.byteOffset, size);
        if (t.k === 'float') return t.size === 4 ? dv.getFloat32(0, true) : dv.getFloat64(0, true);
        if (t.k === 'ptr') return dv.getUint32(0, true) + dv.getUint32(4, true) * 4294967296;
        if (t.k === 'int') {
            if (size === 1) return t.signed ? dv.getInt8(0) : dv.getUint8(0);
            if (size === 2) return t.signed ? dv.getInt16(0, true) : dv.getUint16(0, true);
            if (size === 4) return t.signed ? dv.getInt32(0, true) : dv.getUint32(0, true);
            const lo = dv.getUint32(0, true), hi = dv.getInt32(4, true);
            return hi * 4294967296 + lo;
        }
        return 0;
    }
    store(t: CType, addr: number, n: number): void {
        const size = sizeOf(t);
        const bytes = new Uint8Array(size);
        const dv = new DataView(bytes.buffer);
        if (t.k === 'float') { if (t.size === 4) dv.setFloat32(0, n, true); else dv.setFloat64(0, n, true); }
        else if (t.k === 'ptr') { const v = Math.max(0, Math.trunc(n)); dv.setUint32(0, v % 4294967296, true); dv.setUint32(4, Math.floor(v / 4294967296), true); }
        else if (t.k === 'int') {
            const w = wrap(n, size, t.signed);
            if (size === 8) { const u = w < 0 ? w + 2 ** 64 : w; dv.setUint32(0, u % 4294967296, true); dv.setUint32(4, Math.floor(u / 4294967296) % 4294967296, true); }
            else if (size === 4) dv.setUint32(0, w >>> 0, true); else if (size === 2) dv.setUint16(0, w & 0xffff, true); else dv.setUint8(0, w & 0xff);
        }
        this.rawStore(addr, bytes, null);
        this.track(this.writes, addr, size);
    }
    /** a quick check (no error is made) that a byte at this address can be read: used to draw the text a char* points to */
    readable(addr: number): boolean {
        if (addr >= STACK_LO && addr < STACK_HI) return true;
        if (addr >= DATA_BASE && addr < DATA_BASE + DATA_SIZE) return true;
        if (addr >= HEAP_BASE && addr < HEAP_BASE + HEAP_SIZE) return this.blocks.some(x => !x.freed && addr >= x.addr && addr < x.addr + x.size);
        return false;
    }
    inited(addr: number, len: number): boolean {
        try { return this.rawLoad(addr, len).init.every(x => x === 1); } catch { return false; }
    }

    stackAlloc(t: CType, line: number): number {
        const size = Math.max(1, sizeOf(t)), al = Math.max(1, alignOf(t));
        this.sp = Math.floor((this.sp - size) / al) * al;
        if (this.sp < STACK_LO) this.err('Stack overflow: too many nested calls (is a recursive function missing its stopping case?)', line);
        const off = this.sp - STACK_LO;
        this.stack.fill(0xab, off, off + size); this.stackInit.fill(0, off, off + size);
        return this.sp;
    }
    strAddr(s: string): number {
        let a = this.strings.get(s);
        if (a !== undefined) return a;
        const bytes = new Uint8Array(s.length + 1);
        for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 255;
        a = this.dataNext; this.dataNext += bytes.length; if (this.dataNext > DATA_BASE + DATA_SIZE) this.err('Too many string literals');
        this.data.set(bytes, a - DATA_BASE); this.dataInit.fill(1, a - DATA_BASE, a - DATA_BASE + bytes.length);
        this.strings.set(s, a);
        return a;
    }
    readStr(addr: number, max = 4096): string {
        let s = '';
        for (let i = 0; i < max; i++) {
            const { bytes } = this.rawLoad(addr + i, 1);
            this.track(this.reads, addr + i, 1);
            if (bytes[0] === 0) return s;
            s += String.fromCharCode(bytes[0]);
        }
        return s;
    }
    malloc(size: number, zero: boolean, site: string): number {
        if (size < 0 || size > HEAP_SIZE) this.err('malloc(' + size + ') asks for too much memory');
        const addr = this.heapNext;
        const adv = Math.ceil((Math.max(size, 1) + 8) / 16) * 16;
        if (addr + adv > HEAP_BASE + HEAP_SIZE) this.err('Out of heap memory');
        this.heapNext += adv;
        this.blocks.push({ addr, size: Math.max(size, 1), freed: false, site });
        const off = addr - HEAP_BASE;
        this.heap.fill(zero ? 0 : 0xcd, off, off + size); this.heapInit.fill(zero ? 1 : 0, off, off + size);
        return addr;
    }
    free(addr: number): void {
        if (addr === 0) return;
        const b = this.blocks.find(x => x.addr === addr);
        if (!b) this.err(addr > 2 ** 47 ? 'free() was given a garbage pointer: it was never set to a malloc result.' : 'free(' + hex(addr) + '): this address was not returned by malloc, so it cannot be freed.');
        if (b.freed) this.err('Double free: the block at ' + hex(addr) + ' was already freed.');
        b.freed = true;
    }

    /* ======== conversions ======== */
    convert(v: RV, to: CType, line = this.curLine): RV {
        if (isAgg(v)) { if (to.k === 'struct') return v; return this.err('Cannot use a struct where a ' + typeName(to) + ' is needed', line); }
        if (to.k === 'void') return v;
        if (to.k === 'struct') return this.err('Cannot convert a ' + typeName(v.t) + ' into a ' + typeName(to), line);
        if (to.k === 'int') { const n = v.t.k === 'float' ? Math.trunc(v.n) : v.n; return { t: to, n: to.name === 'bool' ? (n ? 1 : 0) : wrap(n, to.size, to.signed) }; }
        if (to.k === 'float') return { t: to, n: to.size === 4 ? Math.fround(v.n) : v.n };
        if (to.k === 'ptr') return { t: to, n: v.n };
        return { t: to, n: v.n };
    }
    truthy(v: RV): boolean { if (isAgg(v)) return true; return v.n !== 0; }
    toBytes(v: RV, t: CType): { bytes: Uint8Array; init: Uint8Array } {
        if (isAgg(v)) return { bytes: v.bytes, init: v.init };
        const tmp = this.sp - 4096;      // not used: encode through a scratch DataView
        void tmp;
        const size = sizeOf(t), bytes = new Uint8Array(size), dv = new DataView(bytes.buffer);
        if (t.k === 'float') { if (t.size === 4) dv.setFloat32(0, v.n, true); else dv.setFloat64(0, v.n, true); }
        else if (t.k === 'ptr') { dv.setUint32(0, v.n % 4294967296, true); dv.setUint32(4, Math.floor(v.n / 4294967296), true); }
        else if (t.k === 'int') { const w = wrap(v.n, size, t.signed); if (size === 4) dv.setUint32(0, w >>> 0, true); else if (size === 2) dv.setUint16(0, w & 0xffff, true); else if (size === 1) dv.setUint8(0, w & 0xff); else { const u = w < 0 ? w + 2 ** 64 : w; dv.setUint32(0, u % 4294967296, true); dv.setUint32(4, Math.floor(u / 4294967296), true); } }
        return { bytes, init: new Uint8Array(size).fill(1) };
    }
    storeRV(t: CType, addr: number, v: RV): void {
        if (t.k === 'struct') {
            if (!isAgg(v)) this.err('Cannot store a ' + typeName(v.t) + ' into a struct');
            this.rawStore(addr, v.bytes, v.init); this.track(this.writes, addr, v.bytes.length); return;
        }
        if (t.k === 'arr') this.err('Arrays cannot be assigned as a whole. Copy them element by element (or with memcpy).');
        const c = this.convert(v, t) as Num;
        this.store(t, addr, c.n);
    }
    loadRV(t: CType, addr: number): RV {
        if (t.k === 'struct') { const { bytes, init } = this.rawLoad(addr, t.size); this.track(this.reads, addr, t.size); return { t, bytes, init }; }      // copying a struct is fine even when some of its fields were never set (no warning: only reading a single value is flagged)
        if (t.k === 'arr') return { t: ptrTo(t.of), n: addr };           // arrays decay to a pointer to their first element
        if (t.k === 'void') return this.err('A void value cannot be used');
        return { t, n: this.load(t, addr) };
    }

    /* ======== variables ======== */
    lookup(name: string): Var | undefined {
        const f = this.frames[this.frames.length - 1];
        if (f) for (let i = f.scopes.length - 1; i >= 0; i--) { const v = f.scopes[i].get(name); if (v) return v; }
        return this.globalsVars.find(v => v.name === name);
    }
    declare(name: string, t: CType, line: number): Var {
        const addr = this.stackAlloc(t, line);
        const v: Var = { name, t, addr, line };
        const f = this.frames[this.frames.length - 1];
        f.scopes[f.scopes.length - 1].set(name, v); f.vars.push(v);
        return v;
    }

    /* ======== expressions ======== */
    tick() { if (++this.ticks > 3_000_000) this.err('The program ran for too long (is there an infinite loop?)'); }
    quiet<T>(fn: () => T): T | undefined {
        const tr = this.tracking, ur = this.uninitRead, nl = this.notes.length;
        this.tracking = false;
        try { return fn(); } catch { return undefined; } finally { this.tracking = tr; this.uninitRead = ur; this.notes.length = nl; }
    }
    typeOf(e: E): CType {
        switch (e.k) {
            case 'num': return e.big ? T_LONG : T_INT;
            case 'fnum': return T_DOUBLE;
            case 'chr': return T_INT;
            case 'str': return ptrTo(T_CHAR);
            case 'id': { const v = this.lookup(e.name); if (!v) this.err('Unknown name "' + e.name + '"', e.line); return v.t; }
            case 'mem': { const t = this.typeOf(e.e); if (t.k !== 'struct') this.err('"' + e.name + '" is not a field (the left side is not a struct)', e.line); return this.field(t, e.name, e.line).type; }
            case 'arrow': { const t = this.typeOf(e.e); if (t.k !== 'ptr' || t.to.k !== 'struct') this.err('"->" needs a pointer to a struct on its left', e.line); return this.field(t.to, e.name, e.line).type; }
            case 'idx': { const t = this.typeOf(e.a); if (t.k === 'ptr') return t.to; if (t.k === 'arr') return t.of; return this.err('Only arrays and pointers can be indexed with [ ]', e.line); }
            case 'un': { if (e.op === '*') { const t = this.typeOf(e.e); if (t.k === 'ptr') return t.to; if (t.k === 'arr') return t.of; return this.err('Only pointers can be dereferenced with *', e.line); } if (e.op === '&') return ptrTo(this.typeOf(e.e)); if (e.op === '!') return T_INT; return this.typeOf(e.e); }
            case 'cast': return e.type;
            case 'sizeofT': case 'sizeofE': return { k: 'int', size: 8, signed: false, name: 'size_t' };
            case 'call': { const f = e.f.k === 'id' ? this.prog.funcs.get(e.f.name) : undefined; return f ? f.ret : T_INT; }
            case 'assign': return this.typeOf(e.l);
            case 'cond': return this.typeOf(e.a);
            case 'pre': case 'post': return this.typeOf(e.e);
            case 'comma': return this.typeOf(e.r);
            case 'bin': { if (['<', '>', '<=', '>=', '==', '!=', '&&', '||'].includes(e.op)) return T_INT; const a = this.typeOf(e.l), b = this.typeOf(e.r); if (a.k === 'float' || b.k === 'float') return T_DOUBLE; if (a.k === 'ptr' || a.k === 'arr') return b.k === 'ptr' ? T_LONG : (a.k === 'arr' ? ptrTo(a.of) : a); if (b.k === 'ptr' || b.k === 'arr') return b.k === 'arr' ? ptrTo(b.of) : b; return a.k === 'int' && a.size === 8 ? a : T_INT; }
            default: return T_INT;
        }
    }
    field(t: StructT, name: string, line: number) {
        const f = t.fields.find(x => x.name === name);
        if (!f) this.err('"' + (t.name || 'struct') + '" has no field called "' + name + '"', line);
        return f;
    }
    evalL(e: E): LV {
        this.tick();
        switch (e.k) {
            case 'id': { const v = this.lookup(e.name); if (!v) this.err('Unknown name "' + e.name + '" (not declared anywhere)', e.line); return { t: v.t, addr: v.addr }; }
            case 'mem': { const b = this.evalL(e.e); if (b.t.k !== 'struct') this.err('The left side of "." is not a struct', e.line); const f = this.field(b.t, e.name, e.line); return { t: f.type, addr: b.addr + f.offset }; }
            case 'arrow': {
                const p = this.evalR(e.e) as Num;
                if (isAgg(p) || p.t.k !== 'ptr' || p.t.to.k !== 'struct') this.err('The left side of "->" must be a pointer to a struct', e.line);
                if (p.n === 0) this.err('"' + this.txt(e.e) + '->' + e.name + '": ' + this.txt(e.e) + ' is NULL, so there is no struct to read. The program crashes here.', e.line);
                const f = this.field(p.t.to as StructT, e.name, e.line); return { t: f.type, addr: p.n + f.offset };
            }
            case 'idx': {
                const b = this.evalR(e.a) as Num, i = this.evalR(e.i) as Num;
                if (isAgg(b) || (b.t.k !== 'ptr')) this.err('Only arrays and pointers can be indexed with [ ]', e.line);
                const el = (b.t as { to: CType }).to;
                return { t: el, addr: b.n + i.n * sizeOf(el) };
            }
            case 'un': if (e.op === '*') { const p = this.evalR(e.e) as Num; if (isAgg(p) || p.t.k !== 'ptr') this.err('Only pointers can be dereferenced with *', e.line); if (p.n === 0) this.err('Dereferencing a NULL pointer: "' + this.txt(e.e) + '" is NULL.', e.line); return { t: p.t.to, addr: p.n }; } break;
        }
        return this.err('This is not something that has an address (the left side of = must be a variable, field or element)', e.line);
    }
    isLvalueNode(e: E): boolean { return e.k === 'id' || e.k === 'mem' || e.k === 'arrow' || e.k === 'idx' || (e.k === 'un' && e.op === '*'); }
    evalR(e: E): RV {
        this.tick();
        switch (e.k) {
            case 'num': return { t: e.big ? T_LONG : T_INT, n: e.v };
            case 'fnum': return { t: e.single ? { k: 'float', size: 4, name: 'float' } : T_DOUBLE, n: e.v };
            case 'chr': return { t: T_INT, n: e.v };
            case 'str': return { t: ptrTo(T_CHAR), n: this.strAddr(e.v) };
            case 'id': case 'mem': case 'arrow': case 'idx': { const l = this.evalL(e); return this.loadRV(l.t, l.addr); }
            case 'un': return this.unary(e);
            case 'bin': return this.binary(e);
            case 'assign': return this.assignment(e);
            case 'pre': case 'post': {
                const l = this.evalL(e.e); const old = this.loadRV(l.t, l.addr) as Num;
                const step = (l.t.k === 'ptr' ? sizeOf(l.t.to) : 1) * (e.op === '++' ? 1 : -1);
                const nv = this.convert({ t: old.t, n: old.n + step }, l.t) as Num; this.store(l.t, l.addr, nv.n);
                return e.k === 'pre' ? nv : old;
            }
            case 'cond': return this.truthy(this.evalR(e.c)) ? this.evalR(e.a) : this.evalR(e.b);
            case 'comma': this.evalR(e.l); return this.evalR(e.r);
            case 'cast': { const v = this.evalR(e.e); return this.convert(v, e.type, e.line); }
            case 'sizeofT': return { t: { k: 'int', size: 8, signed: false, name: 'size_t' }, n: sizeOf(e.type) };
            case 'sizeofE': return { t: { k: 'int', size: 8, signed: false, name: 'size_t' }, n: sizeOf(this.typeOf(e.e)) };
            case 'call': return this.callExpr(e);
            case 'init': return this.err('A { } list can only be used to set up a variable', e.line);
        }
        return this.err('Unsupported expression', e.line);
    }
    unary(e: E): RV {
        if (e.op === '&') {
            const l = this.evalL(e.e);
            return { t: ptrTo(l.t), n: l.addr };
        }
        if (e.op === '*') { const l = this.evalL(e); return this.loadRV(l.t, l.addr); }
        const v = this.evalR(e.e) as Num;
        if (isAgg(v)) this.err('Cannot apply "' + e.op + '" to a struct', e.line);
        if (e.op === '!') return { t: T_INT, n: v.n ? 0 : 1 };
        if (e.op === '-') return this.convert({ t: v.t.k === 'float' ? v.t : (v.t.k === 'int' && v.t.size === 8 ? v.t : T_INT), n: -v.n }, v.t.k === 'float' ? v.t : (v.t.k === 'int' && v.t.size === 8 ? v.t : T_INT));
        if (e.op === '+') return v;
        if (e.op === '~') return { t: T_INT, n: ~v.n };
        return this.err('Unsupported operator ' + e.op, e.line);
    }
    binary(e: E): RV {
        const op: string = e.op;
        if (op === '&&') { return { t: T_INT, n: this.truthy(this.evalR(e.l)) && this.truthy(this.evalR(e.r)) ? 1 : 0 }; }
        if (op === '||') { return { t: T_INT, n: this.truthy(this.evalR(e.l)) || this.truthy(this.evalR(e.r)) ? 1 : 0 }; }
        const a = this.evalR(e.l), b = this.evalR(e.r);
        if (isAgg(a) || isAgg(b)) this.err('Cannot use "' + op + '" on a struct', e.line);
        return this.arith(op, a, b, e.line);
    }
    arith(op: string, a: Num, b: Num, line: number): Num {
        const ap = a.t.k === 'ptr', bp = b.t.k === 'ptr';
        if (['<', '>', '<=', '>=', '==', '!='].includes(op)) {
            const r = op === '<' ? a.n < b.n : op === '>' ? a.n > b.n : op === '<=' ? a.n <= b.n : op === '>=' ? a.n >= b.n : op === '==' ? a.n === b.n : a.n !== b.n;
            return { t: T_INT, n: r ? 1 : 0 };
        }
        if (ap && !bp && (op === '+' || op === '-')) { const sz = sizeOf((a.t as { to: CType }).to); return { t: a.t, n: a.n + (op === '+' ? 1 : -1) * b.n * sz }; }
        if (bp && !ap && op === '+') { const sz = sizeOf((b.t as { to: CType }).to); return { t: b.t, n: b.n + a.n * sz }; }
        if (ap && bp && op === '-') return { t: T_LONG, n: Math.trunc((a.n - b.n) / sizeOf((a.t as { to: CType }).to)) };
        const fl = a.t.k === 'float' || b.t.k === 'float';
        const big = (a.t.k === 'int' && a.t.size === 8) || (b.t.k === 'int' && b.t.size === 8);
        const uns = (a.t.k === 'int' && !a.t.signed && a.t.size >= 4) || (b.t.k === 'int' && !b.t.signed && b.t.size >= 4);
        const rt: CType = fl ? T_DOUBLE : big ? T_LONG : uns ? { k: 'int', size: 4, signed: false, name: 'unsigned int' } : T_INT;
        let r: number;
        switch (op) {
            case '+': r = a.n + b.n; break;
            case '-': r = a.n - b.n; break;
            case '*': r = a.n * b.n; break;
            case '/': if (b.n === 0 && !fl) this.err('Division by zero', line); r = fl ? a.n / b.n : Math.trunc(a.n / b.n); break;
            case '%': if (b.n === 0) this.err('Division by zero (in %)', line); r = a.n % b.n; break;
            /* a long (64 bits) needs BigInt: JavaScript's own bit operators work on 32 bits */
            case '&': r = rt.k === 'int' && rt.size === 8 ? Number(BigInt.asIntN(64, BigInt(Math.trunc(a.n)) & BigInt(Math.trunc(b.n)))) : a.n & b.n; break;
            case '|': r = rt.k === 'int' && rt.size === 8 ? Number(BigInt.asIntN(64, BigInt(Math.trunc(a.n)) | BigInt(Math.trunc(b.n)))) : a.n | b.n; break;
            case '^': r = rt.k === 'int' && rt.size === 8 ? Number(BigInt.asIntN(64, BigInt(Math.trunc(a.n)) ^ BigInt(Math.trunc(b.n)))) : a.n ^ b.n; break;
            case '<<': r = rt.k === 'int' && rt.size === 8 ? Number(BigInt.asIntN(64, BigInt(Math.trunc(a.n)) << BigInt(Math.trunc(b.n)))) : a.n << b.n; break;
            case '>>': r = rt.k === 'int' && rt.size === 8 ? Number(BigInt(Math.trunc(a.n)) >> BigInt(Math.trunc(b.n))) : a.n >> b.n; break;
            default: return this.err('Unsupported operator ' + op, line);
        }
        return this.convert({ t: rt, n: r }, rt) as Num;
    }
    assignment(e: E): RV {
        const l = this.evalL(e.l);
        if (e.op === '=') {
            const v = this.evalR(e.r);
            this.storeRV(l.t, l.addr, v);
            return l.t.k === 'struct' ? v : this.loadQuiet(l);
        }
        const old = this.loadRV(l.t, l.addr) as Num, r = this.evalR(e.r) as Num;
        if (isAgg(old) || isAgg(r)) this.err('Cannot use "' + e.op + '" on a struct', e.line);
        const res = this.arith(e.op.slice(0, -1), old, r, e.line);
        this.storeRV(l.t, l.addr, res);
        return this.loadQuiet(l);
    }
    loadQuiet(l: LV): RV { return this.quiet(() => this.loadRV(l.t, l.addr)) as RV; }

    /* ---- calls ---- */
    callExpr(e: E): RV {
        if (e.f.k !== 'id') this.err('Only calls by function name are supported', e.line);
        const name: string = e.f.name;
        const user = this.prog.funcs.get(name);
        const args = e.args.map((a: E) => this.evalR(a));
        if (user && user.body) return this.callUser(user, args, e);
        return this.builtin(name, args, e);
    }
    argText(args: RV[]): string { return args.map(a => this.fmtVal(a)).join(', '); }
    callUser(f: Func, args: RV[], e: E): RV {
        if (args.length !== f.params.length) this.err(f.name + '() expects ' + f.params.length + ' argument(s) but got ' + args.length, e.line);
        if (this.frames.length >= 400) this.err('Stack overflow: too many nested calls (is a recursive function missing its stopping case?)', e.line);
        const callerLine = e.line;
        const frame: Frame = { fn: f, scopes: [new Map()], vars: [], sp0: this.sp, line: f.line, args: '' };
        this.frames.push(frame);
        const callArgs = this.argText(args);
        frame.args = callArgs;
        f.params.forEach((p, i) => { const v = this.declare(p.name, p.type, f.line); this.storeRV(p.type, v.addr, args[i]); });
        this.curLine = f.line;
        this.notes.push('A new stack frame for <b>' + esc(f.name) + '()</b> is pushed. Arguments are copied into the parameters' + (f.params.length ? ': ' + f.params.map((p, i) => '<b>' + esc(p.name) + '</b> = ' + esc(this.fmtVal(args[i]))).join(', ') : '') + (f.params.some(p => p.type.k === 'struct') ? '. A struct parameter is a whole copy, so changing it does not change the caller\'s struct' : '') + '.');
        if (this.frames.length === 1) this.notes = ['Every C program starts running at <b>main()</b>. Its stack frame holds its local variables.'];
        this.emit('call', f.line, this.frames.length === 1 ? 'Program starts' : 'Call ' + f.name + '(' + callArgs + ')', this.frames.length === 1 ? [{ t: 'main()' }] : [{ t: f.name + '(' }, { t: callArgs, k: 'r' }, { t: ')' }]);
        let ret: RV | null = null;
        try { this.execBlockBody(f.body as S); }
        catch (s) { if (s instanceof ReturnSignal) ret = s.val; else throw s; }
        this.frames.pop(); this.sp = frame.sp0;
        this.curLine = callerLine;
        if (f.ret.k === 'void') return { t: T_INT, n: 0 };
        if (!ret) { this.notes.push('<b>' + esc(f.name) + '()</b> reached its end without returning a value, so the caller gets garbage.'); return this.convert({ t: T_INT, n: 0 }, f.ret) as RV; }
        return this.convert(ret, f.ret, callerLine);
    }

    /* ---- standard library ---- */
    builtin(name: string, args: RV[], e: E): RV {
        const num = (i: number): number => { const a = args[i]; if (!a || isAgg(a)) this.err(name + '(): bad argument ' + (i + 1), e.line); return (a as Num).n; };
        const ret = (n: number, t: CType = T_INT): Num => ({ t, n });
        const vp = ptrTo(T_VOID);
        switch (name) {
            case 'printf': { const fmt = this.readStr(num(0)); const s = this.format(fmt, args.slice(1), e.line); this.out += s; this.notes.push('<b>printf</b> prints: <code>' + esc(s.replace(/\n/g, '\\n')) + '</code>'); return ret(s.length); }
            case 'puts': { const s = this.readStr(num(0)) + '\n'; this.out += s; return ret(1); }
            case 'putchar': this.out += String.fromCharCode(num(0) & 255); return ret(num(0));
            case 'malloc': { const sz = num(0); const a = this.malloc(sz, false, this.frames[this.frames.length - 1]?.fn.name || 'main'); this.alloc = { fn: 'malloc', sz, addr: a, calc: String(sz), zero: false }; this.notes.push('<b>malloc(' + sz + ')</b> reserves ' + sz + ' bytes on the heap at <b>' + hex(a) + '</b>. Its contents are not set yet (shown as ?).'); return ret(a, vp); }
            case 'calloc': { const sz = num(0) * num(1); const a = this.malloc(sz, true, this.frames[this.frames.length - 1]?.fn.name || 'main'); this.alloc = { fn: 'calloc', sz, addr: a, calc: String(sz), zero: true }; this.notes.push('<b>calloc</b> reserves ' + sz + ' bytes at <b>' + hex(a) + '</b> and sets them to 0.'); return ret(a, vp); }
            case 'realloc': {
                const old = num(0), sz = num(1);
                if (old === 0) { const a = this.malloc(sz, false, this.frames[this.frames.length - 1]?.fn.name || 'main'); return ret(a, vp); }
                const b = this.blocks.find(x => x.addr === old && !x.freed);
                if (!b) this.err(old > 2 ** 47 ? 'realloc() was given a garbage pointer: it was never set to a malloc result. (In main, was the list ever initialized? initialize(L) returns the new list, so it must be stored: L = initialize(L).)' : 'realloc(' + hex(old) + '): not a live block from malloc', e.line);
                const a = this.malloc(sz, false, b.site); const n = Math.min(sz, b.size);
                const src = this.rawLoad(old, n); this.rawStore(a, src.bytes, src.init);
                b.freed = true;
                this.notes.push('<b>realloc</b> moves the data into a new ' + sz + '-byte block at <b>' + hex(a) + '</b> and frees the old block at ' + hex(old) + '.');
                return ret(a, vp);
            }
            case 'free': { const a = num(0); this.free(a); this.notes.push('<b>free</b> gives the block at ' + hex(a) + ' back. Do not use it after this.'); return ret(0); }
            case 'memcpy': case 'memmove': { const d = num(0), s = num(1), n = num(2); if (n > 0) { const src = this.rawLoad(s, n); this.track(this.reads, s, n); this.rawStore(d, src.bytes, src.init); this.track(this.writes, d, n); this.notes.push('<b>' + name + '</b> copies ' + n + ' bytes from ' + hex(s) + ' to ' + hex(d) + '.'); } return ret(d, vp); }
            case 'memset': { const d = num(0), c = num(1) & 255, n = num(2); if (n > 0) { this.rawStore(d, new Uint8Array(n).fill(c), null); this.track(this.writes, d, n); } return ret(d, vp); }
            case 'toupper': { const c = num(0); return ret(c >= 97 && c <= 122 ? c - 32 : c); }
            case 'tolower': { const c = num(0); return ret(c >= 65 && c <= 90 ? c + 32 : c); }
            case 'isalpha': case 'isdigit': case 'isalnum': case 'isspace': case 'isupper': case 'islower': case 'ispunct': {
                const c = num(0), ch = c >= 0 && c < 256 ? String.fromCharCode(c) : '';
                const re = { isalpha: /[A-Za-z]/, isdigit: /[0-9]/, isalnum: /[A-Za-z0-9]/, isspace: /[ \t\n\v\f\r]/, isupper: /[A-Z]/, islower: /[a-z]/, ispunct: /[!-\/:-@\[-`{-~]/ }[name] as RegExp;
                return ret(ch && re.test(ch) ? 1 : 0);
            }
            case 'floor': return ret(Math.floor(num(0)), T_DOUBLE);
            case 'ceil': return ret(Math.ceil(num(0)), T_DOUBLE);
            case 'round': return ret(Math.sign(num(0)) * Math.round(Math.abs(num(0))), T_DOUBLE);
            case 'fmod': return ret(num(0) % num(1), T_DOUBLE);
            case 'sin': return ret(Math.sin(num(0)), T_DOUBLE);
            case 'cos': return ret(Math.cos(num(0)), T_DOUBLE);
            case 'tan': return ret(Math.tan(num(0)), T_DOUBLE);
            case 'log': return ret(Math.log(num(0)), T_DOUBLE);
            case 'log10': return ret(Math.log10(num(0)), T_DOUBLE);
            case 'exp': return ret(Math.exp(num(0)), T_DOUBLE);
            case 'strchr': case 'strrchr': {
                const a = num(0), s = this.readStr(a), ch = num(1) & 255;
                const ix = ch === 0 ? s.length : name === 'strchr' ? s.indexOf(String.fromCharCode(ch)) : s.lastIndexOf(String.fromCharCode(ch));
                return ret(ix < 0 ? 0 : a + ix, ptrTo(T_CHAR));
            }
            case 'strstr': { const a = num(0), ix = this.readStr(a).indexOf(this.readStr(num(1))); return ret(ix < 0 ? 0 : a + ix, ptrTo(T_CHAR)); }
            case 'sprintf': { const s = this.format(this.readStr(num(1)), args.slice(2), e.line); this.putStr(num(0), s); return ret(s.length); }
            case 'snprintf': { const s = this.format(this.readStr(num(2)), args.slice(3), e.line), n = num(1); if (n > 0) this.putStr(num(0), s.slice(0, n - 1)); return ret(s.length); }
            case 'strlen': return ret(this.readStr(num(0)).length, { k: 'int', size: 8, signed: false, name: 'size_t' });
            case 'strcmp': { const a = this.readStr(num(0)), b = this.readStr(num(1)); return ret(a < b ? -1 : a > b ? 1 : 0); }
            case 'strncmp': { const n = num(2); const a = this.readStr(num(0)).slice(0, n), b = this.readStr(num(1)).slice(0, n); return ret(a < b ? -1 : a > b ? 1 : 0); }
            case 'strcpy': { const s = this.readStr(num(1)); this.putStr(num(0), s); return ret(num(0), ptrTo(T_CHAR)); }
            case 'strncpy': { const n = num(2); let s = this.readStr(num(1)).slice(0, n); while (s.length < n) s += '\0'; const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = s.charCodeAt(i); this.rawStore(num(0), b, null); this.track(this.writes, num(0), n); return ret(num(0), ptrTo(T_CHAR)); }
            case 'strcat': { const d = this.readStr(num(0)); this.putStr(num(0) + d.length, this.readStr(num(1))); return ret(num(0), ptrTo(T_CHAR)); }
            case 'abs': return ret(Math.abs(num(0)));
            case 'exit': throw new ExitSignal(num(0));
            case 'rand': return ret(Math.floor(Math.random() * 32768));
            case 'srand': return ret(0);
            case 'atoi': return ret(parseInt(this.readStr(num(0)), 10) || 0);
            case 'scanf': {
                const left0 = this.input.length - this.inPos, got = this.scan(this.readStr(num(0)), args.slice(1), e.line);
                this.echoIn();
                this.notes.push(got > 0 ? '<b>scanf</b> read <b>' + got + '</b> value' + (got > 1 ? 's' : '') + ' from the input.' : '<b>scanf</b> could not read anything' + (left0 <= 0 ? ': there is no input left (it was ended).' : ': what is left of the input does not match the format.') + ' The variable keeps its old value.');
                return ret(got === 0 && left0 <= 0 ? -1 : got);
            }
            case 'getchar': { this.need(e.line); if (this.inPos >= this.input.length) return ret(-1); const ch = this.input.charCodeAt(this.inPos++); this.echoIn(); return ret(ch); }
            case 'sqrt': return ret(Math.sqrt(num(0)), T_DOUBLE);
            case 'pow': return ret(Math.pow(num(0), num(1)), T_DOUBLE);
            case 'fabs': return ret(Math.abs(num(0)), T_DOUBLE);
            /* ---- files: a tiny in-memory disk, so programs can write a file and read it back (nothing touches the real disk) ---- */
            case 'fopen': {
                const fname = this.readStr(num(0)), mode = this.readStr(num(1));
                const m = mode[0] || 'r';
                if (!'rwa'.includes(m)) this.err('fopen(): the mode "' + mode + '" is not supported (use "r", "w" or "a")', e.line);
                if (m === 'r' && !this.files.has(fname)) { this.notes.push('<b>fopen</b> could not open <code>' + esc(fname) + '</code> for reading: the file does not exist, so it returns <b>NULL</b>.'); return ret(0, ptrTo(T_FILE)); }
                if (m === 'w') this.files.set(fname, ''); else if (m === 'a' && !this.files.has(fname)) this.files.set(fname, '');
                const h = this.fnext; this.fnext += 16;
                this.fhs.set(h, { name: fname, mode, pos: m === 'a' ? (this.files.get(fname) as string).length : 0, eof: false });
                this.notes.push('<b>fopen</b> opens <code>' + esc(fname) + '</code> ' + (m === 'r' ? 'for reading, at its beginning' : m === 'w' ? 'for writing: the file is created, or emptied if it already existed' : 'for appending: new text goes at the end') + '. The returned pointer is a handle to it; always check that it is not NULL.');
                return ret(h, ptrTo(T_FILE));
            }
            case 'fclose': {
                const h = num(0), f = this.fhs.get(h);
                if (!f) this.err(h === 0 ? 'fclose() was given NULL: fopen failed and the result was never checked.' : 'fclose(): this file is not open (was it closed twice?)', e.line);
                this.fhs.delete(h);
                this.notes.push('<b>fclose</b> closes <code>' + esc(f.name) + '</code>. Anything written is now saved in the file' + this.fileNote(f.name) + '.');
                return ret(0);
            }
            case 'fprintf': case 'fputs': case 'fputc': case 'putc': {
                const h = name === 'fprintf' ? num(0) : num(1);
                const text = name === 'fprintf' ? this.format(this.readStr(num(1)), args.slice(2), e.line) : name === 'fputs' ? this.readStr(num(0)) : String.fromCharCode(num(0) & 255);
                if (h === 20736 || h === 20752) { this.out += text; return ret(0); }
                const f = this.fileFor(h, name, true, e.line);
                this.writeFile(f, text);
                this.notes.push('<b>' + name + '</b> writes <code>' + esc(text.replace(/\n/g, '\n')) + '</code> into <code>' + esc(f.name) + '</code>' + this.fileNote(f.name) + '.');
                return ret(name === 'fprintf' ? text.length : 0);
            }
            case 'fgetc': case 'getc': {
                const f = this.fileFor(num(0), name, false, e.line), text = this.files.get(f.name) as string;
                if (f.pos >= text.length) { f.eof = true; this.notes.push('<b>' + name + '</b> is at the end of <code>' + esc(f.name) + '</code>, so it returns <b>EOF</b> (-1).'); return ret(-1); }
                const c = text.charCodeAt(f.pos++);
                this.notes.push('<b>' + name + '</b> reads the character <code>' + esc(JSON.stringify(String.fromCharCode(c)).slice(1, -1)) + '</code> from <code>' + esc(f.name) + '</code>.');
                return ret(c);
            }
            case 'fgets': {
                if (num(2) === 20720) {      // stdin: one line of the input
                    this.need(e.line);
                    const n = num(1);
                    if (this.inPos >= this.input.length) return ret(0, ptrTo(T_CHAR));
                    let j = this.inPos; while (j < this.input.length && j - this.inPos < n - 1) { if (this.input[j++] === '\n') break; }
                    const text = this.input.slice(this.inPos, j); this.inPos = j;
                    this.putStr(num(0), text); this.echoIn();
                    return ret(num(0), ptrTo(T_CHAR));
                }
                const f = this.fileFor(num(2), name, false, e.line), text = this.files.get(f.name) as string, n = num(1);
                if (f.pos >= text.length) { f.eof = true; this.notes.push('<b>fgets</b> is at the end of <code>' + esc(f.name) + '</code>, so it returns <b>NULL</b>.'); return ret(0, ptrTo(T_CHAR)); }
                let j = f.pos; while (j < text.length && j - f.pos < n - 1) { if (text[j++] === '\n') break; }
                const line = text.slice(f.pos, j); f.pos = j;
                this.putStr(num(0), line);
                this.notes.push('<b>fgets</b> reads one line from <code>' + esc(f.name) + '</code>: <code>' + esc(line.replace(/\n/g, '\n')) + '</code>');
                return ret(num(0), ptrTo(T_CHAR));
            }
            case 'fscanf': {
                const f = this.fileFor(num(0), name, false, e.line), text = this.files.get(f.name) as string;
                const keep = { input: this.input, pos: this.inPos };
                this.input = text; this.inPos = f.pos;
                let got = 0;
                try { got = this.scan(this.readStr(num(1)), args.slice(2), e.line); } finally { f.pos = this.inPos; this.input = keep.input; this.inPos = keep.pos; }
                if (got === 0 && /^\s*$/.test(text.slice(f.pos))) { f.eof = true; this.notes.push('<b>fscanf</b> found nothing more in <code>' + esc(f.name) + '</code>, so it returns <b>EOF</b> (-1).'); return ret(-1); }
                this.notes.push('<b>fscanf</b> read ' + got + ' value(s) from <code>' + esc(f.name) + '</code>.');
                return ret(got);
            }
            case 'feof': { const f = this.fileFor(num(0), name, false, e.line); return ret(f.eof ? 1 : 0); }
            case 'rewind': { const f = this.fileFor(num(0), name, false, e.line); f.pos = 0; f.eof = false; this.notes.push('<b>rewind</b> goes back to the beginning of <code>' + esc(f.name) + '</code>.'); return ret(0); }
            case 'remove': { const fname = this.readStr(num(0)); const had = this.files.delete(fname); this.notes.push('<b>remove</b> deletes <code>' + esc(fname) + '</code>' + (had ? '.' : ', but there is no such file, so it returns -1.')); return ret(had ? 0 : -1); }
            case 'fflush': case 'system': return ret(0);
        }
        return this.err('The function "' + name + '" is not defined (and it is not one of the supported library functions)', e.line);
    }
    /** the open file behind a FILE pointer, or a clear crash when it is NULL, closed or has the wrong mode */
    fileFor(h: number, fn: string, write: boolean, line: number) {
        const f = this.fhs.get(h);
        if (!f) this.err(h === 0 ? fn + '() was given a NULL FILE pointer: fopen failed (does the file exist?) and the result was never checked, so the program crashes.' : fn + '(): this file is not open (was it already closed?)', line);
        if (write && f.mode[0] === 'r' && !f.mode.includes('+')) this.err(fn + '(): "' + f.name + '" was opened for reading ("r"), so it cannot be written to', line);
        if (!write && f.mode[0] !== 'r' && !f.mode.includes('+')) this.err(fn + '(): "' + f.name + '" was opened for writing ("' + f.mode + '"), so it cannot be read', line);
        return f;
    }
    writeFile(f: { name: string; mode: string; pos: number }, text: string) {
        const cur = this.files.get(f.name) as string;
        if (f.mode[0] === 'a') { this.files.set(f.name, cur + text); f.pos = cur.length + text.length; }
        else { this.files.set(f.name, cur.slice(0, f.pos) + text + cur.slice(f.pos + text.length)); f.pos += text.length; }
    }
    /** " (it now holds: ...)" for the explanation after a write */
    fileNote(name: string): string {
        const t = this.files.get(name) ?? '';
        return ' (now holds <code>' + esc((t.length > 60 ? t.slice(0, 60) + '...' : t).replace(/\n/g, '\\n')) + '</code>)';
    }
    putStr(addr: number, s: string) {
        const b = new Uint8Array(s.length + 1);
        for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255;
        this.rawStore(addr, b, null); this.track(this.writes, addr, b.length);
    }
    scan(fmt: string, args: RV[], line: number): number {
        let count = 0, ai = 0;
        const skipWs = () => { while (this.inPos < this.input.length && /\s/.test(this.input[this.inPos])) this.inPos++; };
        for (let i = 0; i < fmt.length; i++) {
            if (/\s/.test(fmt[i])) { skipWs(); continue; }
            if (fmt[i] !== '%') { this.need(line); if (this.input[this.inPos] === fmt[i]) this.inPos++; else break; continue; }
            i++; while (/[0-9l]/.test(fmt[i] || '')) i++;
            const c = fmt[i]; const target = args[ai++] as Num | undefined;
            if (!target || isAgg(target)) this.err('scanf: missing the address to store the value (did you forget the & ?)', line);
            if (c === 'c') { this.need(line); if (this.inPos >= this.input.length) break; this.store(T_CHAR, target.n, this.input.charCodeAt(this.inPos++)); count++; continue; }
            skipWs(); this.need(line);
            let j = this.inPos;
            if (c === 'd' || c === 'i') { while (/[-+0-9]/.test(this.input[j] || '')) j++; if (j === this.inPos) break; this.store(T_INT, target.n, parseInt(this.input.slice(this.inPos, j), 10)); }
            else if (c === 'f' || c === 'g') { while (/[-+0-9.eE]/.test(this.input[j] || '')) j++; if (j === this.inPos) break; this.store({ k: 'float', size: 4, name: 'float' }, target.n, parseFloat(this.input.slice(this.inPos, j))); }
            else if (c === 's') { while (j < this.input.length && !/\s/.test(this.input[j])) j++; if (j === this.inPos) break; this.putStr(target.n, this.input.slice(this.inPos, j)); }
            else break;
            this.inPos = j; count++;
        }
        return count;
    }
    format(fmt: string, args: RV[], line: number): string {
        let out = '', ai = 0;
        for (let i = 0; i < fmt.length; i++) {
            if (fmt[i] !== '%') { out += fmt[i]; continue; }
            i++;
            if (fmt[i] === '%') { out += '%'; continue; }
            let flags = ''; while ('-+ 0#'.includes(fmt[i] || 'x')) flags += fmt[i++];
            let width = ''; while (/[0-9]/.test(fmt[i] || '')) width += fmt[i++];
            if (fmt[i] === '*') { const w = args[ai++]; i++; if (w === undefined || isAgg(w)) this.err('printf: the * needs a number argument', line); width = String(Math.abs(w.n)); if (w.n < 0) flags += '-'; }
            let prec = ''; let hasPrec = false;
            if (fmt[i] === '.') {
                hasPrec = true; i++;
                if (fmt[i] === '*') { const w = args[ai++]; i++; if (w === undefined || isAgg(w)) this.err('printf: the * needs a number argument', line); prec = String(w.n); }
                else while (/[0-9]/.test(fmt[i] || '')) prec += fmt[i++];
            }
            while (/[lhzjt]/.test(fmt[i] || '')) i++;
            const c = fmt[i];
            const a = args[ai++];
            if (a === undefined) this.err('printf has more % conversions than arguments', line);
            if (isAgg(a)) this.err('printf cannot print a whole struct; print its fields', line);
            let s: string;
            if (c === 'd' || c === 'i') { s = String(Math.trunc(a.n)); if (flags.includes('+') && a.n >= 0) s = '+' + s; }
            else if (c === 'u') s = String(a.n < 0 ? a.n + 4294967296 : Math.trunc(a.n));
            else if (c === 'o') s = (a.n < 0 ? a.n + 4294967296 : a.n).toString(8);
            else if (c === 'x' || c === 'X') { s = (a.n < 0 ? a.n + 4294967296 : a.n).toString(16); if (c === 'X') s = s.toUpperCase(); }
            else if (c === 'c') s = String.fromCharCode(a.n & 255);
            else if (c === 's') { s = a.n === 0 ? '(null)' : this.readStr(a.n); if (hasPrec) s = s.slice(0, +prec || 0); }
            else if (c === 'f' || c === 'F') s = a.n.toFixed(hasPrec ? +prec || 0 : 6);
            else if (c === 'e') s = a.n.toExponential(hasPrec ? +prec || 0 : 6).replace(/e([+-])(\d)$/, 'e$10$2');
            else if (c === 'g') s = String(+a.n.toPrecision(hasPrec ? +prec || 1 : 6));
            else if (c === 'p') s = a.n === 0 ? '(nil)' : hex(a.n);
            else return this.err('printf: the conversion %' + c + ' is not supported', line);
            const w = +width || 0;
            if (s.length < w) s = flags.includes('-') ? s.padEnd(w) : (flags.includes('0') && c !== 's' && c !== 'c' ? (s.startsWith('-') ? '-' + s.slice(1).padStart(w - 1, '0') : s.padStart(w, '0')) : s.padStart(w));
            out += s;
        }
        return out;
    }

    /* ======== statements ======== */
    initInto(t: CType, addr: number, init: E): void {
        if (init.k === 'init') {
            if (t.k === 'arr') {
                this.rawStore(addr, new Uint8Array(sizeOf(t)), null);
                init.items.forEach((it: E, i: number) => { if (i >= t.n) this.err('Too many values in the { } list (the array holds ' + t.n + ')', init.line); this.initInto(t.of, addr + i * sizeOf(t.of), it); });
            } else if (t.k === 'struct') {
                this.rawStore(addr, new Uint8Array(t.size), null);
                init.items.forEach((it: E, i: number) => { const f = t.fields[i]; if (!f) this.err('Too many values in the { } list for ' + typeName(t), init.line); this.initInto(f.type, addr + f.offset, it); });
            } else this.initInto(t, addr, init.items[0]);
            this.track(this.writes, addr, sizeOf(t));
            return;
        }
        if (t.k === 'arr' && init.k === 'str') {
            const b = new Uint8Array(sizeOf(t));
            for (let i = 0; i < init.v.length && i < b.length; i++) b[i] = init.v.charCodeAt(i) & 255;
            this.rawStore(addr, b, null); this.track(this.writes, addr, b.length); return;
        }
        this.storeRV(t, addr, this.evalR(init));
    }
    txt(e: { pos: number; end: number }): string { return this.prog.src.slice(e.pos, e.end).replace(/\s+/g, ' ').trim(); }
    execBlockBody(b: S): void { const f = this.frames[this.frames.length - 1]; f.scopes.push(new Map()); const sp = this.sp; try { for (const it of b.items) this.exec(it); } finally { f.scopes.pop(); if (this.frames[this.frames.length - 1] === f) { /* keep the stack slots until the function returns (simple and predictable) */ void sp; } } }
    exec(s: S): 'break' | 'continue' | void {
        this.tick();
        const f = this.frames[this.frames.length - 1];
        this.curLine = s.line; if (f) f.line = s.line;
        switch (s.k) {
            case 'empty': return;
            case 'block': {
                f.scopes.push(new Map());
                try { for (const it of s.items) { const r = this.exec(it); if (r) return r; } } finally { f.scopes.pop(); }
                return;
            }
            case 'decl': {
                this.resetTrack();
                const formula: FormulaPart[] = [];
                for (const d of s.decls) {
                    let v: Var, firstTime = true;
                    if (s.static) {      // a static variable is made once and keeps its value between calls
                        const known = this.statics.get(d);
                        if (known) {
                            v = known; firstTime = false;
                            const fr = this.frames[this.frames.length - 1];
                            fr.scopes[fr.scopes.length - 1].set(d.name, v); fr.vars.push(v);
                        } else {
                            const size = Math.max(8, sizeOf(d.type));
                            const addr = this.staticNext; this.staticNext += Math.ceil(size / 8) * 8;
                            if (this.staticNext > DATA_BASE + DATA_SIZE) this.err('Too many static variables', s.line);
                            this.dataInit.fill(1, addr - DATA_BASE, addr - DATA_BASE + sizeOf(d.type));
                            v = { name: d.name, t: d.type, addr, line: s.line };
                            this.statics.set(d, v);
                            const fr = this.frames[this.frames.length - 1];
                            fr.scopes[fr.scopes.length - 1].set(d.name, v); fr.vars.push(v);
                        }
                    } else v = this.declare(d.name, d.type, s.line);
                    this.declared.push({ name: d.name, type: d.type, addr: v.addr });
                    if (d.init && firstTime) {
                        this.initInto(d.type, v.addr, d.init);
                        const val = this.quiet(() => this.loadRV(d.type, v.addr));
                        if (formula.length) formula.push({ t: ',  ' });
                        formula.push({ t: d.name, k: 'w' }, { t: ' = ' }, { t: val ? this.fmtVal(val) : '?', k: 'v' });
                    }
                }
                const names = s.decls.map((d: { name: string; type: CType }) => '<b>' + esc(typeName(d.type)) + ' ' + esc(d.name) + '</b>').join(', ');
                const withInit = s.decls.some((d: { init: E | null }) => d.init);
                this.emit('decl', s.line, 'Declare ' + s.decls.map((d: { name: string }) => d.name).join(', '),
                    formula, 'Line ' + s.line + ' declares ' + names + ' on the stack' + (withInit ? ' and gives it a starting value.' : '. It has no value yet, so it shows <b>?</b>.' + (s.decls.some((d: { type: CType }) => d.type.k === 'ptr') ? ' A pointer that was never set holds garbage, so do not use it yet.' : '')), s);
                return;
            }
            case 'expr': {
                this.resetTrack();
                const e: E = s.e;
                /* the wording uses the values from BEFORE the statement runs (a = a + 2 shows the old a) */
                const pre = this.preText(e);
                const val = this.evalR(e);
                this.emitExpr(s, e, val, pre);
                return;
            }
            case 'if': {
                this.resetTrack();
                const c = this.truthy(this.evalR(s.c));
                this.emit('if', s.line, 'Check ' + this.txt(s.c), this.condFormula(s.c, c), 'Line ' + s.line + ' tests <b>' + esc(this.txt(s.c)) + '</b>' + this.withVars(s.c) + '. It is <b>' + (c ? 'true' : 'false') + '</b>, so ' + (c ? 'the program goes into the <b>if</b> branch.' : (s.els ? 'the program goes into the <b>else</b> branch.' : 'the <b>if</b> branch is skipped.')), s.c);
                if (c) return this.exec(s.then);
                if (s.els) return this.exec(s.els);
                return;
            }
            case 'switch': {
                this.resetTrack();
                const v = this.evalR(s.c);
                if (isAgg(v)) this.err('A switch needs a number, not a whole struct', s.line);
                let at = -1, label = 'no case matches';
                for (const cs of s.cases) {
                    if (!cs.value) continue;
                    const cv = this.evalR(cs.value);
                    if (!isAgg(cv) && cv.n === v.n) { at = cs.at; label = 'case ' + this.txt(cs.value); break; }
                }
                if (at < 0 && s.cases.some((x: { value: E | null }) => !x.value)) { at = s.cases.find((x: { value: E | null }) => !x.value).at; label = 'default'; }
                this.emit('if', s.line, 'Switch ' + this.txt(s.c), [{ t: this.valText(s.c), k: 'r' }, { t: '  →  ' }, { t: label, k: 'v' }],
                    'Line ' + s.line + ' switches on <b>' + esc(this.txt(s.c)) + '</b>' + this.withVars(s.c) + ', which is <b>' + esc(this.fmtVal(v)) + '</b>. ' + (at >= 0 ? 'The program jumps to <b>' + esc(label) + '</b> and runs on from there until a <b>break</b>.' : 'No case matches and there is no default, so the whole switch is skipped.'));
                if (at < 0) return;
                f.scopes.push(new Map());
                try { for (let k = at; k < s.items.length; k++) { const r = this.exec(s.items[k]); if (r === 'break') return; if (r) return r; } } finally { f.scopes.pop(); }
                return;
            }
            case 'while': {
                for (;;) {
                    this.resetTrack();
                    const c = this.truthy(this.evalR(s.c));
                    this.emit('loop', s.line, 'Loop: ' + this.txt(s.c), this.condFormula(s.c, c), 'Line ' + s.line + ' tests <b>' + esc(this.txt(s.c)) + '</b>' + this.withVars(s.c) + '. It is <b>' + (c ? 'true' : 'false') + '</b>, so ' + (c ? 'the loop body runs again.' : 'the loop ends.'), s.c);
                    if (!c) return;
                    const r = this.exec(s.body);
                    if (r === 'break') return;
                }
            }
            case 'do': {
                for (;;) {
                    const r = this.exec(s.body);
                    if (r === 'break') return;
                    this.resetTrack();
                    const c = this.truthy(this.evalR(s.c));
                    this.emit('loop', s.line, 'Loop: ' + this.txt(s.c), this.condFormula(s.c, c), 'The <b>do</b> body ran once, then line ' + s.line + ' tests <b>' + esc(this.txt(s.c)) + '</b>' + this.withVars(s.c) + ': <b>' + (c ? 'true' : 'false') + '</b>.', s.c);
                    if (!c) return;
                }
            }
            case 'for': {
                f.scopes.push(new Map());
                try {
                    if (s.init) this.exec(s.init);
                    let first = true;
                    for (;;) {
                        this.curLine = s.line; f.line = s.line;
                        if (!first && s.step) { this.resetTrack(); this.evalR(s.step); }
                        else this.resetTrack();
                        const c = s.c ? this.truthy(this.evalR(s.c)) : true;
                        const stepTxt = !first && s.step ? ' After the body, <b>' + esc(this.txt(s.step)) + '</b> ran.' : '';
                        if (s.c) this.emit('loop', s.line, 'Loop: ' + this.txt(s.c), this.condFormula(s.c, c), 'Line ' + s.line + ' tests <b>' + esc(this.txt(s.c)) + '</b>' + this.withVars(s.c) + '.' + stepTxt + ' It is <b>' + (c ? 'true' : 'false') + '</b>, so ' + (c ? 'the loop body runs.' : 'the loop ends.'), s.c);
                        first = false;
                        if (!c) return;
                        const r = this.exec(s.body);
                        if (r === 'break') return;
                    }
                } finally { f.scopes.pop(); }
            }
            case 'return': {
                this.resetTrack();
                const fn = f.fn;
                let val: RV | null = null;
                if (s.e) val = this.convert(this.evalR(s.e), fn.ret, s.line);
                const caller = this.frames.length > 1 ? this.frames[this.frames.length - 2].fn.name : null;
                const shown = val ? this.fmtVal(val) : '';
                this.emit('return', s.line, 'Return from ' + fn.name + '()',
                    val ? [{ t: 'return ' }, { t: shown, k: 'v' }] : [{ t: 'return' }],
                    'Line ' + s.line + ' ends <b>' + esc(fn.name) + '()</b>' + (val ? ' and hands back <b>' + esc(shown) + '</b>' : '') + (caller ? ' to <b>' + esc(caller) + '()</b>. Its stack frame is removed, so its local variables are gone.' : '. The program is finished.'), s.e || s);
                throw new ReturnSignal(val);
            }
            case 'break': return 'break';
            case 'continue': return 'continue';
        }
        return this.err('Unsupported statement', s.line);
    }

    /* ======== describing what happened ======== */
    alloc: { fn: string; sz: number; addr: number; calc: string; zero: boolean } | null = null;
    declared: { name: string; type: CType; addr: number }[] = [];
    resetTrack() { this.reads = []; this.writes = []; this.notes = []; this.uninitRead = false; this.alloc = null; this.declared = []; }
    /** 3 * sizeof(int) written with the sizes filled in: 3 * 4 */
    sizeText(e: E): string {
        if (e.k === 'sizeofT') return String(sizeOf(e.type));
        if (e.k === 'sizeofE') return String(this.quiet(() => sizeOf(this.typeOf(e.e))) ?? this.txt(e));
        if (e.k === 'bin') { const t = this.sizeText(e.l) + ' ' + e.op + ' ' + this.sizeText(e.r); return e.paren ? '(' + t + ')' : t; }
        return this.valText(e);
    }
    fmtVal(v: RV | undefined): string {
        if (!v) return '?';
        if (isAgg(v)) return '{…}';
        if (v.t.k === 'ptr') return v.n === 0 ? 'NULL' : hex(v.n);
        if (v.t.k === 'float') return String(+v.n.toFixed(4));
        if (v.t.k === 'int' && v.t.name === 'bool') return v.n ? 'true' : 'false';
        /* a char is shown as the character itself: 'b', '\\0' for the end of a text (other values stay numbers) */
        if (v.t.k === 'int' && v.t.size === 1 && v.t.name.includes('char')) { const n = v.n & 255; if (n === 0) return "'\\0'"; if (n >= 32 && n < 127) return "'" + String.fromCharCode(n) + "'"; }
        return String(v.n);
    }
    hasSide(e: E): boolean {
        if (['assign', 'pre', 'post', 'call'].includes(e.k)) return true;
        return Object.values(e).some(x => (x && typeof x === 'object' && 'k' in (x as object) && this.hasSide(x as E)) || (Array.isArray(x) && x.some(y => y && typeof y === 'object' && 'k' in y && this.hasSide(y))));
    }
    /** the memory location written with indexes filled in: L.elemPtr[3] */
    path(e: E): string {
        if (e.k === 'idx') { const i = this.hasSide(e.i) ? undefined : this.quiet(() => this.evalR(e.i)); return this.path(e.a) + '[' + (i && !isAgg(i) ? this.fmtVal(i) : this.txt(e.i)) + ']'; }
        if (e.k === 'mem') return this.path(e.e) + '.' + e.name;
        if (e.k === 'arrow') return this.path(e.e) + '->' + e.name;
        if (e.k === 'un' && e.op === '*') return '*' + this.path(e.e);
        return this.txt(e);
    }
    /** an expression with every variable replaced by its value: 3 > 1 */
    valText(e: E): string {
        if (this.hasSide(e)) return this.txt(e);
        if (this.isLvalueNode(e)) { const v = this.quiet(() => this.evalR(e)); return v && !isAgg(v) ? this.fmtVal(v) : this.txt(e); }
        if (e.k === 'bin') return this.valText(e.l) + ' ' + e.op + ' ' + this.valText(e.r);
        if (e.k === 'un' && e.op !== '&') return e.op + this.valText(e.e);
        if (e.paren) { const inner = { ...e, paren: false }; return '(' + this.valText(inner) + ')'; }
        return this.txt(e);
    }
    condFormula(c: E, result: boolean): FormulaPart[] {
        const v = this.valText(c), src = this.txt(c);
        return v === src ? [{ t: src + '  →  ' }, { t: result ? 'true' : 'false', k: 'v' }] : [{ t: v, k: 'r' }, { t: '  →  ' }, { t: result ? 'true' : 'false', k: 'v' }];
    }
    ids(e: E, out: Set<string>) {
        if (e.k === 'id') out.add(e.name);
        for (const x of Object.values(e)) {
            if (x && typeof x === 'object' && !Array.isArray(x) && 'k' in (x as object)) this.ids(x as E, out);
            else if (Array.isArray(x)) x.forEach(y => { if (y && typeof y === 'object' && 'k' in y) this.ids(y as E, out); });
        }
    }
    withVars(e: E): string {
        const set = new Set<string>(); this.ids(e, set);
        const parts: string[] = [];
        set.forEach(n => {
            const v = this.lookup(n);
            if (v && (v.t.k === 'int' || v.t.k === 'float') && this.inited(v.addr, sizeOf(v.t))) { const val = this.quiet(() => this.loadRV(v.t, v.addr)); if (val) parts.push('<b>' + esc(n) + '</b> = ' + esc(this.fmtVal(val))); }
        });
        return parts.length ? ' (with ' + parts.slice(0, 4).join(', ') + ')' : '';
    }
    preText(e: E): { lhs?: string; rhs?: string; vars?: string } {
        if (e.k === 'assign') return { lhs: this.path(e.l), rhs: e.op === '=' ? (this.isLvalueNode(e.r) ? this.path(e.r) : this.valText(e.r)) : this.valText(e.r), vars: this.withVars(e) };
        if (e.k === 'pre' || e.k === 'post') return { lhs: this.path(e.e), vars: this.withVars(e) };
        if (e.k === 'call') return { rhs: e.args.map((a: E) => this.valText(a)).join(', '), vars: this.withVars(e) };
        return {};
    }
    emitExpr(s: S, e: E, val: RV, pre: { lhs?: string; rhs?: string; vars?: string } = {}): void {
        const src = this.txt(e);
        let formula: FormulaPart[] = [];
        let html = '';
        const title = src.length > 56 ? src.slice(0, 54) + '…' : src;
        if (e.k === 'assign') {
            const lhs = pre.lhs ?? this.path(e.l);
            const shown = this.fmtVal(val);
            if (e.op === '=') {
                const rhs = pre.rhs ?? (this.isLvalueNode(e.r) ? this.path(e.r) : this.valText(e.r));
                formula = [{ t: lhs, k: 'w' }, { t: ' = ' }, { t: rhs, k: 'r' }];
                if (rhs !== shown) formula.push({ t: ' = ' }, { t: shown, k: 'v' });
                const callName = e.r.k === 'call' ? e.r.f.name : '';
                html = 'Line ' + s.line + ' runs' + (pre.vars ?? this.withVars(e)) + '. ' + (callName && this.prog.funcs.get(callName)?.body
                    ? '<b>' + esc(callName) + '()</b> returned <b>' + esc(shown) + '</b> and it is stored in <b>' + esc(lhs) + '</b>.'
                    : 'It reads <b>' + esc(rhs) + '</b> and writes the value <b>' + esc(shown) + '</b> into <b>' + esc(lhs) + '</b>.');
            } else {
                const op = e.op.slice(0, -1);
                const r = pre.rhs ?? this.valText(e.r);
                formula = [{ t: lhs, k: 'w' }, { t: ' ' + e.op + ' ' }, { t: r, k: 'r' }, { t: ' → ' }, { t: shown, k: 'v' }];
                html = 'Line ' + s.line + ' runs' + (pre.vars ?? this.withVars(e)) + '. It takes the old value of <b>' + esc(lhs) + '</b>, applies <b>' + esc(op) + ' ' + esc(r) + '</b> and stores <b>' + esc(shown) + '</b> back.';
            }
        } else if (e.k === 'pre' || e.k === 'post') {
            const lhs = pre.lhs ?? this.path(e.e);
            formula = [{ t: lhs, k: 'w' }, { t: ' ' + e.op + '  →  ' }, { t: this.fmtVal(this.quiet(() => this.evalR(e.e))), k: 'v' }];
            html = 'Line ' + s.line + ' runs <b>' + esc(src) + '</b>, which changes <b>' + esc(lhs) + '</b> by one.';
        } else if (e.k === 'call') {
            const name = e.f.name;
            const user = !!this.prog.funcs.get(name)?.body;
            const args = pre.rhs ?? e.args.map((a: E) => this.valText(a)).join(', ');
            formula = [{ t: name + '(' + args + ')' }];
            if (e.f.name && !(this.prog.funcs.get(name)?.ret.k === 'void') && user) formula.push({ t: ' = ' }, { t: this.fmtVal(val), k: 'v' });
            html = user ? 'Line ' + s.line + ' called <b>' + esc(name) + '()</b>, it ran, and control came back here. The returned value is not stored anywhere.' : 'Line ' + s.line + ' calls the library function <b>' + esc(name) + '</b>.';
        } else { formula = [{ t: src }]; html = 'Line ' + s.line + ' evaluates <b>' + esc(src) + '</b>.'; }
        this.emit('expr', s.line, title, formula, html, e);
    }
    emit(kind: string, line: number, title: string, formula: FormulaPart[], html = '', refs?: E | S): void {
        void refs;
        if (this.steps.length >= this.maxSteps) throw new RuntimeError('__trunc__', line);
        let h = html;
        if (this.notes.length) h = (h ? h + ' ' : '') + this.notes.join(' ');
        this.notes = [];
        if (this.uninitRead) h += ' <span class="warn">⚠ This reads a value that was never set (it shows as ?). Its content is garbage.</span>';
        this.steps.push({ n: this.steps.length + 1, kind, line, depth: this.frames.length, title, html: h, formula, snap: this.snapshot(), outLen: this.out.length });
        this.reads = []; this.writes = []; this.uninitRead = false;
    }

    /* ======== snapshots ======== */
    view(name: string, t: CType, addr: number, id: string): Cell {
        const base = { id, name, type: typeName(t), addr, size: sizeOf(t) };
        const mark = (c: Cell) => {
            const r = this.reads.some(([a, n]) => addr < a + n && a < addr + c.size), w = this.writes.some(([a, n]) => addr < a + n && a < addr + c.size);
            if (r || w) c.rw = r && w ? 'rw' : w ? 'w' : 'r';
            return c;
        };
        if (t.k === 'struct') return mark({ ...base, kind: 'struct', text: '', init: true, children: t.fields.map(f => this.view(f.name, f.type, addr + f.offset, id + '.' + f.name)) });
        if (t.k === 'arr') {
            const isStr = t.of.k === 'int' && t.of.size === 1 && t.of.name.includes('char');
            if (isStr) {
                /* an array of characters: one box per character (the end of the text, '\0', is a box too) */
                let sg: { buf: Uint8Array; init: Uint8Array; off: number } | null = null;
                try { sg = this.seg(addr, t.n, false); } catch { sg = null; }
                const byteAt = (i: number): number => (sg && sg.init[sg.off + i] === 1 ? sg.buf[sg.off + i] : -1);   // -1: never set
                let s = '';
                for (let i = 0; i < t.n; i++) { const b = byteAt(i); if (b <= 0) break; s += String.fromCharCode(b); }
                const shown = Math.min(t.n, 24);
                const kids: Cell[] = Array.from({ length: shown }, (_, i) => {
                    const b = byteAt(i);
                    return mark({ id: id + '[' + i + ']', name: '[' + i + ']', type: 'char', addr: addr + i, size: 1, kind: 'scalar', text: b >= 0 ? charText(b) : '?', init: b >= 0 });
                });
                return mark({ ...base, kind: 'array', text: '', init: true, more: t.n - shown, children: kids, strText: s });
            }
            const shown = Math.min(t.n, 24);
            return mark({ ...base, kind: 'array', text: '', init: true, more: t.n - shown, children: Array.from({ length: shown }, (_, i) => this.view('[' + i + ']', t.of, addr + i * sizeOf(t.of), id + '[' + i + ']')) });
        }
        const size = sizeOf(t);
        const ok = this.inited(addr, size);
        if (!ok) return mark({ ...base, kind: t.k === 'ptr' ? 'ptr' : 'scalar', text: '?', init: false, pt: t.k === 'ptr' ? t.to : undefined });
        const n = this.quiet(() => this.load(t, addr)) ?? 0;
        if (t.k === 'ptr') {
            const c: Cell = { ...base, kind: 'ptr', text: n === 0 ? 'NULL' : hex(n), init: true, target: n, pt: t.to };
            /* a char* shows the characters it points to, until the '\0' (so a string literal or a text is readable, not only an address) */
            if (n !== 0 && t.to.k === 'int' && t.to.size === 1 && t.to.name.includes('char') && this.readable(n)) {
                const chars: string[] = []; let s = '', ended = false, i = 0;
                for (; i < 24; i++) {
                    if (!this.readable(n + i) || !this.inited(n + i, 1)) break;
                    const b = this.rawLoad(n + i, 1).bytes[0];
                    chars.push(charText(b));
                    if (b === 0) { ended = true; break; }
                    s += String.fromCharCode(b);
                }
                if (chars.length) { c.chars = chars; c.strText = s; c.more = ended ? 0 : 1; }
            }
            return mark(c);
        }
        if (t.k === 'float') return mark({ ...base, kind: 'scalar', text: String(+n.toFixed(4)), init: true });
        if (t.k === 'int' && t.name === 'bool') return mark({ ...base, kind: 'scalar', text: n ? 'true' : 'false', init: true });
        const isChar = t.k === 'int' && t.size === 1 && t.name.includes('char');
        return mark({ ...base, kind: 'scalar', text: isChar && n >= 32 && n < 127 ? n + " '" + String.fromCharCode(n) + "'" : String(n), init: true });
    }
    snapshot(): Snapshot {
        const frames: FrameView[] = [];
        for (let k = this.frames.length - 1; k >= 0; k--) {
            const f = this.frames[k];
            frames.push({ fn: f.fn.name, line: f.line, args: f.args, vars: f.vars.filter(v => f.scopes.some(sc => sc.get(v.name) === v)).map(v => this.view(v.name, v.t, v.addr, 'f' + k + ':' + v.name)) });
        }
        const globals = this.globalsVars.map(v => this.view(v.name, v.t, v.addr, 'g:' + v.name));
        /* what do the pointers point to? this tells us how to draw each heap block */
        const ptype = new Map<number, CType>();
        const scan = (c: Cell) => {
            if (c.kind === 'ptr' && c.init && c.target && c.pt && c.pt.k !== 'void' && !ptype.has(c.target)) ptype.set(c.target, c.pt);
            c.children?.forEach(scan);
        };
        frames.forEach(f => f.vars.forEach(scan)); globals.forEach(scan);
        const heap: BlockView[] = [];
        const done = new Set<number>();
        for (let pass = 0; pass < 6; pass++) {
            let changed = false;
            for (const b of this.blocks) {
                if (done.has(b.addr)) continue;
                const t = ptype.get(b.addr);
                if (!t && pass < 5) continue;
                done.add(b.addr); changed = true;
                const et: CType = t || T_INT;
                const es = Math.max(1, sizeOf(et)), cnt = Math.floor(b.size / es);
                const shown = Math.min(cnt, 24);
                let cells: Cell[] = [];
                if (!b.freed) {
                    cells = Array.from({ length: shown }, (_, i) => this.view('[' + i + ']', et, b.addr + i * es, 'h' + b.addr + '[' + i + ']'));
                    cells.forEach(scan);
                }
                heap.push({ addr: b.addr, size: b.size, freed: b.freed, site: b.site, elemType: typeName(et), cells, more: Math.max(0, cnt - shown) });
            }
            if (!changed && pass >= 1) break;
        }
        heap.sort((a, b) => a.addr - b.addr);
        return { frames, heap, globals };
    }

    /* ======== running ======== */
    run(): Trace {
        let error: string | undefined, errorLine: number | undefined, exitCode: number | undefined, truncated = false, waitLine = 0;
        try {
            this.frames.push({ fn: { name: '(globals)', ret: T_VOID, params: [], body: null, line: 0, endLine: 0 }, scopes: [new Map()], vars: [], sp0: this.sp, line: 0, args: '' });
            for (const g of this.prog.globals) for (const d of g.decls) {
                const addr = DATA_BASE + 0x3000 + this.globalsVars.reduce((n, v) => n + Math.max(8, sizeOf(v.t)), 0);
                const v: Var = { name: d.name, t: d.type, addr, line: g.line };
                this.globalsVars.push(v); this.dataInit.fill(1, addr - DATA_BASE, addr - DATA_BASE + sizeOf(d.type));
                this.frames[0].scopes[0].set(d.name, v);
                if (d.init) this.initInto(d.type, addr, d.init);
            }
            const main = this.prog.funcs.get('main');
            if (!main || !main.body) throw new CompileError('There is no main() function. A C program starts running at main.', 1);
            const mainCall = this.prog.funcs.get('main') as Func;
            this.frames.length = 0;
            const args: RV[] = mainCall.params.map(p => ({ t: p.type, n: p.type.k === 'int' ? 1 : 0 } as RV));
            this.curLine = main.line;
            this.callUserTop(main, args);
            exitCode = 0;
        } catch (x) {
            if (x instanceof ExitSignal) exitCode = x.code;
            else if (x instanceof WaitSignal) waitLine = x.line;
            else if (x instanceof RuntimeError) {
                if (x.message === '__trunc__') { truncated = true; error = 'Stopped after ' + this.maxSteps + ' steps (is there an infinite loop?).'; }
                else { error = x.message; errorLine = x.line; }
            }
            else throw x;
        }
        if (error && !truncated) {
            const snap = this.snapshot();
            const f = this.frames[this.frames.length - 1];
            this.steps.push({ n: this.steps.length + 1, kind: 'error', line: errorLine || this.curLine, depth: this.frames.length, title: 'Runtime error', html: '<b class="bad">The program crashed.</b> ' + esc(error), formula: [], snap, outLen: this.out.length, error: true });
            void f;
        } else if (waitLine) {
            this.steps.push({ n: this.steps.length + 1, kind: 'wait', line: waitLine, depth: this.frames.length, title: 'Waiting for input', html: 'Line ' + waitLine + ' needs input, and none is left. <b>Type it in the Output panel</b> and press Enter: the program carries on from here.', formula: [], snap: this.snapshot(), outLen: this.out.length });
        } else if (!error) {
            this.steps.push({ n: this.steps.length + 1, kind: 'end', line: this.prog.funcs.get('main')?.endLine || 0, depth: 0, title: 'Program ends', html: 'The program finished' + (exitCode ? ' with exit code ' + exitCode : ' normally') + '. ' + (this.blocks.some(b => !b.freed) ? 'Some heap memory was never freed (a <b>memory leak</b>): ' + this.blocks.filter(b => !b.freed).map(b => hex(b.addr)).join(', ') + '.' : 'All heap memory was freed.'), formula: [], snap: this.snapshot(), outLen: this.out.length });
        }
        return { steps: this.steps, output: this.out, error, errorLine, exitCode, truncated, waiting: waitLine > 0 };
    }
    callUserTop(f: Func, args: RV[]): void {
        // call main with a first "start" step
        const e: E = { k: 'call', pos: 0, end: 0, line: f.line, f: { k: 'id', name: f.name, pos: 0, end: 0, line: f.line }, args: [] };
        this.callUser(f, args, e);
    }
}

export interface CompileResult { ok: boolean; message?: string; line?: number; col?: number; prog?: Program }
export function compile(src: string): CompileResult {
    try { return { ok: true, prog: parse(src) }; }
    catch (e) { if (e instanceof CompileError) return { ok: false, message: e.message, line: e.line, col: e.col }; throw e; }
}
export function runC(src: string, opts: RunOptions = {}): { compile: CompileResult; trace?: Trace } {
    const c = compile(src);
    if (!c.ok || !c.prog) return { compile: c };
    const m = new Machine(c.prog, opts);
    return { compile: c, trace: m.run() };
}
