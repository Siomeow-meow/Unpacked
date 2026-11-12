#include <stdio.h>
#include <stdlib.h>

#define MAX 8

typedef struct {
    int elem[MAX];
    int count;
} List;

List* initialize(){
    List *L = malloc(sizeof(List));
    L->count = 0;
    return L;
}

void insertPos(List *L, int data, int pos){
    if(L->count == MAX || pos < 0 || pos > L->count){
        return;
    }
    for(int i = L->count; i > pos; i--){
        L->elem[i] = L->elem[i - 1];
    }
    L->elem[pos] = data;
    L->count++;
}

void deletePos(List *L, int pos){
    if(pos < 0 || pos >= L->count){
        return;
    }
    for(int i = pos; i < L->count - 1; i++){
        L->elem[i] = L->elem[i + 1];
    }
    L->count--;
}

int locate(List *L, int data){
    for(int i = 0; i < L->count; i++){
        if(L->elem[i] == data){
            return i;
        }
    }
    return -1;
}

void display(List *L){
    for(int i = 0; i < L->count; i++){
        printf("%d ", L->elem[i]);
    }
    printf("\n");
}

int main(){
    List *L = initialize();
    insertPos(L, 10, 0);
    insertPos(L, 30, 1);
    insertPos(L, 20, 1);
    display(L);

    deletePos(L, 0);
    display(L);

    printf("30 is at index %d\n", locate(L, 30));
    free(L);
    return 0;
}
