#include <stdio.h>

#define SIZE 7
#define EMPTY -1

int table[SIZE] = {EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY};

int hash(int key){
    return key % SIZE;
}

void insert(int key){
    int h = hash(key);
    for(int i = 0; i < SIZE; i++){
        int slot = (h + i) % SIZE;
        if(table[slot] == EMPTY){
            table[slot] = key;
            printf("%d goes to slot %d after %d collision(s)\n", key, slot, i);
            return;
        }
    }
    printf("table is full\n");
}

int search(int key){
    int h = hash(key);
    for(int i = 0; i < SIZE; i++){
        int slot = (h + i) % SIZE;
        if(table[slot] == key){
            return slot;
        }
        if(table[slot] == EMPTY){
            return -1;
        }
    }
    return -1;
}

int main(){
    insert(15);
    insert(22);
    insert(8);
    insert(5);
    printf("22 is in slot %d\n", search(22));
    printf("30 is in slot %d\n", search(30));
    return 0;
}
