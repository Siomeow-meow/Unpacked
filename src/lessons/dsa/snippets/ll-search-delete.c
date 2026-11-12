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

int search(Node *head, int value){
    int pos = 0;
    for(Node *p = head; p != NULL; p = p->next){
        if(p->data == value){
            return pos;
        }
        pos++;
    }
    return -1;
}

Node *removeValue(Node *head, int value){
    Node *prev = NULL;
    Node *cur = head;
    while(cur != NULL && cur->data != value){
        prev = cur;
        cur = cur->next;
    }
    if(cur == NULL){
        return head;
    }
    if(prev == NULL){
        head = cur->next;
    } else {
        prev->next = cur->next;
    }
    free(cur);
    return head;
}

int main(){
    Node *head = NULL;
    head = insertFront(head, 30);
    head = insertFront(head, 20);
    head = insertFront(head, 10);
    printf("20 is at position %d\n", search(head, 20));
    head = removeValue(head, 20);
    printf("20 is now at position %d\n", search(head, 20));
    return 0;
}
