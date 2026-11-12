#include <stdio.h>
#include <string.h>

#define MAX 5

typedef struct {
    int key;
    char value[12];
} Entry;

typedef struct {
    Entry items[MAX];
    int count;
} Dict;

void insert(Dict *D, int key, char *value){
    for(int i = 0; i < D->count; i++){
        if(D->items[i].key == key){
            strcpy(D->items[i].value, value);
            return;
        }
    }
    if(D->count == MAX){
        printf("Dictionary is full\n");
        return;
    }
    D->items[D->count].key = key;
    strcpy(D->items[D->count].value, value);
    D->count++;
}

char* lookup(Dict *D, int key){
    for(int i = 0; i < D->count; i++){
        if(D->items[i].key == key){
            return D->items[i].value;
        }
    }
    return NULL;
}

void removeKey(Dict *D, int key){
    for(int i = 0; i < D->count; i++){
        if(D->items[i].key == key){
            D->items[i] = D->items[D->count - 1];
            D->count--;
            return;
        }
    }
}

int main(){
    Dict D;
    D.count = 0;
    insert(&D, 101, "Ana");
    insert(&D, 205, "Ben");
    insert(&D, 307, "Cy");

    char *v = lookup(&D, 205);
    printf("205 -> %s\n", v);

    insert(&D, 205, "Benito");
    removeKey(&D, 101);

    v = lookup(&D, 101);
    printf("101 -> %s\n", v ? v : "not found");
    printf("count = %d\n", D.count);
    return 0;
}
