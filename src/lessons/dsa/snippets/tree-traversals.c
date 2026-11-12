#include <stdio.h>
#include <stdlib.h>

typedef struct node {
    char data;
    struct node *left;
    struct node *right;
} Node;

Node* newNode(char data, Node *left, Node *right){
    Node *n = malloc(sizeof(Node));
    n->data = data;
    n->left = left;
    n->right = right;
    return n;
}

void preorder(Node *t){
    if(t == NULL) return;
    printf("%c ", t->data);
    preorder(t->left);
    preorder(t->right);
}

void inorder(Node *t){
    if(t == NULL) return;
    inorder(t->left);
    printf("%c ", t->data);
    inorder(t->right);
}

void postorder(Node *t){
    if(t == NULL) return;
    postorder(t->left);
    postorder(t->right);
    printf("%c ", t->data);
}

int height(Node *t){
    if(t == NULL) return 0;
    int l = height(t->left);
    int r = height(t->right);
    return 1 + (l > r ? l : r);
}

int main(){
    Node *root = newNode('A', newNode('B', newNode('D', NULL, NULL), newNode('E', NULL, NULL)), newNode('C', NULL, NULL));
    printf("preorder:  ");
    preorder(root);
    printf("\ninorder:   ");
    inorder(root);
    printf("\npostorder: ");
    postorder(root);
    printf("\nheight = %d\n", height(root));
    return 0;
}
