#include <stdio.h>
#include <stdlib.h>

typedef struct node {
    int data;
    struct node *next;
} Node;

typedef struct {
    Node *front;
    Node *rear;
} Queue;

void enqueue(Queue *q, int x){
    Node *n = malloc(sizeof(Node));
    n->data = x;
    n->next = NULL;
    if(q->rear == NULL){
        q->front = n;
    } else {
        q->rear->next = n;
    }
    q->rear = n;
}

int dequeue(Queue *q){
    Node *t = q->front;
    int x = t->data;
    q->front = t->next;
    if(q->front == NULL){
        q->rear = NULL;
    }
    free(t);
    return x;
}

int main(){
    Queue q;
    q.front = NULL;
    q.rear = NULL;
    enqueue(&q, 1);
    enqueue(&q, 2);
    enqueue(&q, 3);
    printf("dequeued %d\n", dequeue(&q));
    enqueue(&q, 4);
    printf("dequeued %d\n", dequeue(&q));
    printf("dequeued %d\n", dequeue(&q));
    return 0;
}
