#include <stdio.h>
#include <stdlib.h>

typedef struct node {
    int data;
    struct node *next;
} Node;

void push(Node **top, int x){
    Node *n = malloc(sizeof(Node));
    n->data = x;
    n->next = *top;
    *top = n;
}

int pop(Node **top){
    Node *t = *top;
    int x = t->data;
    *top = t->next;
    free(t);
    return x;
}

int peek(Node *top){
    return top->data;
}

int main(){
    Node *top = NULL;
    push(&top, 10);
    push(&top, 20);
    push(&top, 30);
    printf("top is %d\n", peek(top));
    printf("popped %d\n", pop(&top));
    printf("popped %d\n", pop(&top));
    printf("top is %d\n", peek(top));
    return 0;
}
