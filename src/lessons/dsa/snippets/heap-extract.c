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

void siftDown(int i){
    int small = i;
    int l = 2 * i + 1;
    int r = 2 * i + 2;
    if(l < size && heap[l] < heap[small]){
        small = l;
    }
    if(r < size && heap[r] < heap[small]){
        small = r;
    }
    if(small != i){
        swap(i, small);
        siftDown(small);
    }
}

int extractMin(){
    int top = heap[0];
    size--;
    heap[0] = heap[size];
    siftDown(0);
    return top;
}

int main(){
    insert(50);
    insert(30);
    insert(40);
    insert(10);
    insert(20);
    while(size > 0){
        printf("%d ", extractMin());
    }
    printf("\n");
    return 0;
}
