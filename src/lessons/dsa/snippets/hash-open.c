#include <stdio.h>
#include <stdlib.h>

#define SIZE 5

typedef struct node {
    int key;
    struct node *next;
} Node;

int hash(int key){
    return key % SIZE;
}

void insert(Node *table[], int key){
    int h = hash(key);
    Node *n = malloc(sizeof(Node));
    n->key = key;
    n->next = table[h];
    table[h] = n;
}

int search(Node *table[], int key){
    Node *p = table[hash(key)];
    while(p != NULL){
        if(p->key == key){
            return 1;
        }
        p = p->next;
    }
    return 0;
}

int main(){
    Node *table[SIZE] = {NULL, NULL, NULL, NULL, NULL};

    insert(table, 12);
    insert(table, 7);
    insert(table, 22);
    insert(table, 3);

    printf("22 found? %d\n", search(table, 22));
    printf("17 found? %d\n", search(table, 17));
    return 0;
}
