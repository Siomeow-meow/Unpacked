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

Node *reverse(Node *head){
    Node *prev = NULL;
    while(head != NULL){
        Node *next = head->next;
        head->next = prev;
        prev = head;
        head = next;
    }
    return prev;
}

void print(Node *head){
    for(Node *p = head; p != NULL; p = p->next){
        printf("%d ", p->data);
    }
    printf("\n");
}

int main(){
    Node *head = NULL;
    head = insertFront(head, 3);
    head = insertFront(head, 2);
    head = insertFront(head, 1);
    print(head);
    head = reverse(head);
    print(head);
    return 0;
}
