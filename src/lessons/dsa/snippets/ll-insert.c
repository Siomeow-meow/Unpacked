#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int data;
    struct Node *next;
} Node;

Node *insertFront(Node *head, int value){
    Node *n = malloc(sizeof(Node));
    n->data = value;
    n->next = head;
    return n;
}

void print(Node *head){
    for(Node *p = head; p != NULL; p = p->next){
        printf("%d -> ", p->data);
    }
    printf("NULL\n");
}

int main(){
    Node *head = NULL;
    head = insertFront(head, 30);
    head = insertFront(head, 20);
    head = insertFront(head, 10);
    print(head);
    return 0;
}
