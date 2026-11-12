/* How each lesson example becomes a practice. The example is the SOLUTION. The practice shows it with the main parts taken out, for the
   learner to write:
     - a block of lines (in main, or a loop) is replaced by a "// TODO" comment saying what to write;
     - a whole function ("fn") keeps its header and braces, with a TODO comment inside: the learner writes the function body.
   A "bug" example is the other way round: it is given as it is (it crashes) and the solution is the same program with the bug fixed. */

/** [first line, last line, what to write, 'fn' when those lines are one whole function] */
export type Blank = [number, number, string] | [number, number, string, 'fn'];

export const BLANKS: Record<string, Blank[]> = {
    /* ---------------- Programming 1: write the body of main (or a whole loop) ---------------- */
    'hello-world.c': [[4, 5, 'print the two lines shown in the expected output, one printf for each']],
    'hello-syntax.c': [[6, 8, 'print the three lines shown in the expected output: use \\t for the tab, \\" for a quote and \\\\ for one backslash']],
    'var-types.c': [[4, 9, 'declare an int (19), a float (2.5), a char (A) and a double (3.14159), print them, then print the size of an int and of a char with sizeof']],
    'var-assign.c': [[4, 8, 'a starts at 5, b is a copy of a, then add 1 to a, total is a + b; print a, b and total']],
    'op-arith.c': [[4, 11, 'with a = 17 and b = 5 print the sum, difference, product, quotient and remainder, then divide as floats (cast one side) and print it with 2 decimals']],
    'op-compare.c': [[4, 12, 'age 20 and hasId 1: work out adult (age >= 18), canEnter (adult && hasId) and child (!adult); x starts at 5, add 3, then 1 more; print all four']],
    'if-grade.c': [[4, 15, 'score is 78: choose the grade letter with if / else if / else (90 A, 80 B, 70 C, otherwise F) and print it']],
    'if-max.c': [[4, 16, 'find the largest of 12, 31 and 7 with if statements, then print whether the largest is even or odd']],
    'loop-for.c': [[4, 9, 'with a for loop add 1, 2, 3, 4 and 5 into sum, print every round, then print the total']],
    'loop-while.c': [[4, 16, 'count down 3, 2, 1 with a while loop and print liftoff; then count the digits of 4096 with a do ... while loop']],
    'array-basic.c': [[4, 13, 'store the five scores in an array, loop over it to find the sum and the largest, then print the sum, the max and the average']],
    'string-basic.c': [[5, 14, 'store "stack" in a char array, count its letters with a loop (stop at the \\0), print them, then print the word backwards']],
    'func-basic.c': [[3, 5, 'square(x): return x times x', 'fn'], [7, 12, 'bigger(a, b): return the larger of the two numbers', 'fn']],
    'func-by-value.c': [[3, 6, 'addTen(x): add 10 to x and print "inside addTen: x=..."', 'fn']],
    'ptr-basic.c': [[4, 8, 'x is 10: make a pointer p to x, print x and *p, change x to 25 through p, and print x again']],
    'ptr-swap.c': [[3, 7, 'swap(a, b): swap the two ints the pointers point at, using a temporary variable', 'fn']],
    /* ---------------- Programming 2: write whole functions ---------------- */
    'ptrarr-arithmetic.c': [[5, 12, 'point p at the array, print *p and *(p + 2), move p with p++ and print *p, then print every element with a second pointer that walks up to a + 4']],
    'ptrarr-function.c': [[3, 9, 'sum(arr, n): return the sum of the first n elements', 'fn'], [11, 15, 'doubleAll(arr, n): double every one of the first n elements', 'fn']],
    'rec-factorial.c': [[3, 8, 'factorial(n): return 1 when n <= 1, otherwise n times factorial(n - 1)', 'fn']],
    'rec-fibonacci.c': [[3, 8, 'fib(n): return n when n < 2, otherwise the sum of the two previous Fibonacci numbers', 'fn']],
    'rec-hanoi.c': [[3, 10, 'hanoi(n, from, to, via): do nothing when n is 0; otherwise move n - 1 disks out of the way, print "move disk n from X to Y", then move the n - 1 disks on top of it', 'fn']],
    'sort-bubble.c': [[9, 17, 'bubbleSort(arr, n): repeatedly compare neighbours and swap the ones that are out of order (use swap)', 'fn']],
    'sort-insertion.c': [[3, 13, 'insertionSort(arr, n): take each element as key and shift the bigger elements on its left one place right, then drop key in the gap', 'fn']],
    'search-binary.c': [[3, 17, 'binarySearch(arr, n, target): keep low and high, look at the middle, and halve the range; return the index, or -1 when it is not found', 'fn']],
    'struct-basic.c': [[10, 15, 'create the student {7, "Ana", 3.5} and print it, then an array of two students ({1, "Ben", 2.8}, {2, "Cy", 3.9}) and print each in a loop']],
    'struct-pointer.c': [[8, 10, 'moveCopy(p): add 5 to p.x (p is a copy)', 'fn'], [12, 14, 'movePtr(p): add 5 to the x of the struct that p points at', 'fn']],
    'dyn-malloc.c': [[5, 15, 'reserve 4 ints with malloc, store 10, 20, 30, 40 in them, add them up, print the sum and free the block']],
    'dyn-realloc.c': [[5, 15, 'calloc 2 ints and store 5 and 6, grow the block to 4 ints with realloc, store 7 and 8, print them all and free the block']],
    'file-write-read.c': [[4, 12, 'open notes.txt for writing (check for NULL), write the lines apple, banana and cherry, then close it'], [15, 19, 'open notes.txt for reading, print every line as "read: ..." with fgets, then close it']],
    'file-numbers.c': [[4, 9, 'open scores.txt for writing and write 10, 20, 30, 40 and 50, one per line, then close it'], [11, 18, 'open scores.txt for reading, add up every number with fscanf, close it and print "sum = ..."']],
    'file-append-count.c': [[8, 11, 'open log.txt for appending, add the lines second and third, then close it'], [13, 22, 'open log.txt for reading, count the lines (newline characters) with fgetc, close it and print "log.txt has N lines"']],
    'adt-arraylist-pointer.c': [[17, 26, 'insertPos(L, data, pos): do nothing when the list is full or pos is out of range; otherwise shift the later items right, store data and count it', 'fn'], [28, 36, 'deletePos(L, pos): do nothing when pos is out of range; otherwise shift the later items left and lower the count', 'fn'], [38, 45, 'locate(L, data): return the index of data, or -1', 'fn']],
    'adt-arraylist-value.c': [[17, 29, 'insertPos(L, data, position): shift the elements from position to the right (memcpy), store data, count it and return the changed copy', 'fn'], [31, 41, 'deletePos(L, position): shift the later elements left (memcpy), lower the count and return the changed copy', 'fn'], [43, 53, 'locate(L, data): return the index of data, or -1', 'fn']],
    'adt-students-resize.c': [[42, 62, 'insertPos(L, elem, pos): reject a bad position, resize when the list is full, shift the later elements right, store elem and count it', 'fn'], [65, 78, 'deletePos(L, pos): reject a bad position, shift the later elements left and lower the count', 'fn'], [128, 140, 'resize(L): double the size with realloc and update L->elemPtr and L->max', 'fn']],
    'll-insert.c': [[9, 14, 'insertFront(head, value): make a new node, store value, point it at the old head and return it as the new head', 'fn'], [16, 21, 'print(head): print every value followed by " -> ", then NULL', 'fn']],
    'll-search-delete.c': [[16, 25, 'search(head, value): return the position of value in the list, or -1', 'fn'], [27, 44, 'removeValue(head, value): find the node, unlink it (handle the head separately), free it and return the head', 'fn']],
    'll-reverse.c': [[16, 25, 'reverse(head): turn every next pointer around, one node at a time, and return the new head', 'fn']],
    /* ---------------- Data Structures & Algorithms ---------------- */
    'stack-array-malloc.c': [[29, 37, 'push(s, value): when the stack is not full raise top and store value there; otherwise print "Stack Overflow"', 'fn'], [39, 48, 'pop(s): when the stack is not empty lower top; otherwise print "Stack Underflow"; return the popped item', 'fn'], [50, 58, 'peek(s): return the top item, or print "Stack is empty" and return -1', 'fn']],
    'stack-linkedlist.c': [[9, 14, 'push(top, x): make a node for x that points at the old top, and make it the new top', 'fn'], [16, 22, 'pop(top): take the data of the top node, make the next node the top, free the old one and return the data', 'fn'], [24, 26, 'peek(top): return the data of the top node', 'fn']],
    'queue-circular.c': [[36, 47, 'enqueue(q, value): do nothing when full; the first item sets front and rear to 0; otherwise move rear on by one (wrapping around with %); store value and count it', 'fn'], [49, 63, 'dequeue(q): take the item at front, move front on by one (wrapping around), lower the count and return the item', 'fn']],
    'queue-linkedlist.c': [[14, 24, 'enqueue(q, x): add a node for x at the rear (the first node is also the front)', 'fn'], [26, 35, 'dequeue(q): take the front node, move front on, clear rear when the queue is empty, free the node and return its data', 'fn']],
    'cursor-basic.c': [[23, 29, 'allocSpace(V): take a free cell from the avail list and return its index (-1 when there is none)', 'fn'], [31, 34, 'freeSpace(V, i): put cell i back at the front of the avail list', 'fn'], [36, 43, 'insertFirst(L, V, x): take a free cell, store x in it and make it the first element of the list', 'fn']],
    'cursor-vheap.c': [[29, 37, 'allocSpace(V): take a free cell from the avail list and return its index (-1 when there is none)', 'fn'], [54, 70, 'insertLast(L, V, elem): take a free cell, store elem in it and link it after the last element', 'fn'], [72, 84, 'deleteElem(L, V, elem): find the cell that holds elem, unlink it and give it back with deallocSpace', 'fn']],
    'set-bitvector.c': [[5, 7, 'add(s, x): return s with bit x switched on', 'fn'], [9, 11, 'removeElem(s, x): return s with bit x switched off', 'fn'], [13, 15, 'contains(s, x): return 1 when bit x is on, otherwise 0', 'fn']],
    'set-array.c': [[10, 16, 'emptySet(): return a set in which no element is a member', 'fn'], [22, 28, 'unionSet(a, b): return the set of elements that are in a or in b', 'fn'], [30, 36, 'intersect(a, b): return the set of elements that are in a and in b', 'fn']],
    'hash-open.c': [[11, 13, 'hash(key): return the slot of the key (key modulo SIZE)', 'fn'], [15, 21, 'insert(table, key): put a node for key at the front of the chain in its slot', 'fn'], [23, 32, 'search(table, key): walk the chain of the key slot; return 1 when found, otherwise 0', 'fn']],
    'hash-closed.c': [[12, 23, 'insert(key): try the slots h, h + 1, h + 2 ... (wrapping around) until one is EMPTY, store the key and print where it went and after how many collisions', 'fn'], [25, 37, 'search(key): probe the same way; return the slot of the key, or -1 at an EMPTY slot or when the table is exhausted', 'fn']],
    'dict-array.c': [[16, 30, 'insert(D, key, value): replace the value of an existing key; otherwise print "Dictionary is full" or add the entry at the end', 'fn'], [32, 39, 'lookup(D, key): return the value of the key, or NULL', 'fn'], [41, 49, 'removeKey(D, key): move the last entry into the removed one and lower the count', 'fn']],
    'dict-sorted.c': [[10, 18, 'insert(D, key): shift the bigger keys one place right and put the key in its sorted place', 'fn'], [20, 34, 'search(D, key): binary search over the sorted keys; return the index, or -1', 'fn']],
    'tree-bst.c': [[18, 28, 'insert(root, data): return a new node when root is NULL; otherwise insert into the left or right subtree and return root', 'fn'], [30, 42, 'search(root, data): walk down, left or right, and return 1 when found, otherwise 0', 'fn'], [44, 51, 'inorder(root): print the left subtree, the node, then the right subtree', 'fn']],
    'tree-traversals.c': [[18, 23, 'preorder(t): print the node, then its left and right subtrees', 'fn'], [25, 30, 'inorder(t): print the left subtree, the node, then the right subtree', 'fn'], [32, 37, 'postorder(t): print the left and right subtrees, then the node', 'fn'], [39, 44, 'height(t): return 0 for an empty tree, otherwise 1 plus the taller of the two subtrees', 'fn']],
    'heap-insert.c': [[6, 10, 'swap(a, b): swap heap[a] and heap[b]', 'fn'], [12, 20, 'insert(value): add value at the end of the heap, then keep swapping it with its parent while it is smaller', 'fn']],
    'heap-extract.c': [[12, 20, 'insert(value): add value at the end of the heap, then keep swapping it with its parent while it is smaller', 'fn'], [22, 36, 'siftDown(i): find the smallest of i and its two children; if it is not i, swap and keep sifting down from there', 'fn'], [38, 44, 'extractMin(): take the root, move the last element to the root, shrink the heap, sift down and return the old root', 'fn']],
    'graph-matrix-dfs.c': [[9, 12, 'addEdge(a, b): mark the edge in both directions of the adjacency matrix', 'fn'], [14, 22, 'dfs(v): mark v visited, print "visit v", then visit every unvisited neighbour the same way', 'fn']],
    'graph-bfs.c': [[9, 12, 'addEdge(a, b): mark the edge in both directions of the adjacency matrix', 'fn'], [14, 32, 'bfs(start): use a queue array with front and rear; visit vertices level by level and mark them visited when they are queued', 'fn']],
    'graph-adjlist.c': [[13, 18, 'addEdge(from, to): put a node for "to" at the front of the list of "from"', 'fn'], [20, 30, 'print(): for every vertex print "v:" and then its neighbours', 'fn']]
};

/** bug examples: the program is given as it is, and the solution is it with these texts replaced everywhere: [find, replace with] */
export const FIXES: Record<string, [string, string][]> = {
    'dyn-bug-use-after-free.c': [['    free(p);\n    printf("%d\\n", *p);', '    printf("%d\\n", *p);\n    free(p);']],
    'file-bug-null.c': [['    FILE *fp = fopen("missing.txt", "r");\n', '    FILE *fp = fopen("missing.txt", "r");\n    if(fp == NULL){\n        printf("could not open missing.txt\\n");\n        return 1;\n    }\n']],
    'adt-bug-unset-pointer.c': [['\tinitialize(L);\n', '\tL = malloc(sizeof(Etype));\n\tinitialize(L);\n']],
    'adt-bug-discarded-init.c': [
        ['\tinitialize(L);\n', '\tL = initialize(L);\n'],
        ['    insertPos(L, ', '    L = insertPos(L, '],
        ['//    display(L);\n//    \n//    deletePos', '    display(L);\n//    \n//    deletePos']
    ]
};

const norm = (s: string) => s.replace(/\r\n/g, '\n');

/* ---------- prototypes: good C declares every function first, then defines it ---------- */
const NOT_A_FUNCTION = new Set(['if', 'for', 'while', 'switch', 'else', 'return', 'do', 'typedef', 'struct', 'enum', 'union', 'sizeof']);
const HEADER = /^[A-Za-z_][\w \t*]*?\b([A-Za-z_]\w*)[ \t]*\([^;{}]*\)[ \t]*\{[ \t]*$/;
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** the lines (0-based) that start a function definition other than main, with the prototype that declares it */
export function functionHeaders(src: string): { line: number; proto: string }[] {
    const out: { line: number; proto: string }[] = [];
    src.split('\n').forEach((ln, i) => {
        const m = HEADER.exec(ln);
        if (!m || m[1] === 'main' || NOT_A_FUNCTION.has(ln.trim().split(/[\s(*]/)[0])) return;
        out.push({ line: i, proto: ln.replace(/[ \t]*\{[ \t]*$/, ';').trim() });
    });
    return out;
}

/** puts a block of prototypes (one for every function except main) before the first function definition, unless the program already has them */
export function withPrototypes(src: string): string {
    const heads = functionHeaders(src);
    if (!heads.length) return src;
    const lines = src.split('\n');
    const have = new Set(lines.filter(l => /\)[ \t]*;[ \t]*$/.test(l) && !/^[ \t]/.test(l)).map(squash));
    const need = heads.filter(h => !have.has(squash(h.proto))).map(h => h.proto);
    if (!need.length) return src;
    lines.splice(heads[0].line, 0, ...need, '');
    return lines.join('\n');
}

/** the full, working program: the lesson example (with the bug fixed, for a bug example), with its prototypes first */
export function solutionOf(id: string, src: string): string {
    let s = norm(src);
    for (const [find, repl] of FIXES[id] ?? []) {
        if (!s.includes(find)) throw new Error('practiceSpec: the fix for ' + id + ' does not match the code');
        s = s.split(find).join(repl);
    }
    return withPrototypes(s);
}

/** a TODO as comment lines that are not too long to read (the first starts with "// ", the others are indented under it) */
function wrap(text: string, indent: string, width = 64): string[] {
    const out: string[] = [];
    let cur = '';
    for (const w of text.split(' ')) {
        if (cur && (cur + ' ' + w).length > width) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) out.push(cur);
    return out.map((l, i) => indent + '// ' + (i ? '      ' : '') + l);
}

/** what the learner starts with: the example with the marked parts taken out (a bug example starts as it is, with its bug); prototypes first */
export function starterOf(id: string, src: string): string {
    const s = norm(src);
    if (FIXES[id]) return withPrototypes(s);
    const blanks = BLANKS[id];
    if (!blanks) throw new Error('practiceSpec: no blank for ' + id);
    const lines = s.split('\n');
    for (const [a, b, what, kind] of [...blanks].sort((x, y) => y[0] - x[0]) as [number, number, string, ('fn' | undefined)?][]) {
        const indent = /^[ \t]*/.exec(lines[a - 1])![0];
        if (kind === 'fn') {
            /* the function keeps its header and its braces; the TODO sits inside, one level in */
            if (!/\{\s*$/.test(lines[a - 1])) throw new Error('practiceSpec: line ' + a + ' of ' + id + ' is not a function header');
            const inner = indent + (indent.includes('\t') ? '\t' : '    ');
            const todo = wrap('TODO: ' + what.replace(/^\w+\([^)]*\):\s*/, ''), inner);
            lines.splice(a - 1, b - a + 1, lines[a - 1], ...todo, indent + '}');
        } else lines.splice(a - 1, b - a + 1, ...wrap('TODO: ' + what, indent));
    }
    return withPrototypes(lines.join('\n'));
}
