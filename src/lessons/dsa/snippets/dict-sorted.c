#include <stdio.h>

#define MAX 8

typedef struct {
    int keys[MAX];
    int count;
} SortedDict;

void insert(SortedDict *D, int key){
    int i = D->count - 1;
    while(i >= 0 && D->keys[i] > key){
        D->keys[i + 1] = D->keys[i];
        i--;
    }
    D->keys[i + 1] = key;
    D->count++;
}

int search(SortedDict *D, int key){
    int low = 0;
    int high = D->count - 1;
    while(low <= high){
        int mid = (low + high) / 2;
        if(D->keys[mid] == key){
            return mid;
        } else if(D->keys[mid] < key){
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return -1;
}

int main(){
    SortedDict D;
    D.count = 0;
    insert(&D, 40);
    insert(&D, 10);
    insert(&D, 30);
    insert(&D, 20);
    insert(&D, 50);

    printf("30 is at index %d\n", search(&D, 30));
    printf("35 is at index %d\n", search(&D, 35));
    return 0;
}
