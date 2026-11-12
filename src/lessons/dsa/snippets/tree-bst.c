#include <stdio.h>
#include <stdlib.h>

typedef struct node {
    int data;
    struct node *left;
    struct node *right;
} Node;

Node* newNode(int data){
    Node *n = malloc(sizeof(Node));
    n->data = data;
    n->left = NULL;
    n->right = NULL;
    return n;
}

Node* insert(Node *root, int data){
    if(root == NULL){
        return newNode(data);
    }
    if(data < root->data){
        root->left = insert(root->left, data);
    } else if(data > root->data){
        root->right = insert(root->right, data);
    }
    return root;
}

int search(Node *root, int data){
    while(root != NULL){
        if(data == root->data){
            return 1;
        }
        if(data < root->data){
            root = root->left;
        } else {
            root = root->right;
        }
    }
    return 0;
}

void inorder(Node *root){
    if(root == NULL){
        return;
    }
    inorder(root->left);
    printf("%d ", root->data);
    inorder(root->right);
}

int main(){
    Node *root = NULL;
    root = insert(root, 50);
    root = insert(root, 30);
    root = insert(root, 70);
    root = insert(root, 20);
    root = insert(root, 40);

    inorder(root);
    printf("\n");
    printf("40 found? %d\n", search(root, 40));
    printf("65 found? %d\n", search(root, 65));
    return 0;
}
