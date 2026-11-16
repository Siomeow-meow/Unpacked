/* The test cases of every practice. A practice program reads its values with scanf, so one program can be run on several inputs:
   every input is one test case, and the expected output is what the complete (solution) program prints for it.
     both     : edits made to the starter AND to the solution (they read the input; they sit outside the parts to write);
     solution : edits made to the solution only (the part the learner writes now uses the values that were read);
     cases    : the inputs, one per test case (values separated by spaces). The first case is the example of the lesson.
   An edit is [text to find, text to put instead]; it must be found, or the spec throws (so a changed example is noticed at once). */

export interface InputSpec { both?: [string, string][]; solution?: [string, string][]; cases: string[] }

/** the lines of a block of code, each ending with a newline */
const lines = (...l: string[]) => l.join('\n') + '\n';
/** reads the first value of the list n, then n values with scanf and calls "each" for every one (spaces for indent) */
const loop = (ind: string, each: string, tab = '    ') => lines(
    ind + 'int n, v;', ind + 'scanf("%d", &n);', ind + 'for(int i = 0; i < n; i++){', ind + tab + 'scanf("%d", &v);', ind + tab + each, ind + '}');
/** the top of main: the line "int main(){" and the lines that read the values */
const top = (...read: string[]) => ['int main(){\n', lines('int main(){', ...read.map(r => '    ' + r))] as [string, string];
const gone = (line: string): [string, string] => [line + '\n', ''];

export const INPUTS: Record<string, InputSpec> = {
    /* ---------------- Programming 1 ---------------- */
    'hello-world.c': { cases: [''] },
    'hello-syntax.c': { cases: [''] },
    'var-types.c': { cases: [''] },
    'var-assign.c': {
        both: [top('int a;', 'scanf("%d", &a);')], solution: [gone('    int a = 5;')],
        cases: ['5', '10', '-3']
    },
    'op-arith.c': {
        both: [top('int a, b;', 'scanf("%d %d", &a, &b);')], solution: [gone('    int a = 17, b = 5;')],
        cases: ['17 5', '9 2', '100 7', '20 4']
    },
    'op-compare.c': {
        both: [top('int age, hasId;', 'scanf("%d %d", &age, &hasId);')], solution: [gone('    int age = 20;'), gone('    int hasId = 1;')],
        cases: ['20 1', '16 1', '30 0', '18 1', '17 0']
    },
    'if-grade.c': {
        both: [top('int score;', 'scanf("%d", &score);')], solution: [gone('    int score = 78;')],
        cases: ['78', '95', '80', '42']
    },
    'if-max.c': {
        both: [top('int a, b, c;', 'scanf("%d %d %d", &a, &b, &c);')], solution: [gone('    int a = 12, b = 31, c = 7;')],
        cases: ['12 31 7', '50 8 20', '3 4 90', '6 6 2']
    },
    'loop-for.c': {
        both: [top('int n;', 'scanf("%d", &n);')], solution: [['i <= 5', 'i <= n']],
        cases: ['5', '1', '8', '0']
    },
    'loop-while.c': {
        both: [top('int start, value;', 'scanf("%d %d", &start, &value);')],
        solution: [['int n = 3;', 'int n = start;'], ['int num = 4096;', 'int num = value;'], ['printf("4096 has %d digits\\n", digits);', 'printf("%d has %d digits\\n", value, digits);']],
        cases: ['3 4096', '5 7', '2 123456', '0 0']
    },
    'array-basic.c': {
        both: [top('int scores[5];', 'for(int i = 0; i < 5; i++){', '    scanf("%d", &scores[i]);', '}')], solution: [gone('    int scores[5] = {70, 85, 60, 95, 80};')],
        cases: ['70 85 60 95 80', '10 20 30 40 50', '5 5 5 5 5', '99 1 50 75 25']
    },
    'string-basic.c': {
        both: [top('char word[8];', 'scanf("%s", word);')], solution: [gone('    char word[8] = "stack";')],
        cases: ['stack', 'queue', 'c', 'pointer']
    },
    'func-basic.c': {
        both: [['    int s = square(6);\n    int m = bigger(s, 30);\n', lines('    int x, y;', '    scanf("%d %d", &x, &y);', '    int s = square(x);', '    int m = bigger(s, y);')]],
        cases: ['6 30', '3 20', '10 5', '0 0']
    },
    'func-by-value.c': {
        both: [['    int n = 5;\n', lines('    int n;', '    scanf("%d", &n);')]],
        cases: ['5', '100', '-4']
    },
    'ptr-basic.c': {
        both: [top('int x, y;', 'scanf("%d %d", &x, &y);')],
        solution: [gone('    int x = 10;'), ['*p = 25;', '*p = y;'], ['printf("after *p = 25: x=%d\\n", x);', 'printf("after *p = %d: x=%d\\n", y, x);']],
        cases: ['10 25', '1 2', '-5 8']
    },
    'ptr-swap.c': {
        both: [['    int x = 3, y = 8;\n', lines('    int x, y;', '    scanf("%d %d", &x, &y);')]],
        cases: ['3 8', '10 -2', '7 7', '0 1']
    },
    /* ---------------- Programming 2 ---------------- */
    'ptrarr-arithmetic.c': {
        both: [['    int a[4] = {10, 20, 30, 40};\n', lines('    int a[4];', '    for(int i = 0; i < 4; i++){', '        scanf("%d", &a[i]);', '    }')]],
        cases: ['10 20 30 40', '7 14 21 28', '-1 0 1 2']
    },
    'ptrarr-function.c': {
        both: [['    int a[3] = {1, 2, 3};\n', lines('    int a[3];', '    for(int i = 0; i < 3; i++){', '        scanf("%d", &a[i]);', '    }')]],
        cases: ['1 2 3', '10 20 30', '-5 5 0']
    },
    'rec-factorial.c': {
        both: [['    int r = factorial(4);\n    printf("4! = %d\\n", r);\n', lines('    int n;', '    scanf("%d", &n);', '    int r = factorial(n);', '    printf("%d! = %d\\n", n, r);')]],
        cases: ['4', '0', '1', '5', '7']
    },
    'rec-fibonacci.c': {
        both: [['    printf("fib(4) = %d\\n", fib(4));\n', lines('    int n;', '    scanf("%d", &n);', '    printf("fib(%d) = %d\\n", n, fib(n));')]],
        cases: ['4', '0', '10']
    },
    'rec-hanoi.c': {
        both: [["    hanoi(3, 'A', 'C', 'B');\n", lines('    int n;', '    scanf("%d", &n);', "    hanoi(n, 'A', 'C', 'B');")]],
        cases: ['3', '1', '2', '0']
    },
    'sort-bubble.c': {
        both: [['    int a[5] = {5, 2, 4, 1, 3};\n    bubbleSort(a, 5);\n    for(int i = 0; i < 5; i++){\n',
            lines('    int n;', '    scanf("%d", &n);', '    int a[10];', '    for(int i = 0; i < n; i++){', '        scanf("%d", &a[i]);', '    }', '    bubbleSort(a, n);', '    for(int i = 0; i < n; i++){')]],
        cases: ['5 5 2 4 1 3', '1 7', '4 9 8 7 6', '6 1 2 3 4 5 6', '3 2 2 1']
    },
    'sort-insertion.c': {
        both: [['    int a[5] = {9, 4, 7, 1, 6};\n    insertionSort(a, 5);\n    for(int i = 0; i < 5; i++){\n',
            lines('    int n;', '    scanf("%d", &n);', '    int a[10];', '    for(int i = 0; i < n; i++){', '        scanf("%d", &a[i]);', '    }', '    insertionSort(a, n);', '    for(int i = 0; i < n; i++){')]],
        cases: ['5 9 4 7 1 6', '3 3 2 1', '1 42', '6 10 -1 8 0 5 5']
    },
    'search-binary.c': {
        both: [['    int a[7] = {3, 8, 12, 17, 25, 31, 40};\n    printf("25 is at index %d\\n", binarySearch(a, 7, 25));\n    printf("10 is at index %d\\n", binarySearch(a, 7, 10));\n',
            lines('    int n, t1, t2;', '    scanf("%d", &n);', '    int a[20];', '    for(int i = 0; i < n; i++){', '        scanf("%d", &a[i]);', '    }', '    scanf("%d %d", &t1, &t2);',
                '    printf("%d is at index %d\\n", t1, binarySearch(a, n, t1));', '    printf("%d is at index %d\\n", t2, binarySearch(a, n, t2));')]],
        cases: ['7 3 8 12 17 25 31 40 25 10', '7 3 8 12 17 25 31 40 3 40', '7 3 8 12 17 25 31 40 17 18', '1 5 5 6', '3 1 2 3 2 9']
    },
    'struct-basic.c': {
        both: [['int main(){\n', lines('int main(){', '    Student s;', '    scanf("%d %s %f", &s.id, s.name, &s.gpa);', '    Student list[2];', '    for(int i = 0; i < 2; i++){', '        scanf("%d %s %f", &list[i].id, list[i].name, &list[i].gpa);', '    }')]],
        solution: [gone('    Student s = {7, "Ana", 3.5};'), gone('    Student list[2] = {{1, "Ben", 2.8}, {2, "Cy", 3.9}};')],
        cases: ['7 Ana 3.5 1 Ben 2.8 2 Cy 3.9', '10 Dee 1.5 3 Eli 4.0 4 Fay 3.2']
    },
    'struct-pointer.c': {
        both: [['    Point a = {1, 2};\n', lines('    Point a;', '    scanf("%d %d", &a.x, &a.y);')]],
        cases: ['1 2', '10 0', '-3 4']
    },
    'dyn-malloc.c': {
        both: [top('int n;', 'scanf("%d", &n);')], solution: [gone('    int n = 4;'), ['a[i] = (i + 1) * 10;', 'scanf("%d", &a[i]);']],
        cases: ['4 10 20 30 40', '1 7', '3 -1 -2 -3', '5 1 2 3 4 5']
    },
    'dyn-realloc.c': {
        both: [top('int v1, v2, v3, v4;', 'scanf("%d %d %d %d", &v1, &v2, &v3, &v4);')],
        solution: [['a[0] = 5;', 'a[0] = v1;'], ['a[1] = 6;', 'a[1] = v2;'], ['a[2] = 7;', 'a[2] = v3;'], ['a[3] = 8;', 'a[3] = v4;']],
        cases: ['5 6 7 8', '1 2 3 4', '0 -1 -2 -3']
    },
    'dyn-bug-use-after-free.c': {
        both: [['    *p = 42;\n', '    scanf("%d", p);\n']],
        cases: ['42', '7', '-1']
    },
    'file-write-read.c': {
        both: [top('char w1[20], w2[20], w3[20];', 'scanf("%s %s %s", w1, w2, w3);')],
        solution: [['fprintf(fp, "apple\\n");', 'fprintf(fp, "%s\\n", w1);'], ['fprintf(fp, "banana\\n");', 'fprintf(fp, "%s\\n", w2);'], ['fputs("cherry\\n", fp);', 'fprintf(fp, "%s\\n", w3);']],
        cases: ['apple banana cherry', 'red green blue', 'x y z']
    },
    'file-numbers.c': {
        both: [top('int n, step;', 'scanf("%d %d", &n, &step);')],
        solution: [['i <= 5', 'i <= n'], ['i * 10', 'i * step']],
        cases: ['5 10', '3 7', '1 100', '4 -2']
    },
    'file-append-count.c': {
        both: [top('int k;', 'scanf("%d", &k);')],
        solution: [['    fputs("second\\n", fp);\n    fputs("third\\n", fp);\n', lines('    for(int i = 0; i < k; i++){', '        fputs("more\\n", fp);', '    }')]],
        cases: ['2', '0', '5', '1']
    },
    'file-bug-null.c': {
        both: [['    FILE *fp = fopen("missing.txt", "r");\n', lines('    char name[20];', '    scanf("%s", name);', '    FILE *fp = fopen(name, "r");')]],
        solution: [['printf("could not open missing.txt\\n");', 'printf("could not open %s\\n", name);']],
        cases: ['missing.txt', 'data.txt', 'scores.csv']
    },
    'adt-arraylist-pointer.c': {
        both: [['    List *L = initialize();\n', lines('    List *L = initialize();', '    int a, b, c;', '    scanf("%d %d %d", &a, &b, &c);')],
            ['insertPos(L, 10, 0);', 'insertPos(L, a, 0);'], ['insertPos(L, 30, 1);', 'insertPos(L, c, 1);'], ['insertPos(L, 20, 1);', 'insertPos(L, b, 1);'],
            ['printf("30 is at index %d\\n", locate(L, 30));', 'printf("%d is at index %d\\n", c, locate(L, c));']],
        cases: ['10 20 30', '5 6 7', '4 9 1']
    },
    'adt-arraylist-value.c': {
        both: [['\tList L;\n', lines('\tList L;', '\tint ins, at, del, find;', '\tscanf("%d %d %d %d", &ins, &at, &del, &find);')],
            ['insertPos(L, 4, 2)', 'insertPos(L, ins, at)'], ['deletePos(L, 1)', 'deletePos(L, del)'], ['locate(L, 5)', 'locate(L, find)']],
        cases: ['4 2 1 5', '9 0 3 2', '7 4 0 10']
    },
    'adt-students-resize.c': {
        both: [['    initialize(&myList);\n', lines('    initialize(&myList);', '    int ipos, dpos, id, rpos;', '    scanf("%d %d %d %d", &ipos, &dpos, &id, &rpos);')],
            ['printf("Inserting at position 0...\\n");', 'printf("Inserting at position %d...\\n", ipos);'], ['insertPos(&myList, s6, 0);', 'insertPos(&myList, s6, ipos);'],
            ['printf("Deleting at position 2...\\n");', 'printf("Deleting at position %d...\\n", dpos);'], ['deletePos(&myList, 2);', 'deletePos(&myList, dpos);'],
            ['printf("Locating student with ID 103...\\n");', 'printf("Locating student with ID %d...\\n", id);'], ['locate(&myList, 103);', 'locate(&myList, id);'],
            ['printf("Retrieving student at position 3...\\n");', 'printf("Retrieving student at position %d...\\n", rpos);'], ['retrieve(&myList, 3)', 'retrieve(&myList, rpos)']],
        cases: ['0 2 103 3', '2 0 102 1', '1 1 999 0']
    },
    'adt-bug-unset-pointer.c': {
        both: [['\tEptr L;\n', lines('\tEptr L;', '\tint val, pos;', '\tscanf("%d %d", &val, &pos);')], ['insertPos(L, 4, 2);', 'insertPos(L, val, pos);']],
        cases: ['4 2', '9 1', '7 4']
    },
    'adt-bug-discarded-init.c': { cases: [''] },
    'll-insert.c': {
        both: [['    head = insertFront(head, 30);\n    head = insertFront(head, 20);\n    head = insertFront(head, 10);\n', loop('    ', 'head = insertFront(head, v);')]],
        cases: ['3 30 20 10', '1 5', '0', '5 1 2 3 4 5']
    },
    'll-search-delete.c': {
        both: [['    head = insertFront(head, 30);\n    head = insertFront(head, 20);\n    head = insertFront(head, 10);\n', lines('    int n, v, t;', '    scanf("%d", &n);', '    for(int i = 0; i < n; i++){', '        scanf("%d", &v);', '        head = insertFront(head, v);', '    }', '    scanf("%d", &t);')],
            ['printf("20 is at position %d\\n", search(head, 20));', 'printf("%d is at position %d\\n", t, search(head, t));'], ['removeValue(head, 20)', 'removeValue(head, t)'],
            ['printf("20 is now at position %d\\n", search(head, 20));', 'printf("%d is now at position %d\\n", t, search(head, t));']],
        cases: ['3 30 20 10 20', '3 30 20 10 10', '3 30 20 10 99', '1 5 5']
    },
    'll-reverse.c': {
        both: [['    head = insertFront(head, 3);\n    head = insertFront(head, 2);\n    head = insertFront(head, 1);\n', loop('    ', 'head = insertFront(head, v);')]],
        cases: ['3 3 2 1', '1 7', '4 8 6 4 2', '2 5 9']
    },
    /* ---------------- Data Structures & Algorithms ---------------- */
    'stack-array-malloc.c': {
        both: [['\tpush(stack, 10);\n\tpush(stack, 20);\n\tpush(stack, 30);\n', loop('\t', 'push(stack, v);', '\t')]],
        cases: ['3 10 20 30', '1 99', '0', '5 1 2 3 4 5', '11 1 2 3 4 5 6 7 8 9 10 11']
    },
    'stack-linkedlist.c': {
        both: [['    push(&top, 10);\n    push(&top, 20);\n    push(&top, 30);\n', loop('    ', 'push(&top, v);')]],
        cases: ['3 10 20 30', '5 1 2 3 4 5', '4 7 8 9 10']
    },
    'queue-circular.c': {
        both: [['\tenqueue(queue, 1);\n\tenqueue(queue, 3);\n\tenqueue(queue, 2);\n\tenqueue(queue, 5);\n', loop('\t', 'enqueue(queue, v);', '\t')],
            ['\tenqueue(queue, 4);\n', lines('\tscanf("%d", &v);', '\tenqueue(queue, v);')]],
        cases: ['4 1 3 2 5 4', '1 7 8', '9 1 2 3 4 5 6 7 8 9 10', '10 1 2 3 4 5 6 7 8 9 10 11']
    },
    'queue-circular-gap.c': {
        both: [['\tenqueue(q, 10);\n\tenqueue(q, 20);\n\tenqueue(q, 30);\n\tenqueue(q, 40);\n\tenqueue(q, 50);\n', loop('\t', 'enqueue(q, v);', '\t')]],
        cases: ['5 10 20 30 40 50', '3 1 2 3', '2 7 8', '7 1 2 3 4 5 6 7']
    },
    'queue-linkedlist.c': {
        both: [['    q.rear = NULL;\n', lines('    q.rear = NULL;', '    int a, b, c, d;', '    scanf("%d %d %d %d", &a, &b, &c, &d);')],
            ['enqueue(&q, 1);', 'enqueue(&q, a);'], ['enqueue(&q, 2);', 'enqueue(&q, b);'], ['enqueue(&q, 3);', 'enqueue(&q, c);'], ['enqueue(&q, 4);', 'enqueue(&q, d);']],
        cases: ['1 2 3 4', '10 20 30 40', '7 7 8 8']
    },
    'cursor-basic.c': {
        both: [['    initialize(&V);\n', lines('    initialize(&V);', '    int a, b, c, d;', '    scanf("%d %d %d %d", &a, &b, &c, &d);')],
            ['insertFirst(&L, &V, 30);', 'insertFirst(&L, &V, a);'], ['insertFirst(&L, &V, 20);', 'insertFirst(&L, &V, b);'], ['insertFirst(&L, &V, 10);', 'insertFirst(&L, &V, c);'], ['insertFirst(&L, &V, 99);', 'insertFirst(&L, &V, d);']],
        cases: ['30 20 10 99', '1 2 3 4', '50 40 30 20']
    },
    'cursor-vheap.c': {
        both: [['    initialize(&V);\n', lines('    initialize(&V);', '    int a, b, c, y, z;', '    scanf("%d %d %d %d %d", &a, &b, &c, &y, &z);')],
            ['insertFirst(&L, &V, 5);', 'insertFirst(&L, &V, a);'], ['insertFirst(&L, &V, 10);', 'insertFirst(&L, &V, b);'], ['insertLast(&L, &V, 15);', 'insertLast(&L, &V, c);'],
            ['deleteElem(&L, &V, 10);', 'deleteElem(&L, &V, b);'], ['insertFirst(&L, &V, 25);', 'insertFirst(&L, &V, y);'], ['insertFirst(&L, &V, 30);', 'insertFirst(&L, &V, z);']],
        cases: ['5 10 15 25 30', '1 2 3 4 5', '7 8 9 1 2']
    },
    'set-bitvector.c': {
        both: [['    Set B = 0;\n', lines('    Set B = 0;', '    int a1, a2, a3, b1, b2, b3, r;', '    scanf("%d %d %d %d %d %d %d", &a1, &a2, &a3, &b1, &b2, &b3, &r);')],
            ['A = add(A, 1);', 'A = add(A, a1);'], ['A = add(A, 3);', 'A = add(A, a2);'], ['A = add(A, 5);', 'A = add(A, a3);'],
            ['B = add(B, 3);', 'B = add(B, b1);'], ['B = add(B, 4);', 'B = add(B, b2);'], ['B = add(B, 5);', 'B = add(B, b3);'], ['A = removeElem(A, 3);', 'A = removeElem(A, r);']],
        cases: ['1 3 5 3 4 5 3', '0 2 4 1 2 3 2', '7 6 5 7 6 4 6']
    },
    'set-array.c': {
        both: [['    Set B = emptySet();\n', lines('    Set B = emptySet();', '    int a1, a2, b1, b2;', '    scanf("%d %d %d %d", &a1, &a2, &b1, &b2);')],
            ['add(&A, 1);', 'add(&A, a1);'], ['add(&A, 2);', 'add(&A, a2);'], ['add(&B, 2);', 'add(&B, b1);'], ['add(&B, 6);', 'add(&B, b2);']],
        cases: ['1 2 2 6', '0 3 4 5', '7 0 7 1']
    },
    'hash-open.c': {
        both: [['    insert(table, 12);\n    insert(table, 7);\n    insert(table, 22);\n    insert(table, 3);\n', lines('    int n, k, q1, q2;', '    scanf("%d", &n);', '    for(int i = 0; i < n; i++){', '        scanf("%d", &k);', '        insert(table, k);', '    }', '    scanf("%d %d", &q1, &q2);')],
            ['printf("22 found? %d\\n", search(table, 22));', 'printf("%d found? %d\\n", q1, search(table, q1));'], ['printf("17 found? %d\\n", search(table, 17));', 'printf("%d found? %d\\n", q2, search(table, q2));']],
        cases: ['4 12 7 22 3 22 17', '3 5 10 15 10 20', '0 1 2', '6 1 2 3 4 5 6 6 7']
    },
    'hash-closed.c': {
        both: [['    insert(15);\n    insert(22);\n    insert(8);\n    insert(5);\n', lines('    int n, k, q1, q2;', '    scanf("%d", &n);', '    for(int i = 0; i < n; i++){', '        scanf("%d", &k);', '        insert(k);', '    }', '    scanf("%d %d", &q1, &q2);')],
            ['printf("22 is in slot %d\\n", search(22));', 'printf("%d is in slot %d\\n", q1, search(q1));'], ['printf("30 is in slot %d\\n", search(30));', 'printf("%d is in slot %d\\n", q2, search(q2));']],
        cases: ['4 15 22 8 5 22 30', '3 7 14 21 14 5', '7 1 2 3 4 5 6 7 7 9']
    },
    'dict-array.c': {
        both: [['    D.count = 0;\n', lines('    D.count = 0;', '    char n1[10], n2[10], n3[10], n4[10];', '    int k;', '    scanf("%s %s %s %s %d", n1, n2, n3, n4, &k);')],
            ['insert(&D, 101, "Ana");', 'insert(&D, 101, n1);'], ['insert(&D, 205, "Ben");', 'insert(&D, 205, n2);'], ['insert(&D, 307, "Cy");', 'insert(&D, 307, n3);'],
            ['insert(&D, 205, "Benito");', 'insert(&D, 205, n4);'], ['removeKey(&D, 101);', 'removeKey(&D, k);'], ['v = lookup(&D, 101);', 'v = lookup(&D, k);'],
            ['printf("101 -> %s\\n", v ? v : "not found");', 'printf("%d -> %s\\n", k, v ? v : "not found");']],
        cases: ['Ana Ben Cy Benito 101', 'Zed Yan Xi Wu 307', 'a b c d 999']
    },
    'dict-sorted.c': {
        both: [['    insert(&D, 40);\n    insert(&D, 10);\n    insert(&D, 30);\n    insert(&D, 20);\n    insert(&D, 50);\n', lines('    int n, k, q1, q2;', '    scanf("%d", &n);', '    for(int i = 0; i < n; i++){', '        scanf("%d", &k);', '        insert(&D, k);', '    }', '    scanf("%d %d", &q1, &q2);')],
            ['printf("30 is at index %d\\n", search(&D, 30));', 'printf("%d is at index %d\\n", q1, search(&D, q1));'], ['printf("35 is at index %d\\n", search(&D, 35));', 'printf("%d is at index %d\\n", q2, search(&D, q2));']],
        cases: ['5 40 10 30 20 50 30 35', '3 9 1 5 1 6', '1 42 42 0', '8 8 7 6 5 4 3 2 1 8 100']
    },
    'tree-bst.c': {
        both: [['    root = insert(root, 50);\n    root = insert(root, 30);\n    root = insert(root, 70);\n    root = insert(root, 20);\n    root = insert(root, 40);\n', lines('    int n, k, q1, q2;', '    scanf("%d", &n);', '    for(int i = 0; i < n; i++){', '        scanf("%d", &k);', '        root = insert(root, k);', '    }', '    scanf("%d %d", &q1, &q2);')],
            ['printf("40 found? %d\\n", search(root, 40));', 'printf("%d found? %d\\n", q1, search(root, q1));'], ['printf("65 found? %d\\n", search(root, 65));', 'printf("%d found? %d\\n", q2, search(root, q2));']],
        cases: ['5 50 30 70 20 40 40 65', '1 5 5 6', '7 8 3 10 1 6 14 4 6 5']
    },
    'tree-traversals.c': {
        both: [['    Node *root = newNode(\'A\', newNode(\'B\', newNode(\'D\', NULL, NULL), newNode(\'E\', NULL, NULL)), newNode(\'C\', NULL, NULL));\n',
            lines('    char a, b, c, d, e;', '    scanf(" %c %c %c %c %c", &a, &b, &c, &d, &e);', '    Node *root = newNode(a, newNode(b, newNode(d, NULL, NULL), newNode(e, NULL, NULL)), newNode(c, NULL, NULL));')]],
        cases: ['A B C D E', 'P Q R S T', 'x y z p q']
    },
    'heap-insert.c': {
        both: [['    insert(50);\n    insert(30);\n    insert(40);\n    insert(10);\n    insert(20);\n', lines('    int n, v;', '    scanf("%d", &n);', '    for(int i = 0; i < n; i++){', '        scanf("%d", &v);', '        insert(v);', '    }')]],
        cases: ['5 50 30 40 10 20', '3 3 2 1', '1 7', '10 10 9 8 7 6 5 4 3 2 1']
    },
    'heap-extract.c': {
        both: [['    insert(50);\n    insert(30);\n    insert(40);\n    insert(10);\n    insert(20);\n', lines('    int n, v;', '    scanf("%d", &n);', '    for(int i = 0; i < n; i++){', '        scanf("%d", &v);', '        insert(v);', '    }')]],
        cases: ['5 50 30 40 10 20', '4 9 8 7 6', '1 1', '8 5 3 8 1 9 2 7 4']
    },
    'graph-matrix-dfs.c': {
        both: [['    addEdge(0, 1);\n    addEdge(0, 2);\n    addEdge(1, 3);\n    addEdge(2, 4);\n', lines('    int m, a, b, s;', '    scanf("%d", &m);', '    for(int i = 0; i < m; i++){', '        scanf("%d %d", &a, &b);', '        addEdge(a, b);', '    }', '    scanf("%d", &s);')], ['dfs(0);', 'dfs(s);']],
        cases: ['4 0 1 0 2 1 3 2 4 0', '2 0 1 3 4 3', '3 0 1 1 2 2 0 1', '0 2', '1 4 0 4']
    },
    'graph-bfs.c': {
        both: [['    addEdge(0, 1);\n    addEdge(0, 2);\n    addEdge(1, 3);\n    addEdge(2, 4);\n    addEdge(3, 5);\n    addEdge(4, 5);\n', lines('    int m, a, b, s;', '    scanf("%d", &m);', '    for(int i = 0; i < m; i++){', '        scanf("%d %d", &a, &b);', '        addEdge(a, b);', '    }', '    scanf("%d", &s);')], ['bfs(0);', 'bfs(s);']],
        cases: ['6 0 1 0 2 1 3 2 4 3 5 4 5 0', '3 0 1 1 2 2 3 3', '2 5 4 4 0 5', '0 3']
    },
    'graph-adjlist.c': {
        both: [['    addEdge(0, 1);\n    addEdge(0, 2);\n    addEdge(1, 3);\n    addEdge(2, 3);\n', lines('    int m, a, b;', '    scanf("%d", &m);', '    for(int i = 0; i < m; i++){', '        scanf("%d %d", &a, &b);', '        addEdge(a, b);', '    }')]],
        cases: ['4 0 1 0 2 1 3 2 3', '2 3 0 1 2', '0', '3 0 1 1 2 2 3']
    }
};

/** applies edits to a program; throws when a text to find is not there (so a changed example is noticed) */
export function applyEdits(id: string, src: string, edits: [string, string][] | undefined): string {
    let s = src;
    for (const [find, repl] of edits ?? []) {
        if (!s.includes(find)) throw new Error('practiceTests: the edit for ' + id + ' does not match the code: ' + JSON.stringify(find.slice(0, 60)));
        s = s.split(find).join(repl);
    }
    return s;
}
