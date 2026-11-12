#include <stdio.h>

int heap[10];
int size = 0;

void swap(int a, int b){
    int t = heap[a];
    heap[a] = heap[b];
    heap[b] = t;
}

void insert(int value){
    int i = size;
    heap[i] = value;
    size++;
    while(i > 0 && heap[(i - 1) / 2] > heap[i]){
        swap(i, (i - 1) / 2);
        i = (i - 1) / 2;
    }
}

int main(){
    insert(50);
    insert(30);
    insert(40);
    insert(10);
    insert(20);
    int k;
    for(k = 0; k < size; k++){
        printf("%d ", heap[k]);
    }
    printf("\n");
    return 0;
}
