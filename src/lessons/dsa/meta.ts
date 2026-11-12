/* The DSA lessons, from the easiest to the hardest (titles and bullets only, so the home and lessons pages stay light). The code and the explanations are in lessons.ts. */
export type DsaSubjectId = 'prog1' | 'prog2' | 'dsa';
export interface DsaMeta { id: string; title: string; subject: DsaSubjectId; bullets: [string, string, string] }

export const DSA_META: DsaMeta[] = [
    { id: 'hello', subject: 'prog1', title: 'Hello World & Syntax', bullets: ['Every C program starts at main', 'printf prints text, with codes like \\n and \\t', 'Statements end with ; and comments are ignored'] },
    { id: 'variables', subject: 'prog1', title: 'Variables & Data Types', bullets: ['int, float, double and char', 'A variable is a named box in memory (see it on the stack)', 'Copying a value, and sizeof'] },
    { id: 'operators', subject: 'prog1', title: 'Operators', bullets: ['+ - * / and % (integer division!)', 'Comparisons, && || and !', '+=, ++ and a (float) cast'] },
    { id: 'conditions', subject: 'prog1', title: 'Conditions', bullets: ['if, else if and else', 'Only one branch runs', 'Finding the largest of three numbers'] },
    { id: 'loops', subject: 'prog1', title: 'Loops', bullets: ['for: add 1 to 5 round by round', 'while and do-while', 'Every loop test is a step you can watch'] },
    { id: 'arrays', subject: 'prog1', title: 'Arrays & Strings', bullets: ['Boxes side by side, counted from 0', 'Loop over an array: sum and maximum', 'A string is a char array that ends with \\0'] },
    { id: 'functions', subject: 'prog1', title: 'Functions', bullets: ['Call, return and the stack frame', 'Parameters are copies (pass by value)', 'void functions and returned values'] },
    { id: 'pointers1', subject: 'prog1', title: 'Pointers: A First Look', bullets: ['& gives an address, * follows it', 'A pointer is a variable that holds an address', 'Swap two variables through pointers'] },
    { id: 'pointers', subject: 'prog2', title: 'Pointers & Arrays', bullets: ['An array name is the address of its first cell', 'p + 1 moves to the next element', 'Pass an array to a function and change it'] },
    { id: 'recursion', subject: 'prog2', title: 'Recursion', bullets: ['Every call gets its own stack frame', 'Factorial: the stack grows, then unwinds', 'Fibonacci and Towers of Hanoi'] },
    { id: 'sorting', subject: 'prog2', title: 'Sorting & Searching', bullets: ['Bubble sort and insertion sort', 'Swapping through pointers', 'Binary search on a sorted array'] },
    { id: 'structs', subject: 'prog2', title: 'Structs', bullets: ['Group related fields in one value', 'Arrays of structs', 'By value (a copy) or by pointer (->)'] },
    { id: 'dynamic', subject: 'prog2', title: 'Dynamic Memory', bullets: ['malloc reserves a block on the heap, free gives it back', 'calloc and realloc', 'The classic bug: using memory after free'] },
    { id: 'files', subject: 'prog2', title: 'File Handling', bullets: ['fopen and fclose, with the modes r, w and a', 'Write with fprintf, read with fgets, fscanf and fgetc', 'Check for NULL, and read until EOF'] },
    { id: 'adt', subject: 'prog2', title: 'ADT', bullets: ['What an abstract data type is: data plus its operations', 'Array lists: insert, delete, locate', 'Struct by value vs by pointer, and two classic bugs'] },
    { id: 'linkedlist', subject: 'prog2', title: 'Linked List', bullets: ['Nodes that point to the next node', 'Insert at the front, search and delete a value', 'Reverse a list by turning the pointers around'] },
    { id: 'stackqueue', subject: 'dsa', title: 'Stack & Queue', bullets: ['Stack: push and pop at the top (LIFO)', 'Queue: enqueue at the rear, dequeue at the front (FIFO)', 'Array and linked-list versions, including the circular queue'] },
    { id: 'cursor', subject: 'dsa', title: 'Cursor-Based', bullets: ['A linked list made of array indexes instead of pointers', 'The virtual heap and its avail list', 'allocSpace and freeSpace, step by step'] },
    { id: 'sets', subject: 'dsa', title: 'Sets', bullets: ['A set as a bit vector: one bit per element', 'A set as a boolean array', 'Union, intersection and removal'] },
    { id: 'hashing', subject: 'dsa', title: 'Hashing', bullets: ['A hash function turns a key into a slot', 'Open hashing: a linked list in every slot', 'Closed hashing: linear probing and collisions'] },
    { id: 'dictionary', subject: 'dsa', title: 'Dictionary', bullets: ['Keys and values stored together', 'An unsorted array dictionary with linear search', 'A sorted dictionary with binary search'] },
    { id: 'trees', subject: 'dsa', title: 'Trees', bullets: ['Binary search tree: insert and search', 'Preorder, inorder and postorder traversal', 'Recursion on the call stack and nodes on the heap'] },
    { id: 'heap', subject: 'dsa', title: 'Binary Heap', bullets: ['A complete tree stored in an array', 'Insert: add at the end and sift up', 'Extract the minimum: move the last one up and sift down'] },
    { id: 'graphs', subject: 'dsa', title: 'Graphs', bullets: ['Adjacency matrix and adjacency list', 'Depth-first search with recursion', 'Breadth-first search with a queue'] }
];

/** the lessons of one subject, in order */
export const lessonsOfSubject = (subject: DsaSubjectId) => DSA_META.filter(m => m.subject === subject);
