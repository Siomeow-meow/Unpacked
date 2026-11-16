#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

#define MAX 6

typedef struct{
	int items[MAX];
	int front;
	int rear;
}Queue;

Queue* initialize(){
	Queue *q = malloc(sizeof(Queue));
	q->front = 1;
	q->rear = 0;

	return q;
}

bool isEmpty(Queue *q){
	return (q->rear + 1) % MAX == q->front;
}

bool isFull(Queue *q){
	return (q->rear + 2) % MAX == q->front;
}

void enqueue(Queue *q, int value){
	if(isFull(q)) return;

	q->rear = (q->rear + 1) % MAX;
	q->items[q->rear] = value;
}

int dequeue(Queue *q){
	int value = q->items[q->front];

	q->front = (q->front + 1) % MAX;

	return value;
}

void display(Queue *q){
	int i;

	for(i = q->front; i != (q->rear + 1) % MAX; i = (i + 1) % MAX){
		printf("%d ", q->items[i]);
	}
	printf("\n");
}

int main(){
	Queue *q = initialize();

	enqueue(q, 10);
	enqueue(q, 20);
	enqueue(q, 30);
	enqueue(q, 40);
	enqueue(q, 50);
	display(q);

	enqueue(q, 99);

	printf("dequeued %d\n", dequeue(q));
	printf("dequeued %d\n", dequeue(q));

	enqueue(q, 60);
	enqueue(q, 70);
	display(q);

	printf("front = %d, rear = %d\n", q->front, q->rear);

	return 0;
}
