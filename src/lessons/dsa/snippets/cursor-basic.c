#include <stdio.h>

#define MAX 5

typedef struct {
    int elem;
    int next;
} Cell;

typedef struct {
    Cell H[MAX];
    int avail;
} VHeap;

void initialize(VHeap *V){
    for(int i = 0; i < MAX - 1; i++){
        V->H[i].next = i + 1;
    }
    V->H[MAX - 1].next = -1;
    V->avail = 0;
}

int allocSpace(VHeap *V){
    int i = V->avail;
    if(i != -1){
        V->avail = V->H[i].next;
    }
    return i;
}

void freeSpace(VHeap *V, int i){
    V->H[i].next = V->avail;
    V->avail = i;
}

void insertFirst(int *L, VHeap *V, int x){
    int c = allocSpace(V);
    if(c != -1){
        V->H[c].elem = x;
        V->H[c].next = *L;
        *L = c;
    }
}

void deleteFirst(int *L, VHeap *V){
    if(*L != -1){
        int first = *L;
        *L = V->H[first].next;
        freeSpace(V, first);
    }
}

void display(int L, VHeap V){
    while(L != -1){
        printf("%d ", V.H[L].elem);
        L = V.H[L].next;
    }
    printf("\n");
}

int main(){
    VHeap V;
    int L = -1;
    initialize(&V);

    insertFirst(&L, &V, 30);
    insertFirst(&L, &V, 20);
    insertFirst(&L, &V, 10);
    display(L, V);

    deleteFirst(&L, &V);
    display(L, V);

    insertFirst(&L, &V, 99);
    display(L, V);
    return 0;
}
