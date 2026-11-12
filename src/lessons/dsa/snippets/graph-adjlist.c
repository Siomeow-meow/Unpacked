#include <stdio.h>
#include <stdlib.h>

#define N 4

typedef struct node {
    int vertex;
    struct node *next;
} Node;

Node *adj[N];

void addEdge(int from, int to){
    Node *n = malloc(sizeof(Node));
    n->vertex = to;
    n->next = adj[from];
    adj[from] = n;
}

void print(){
    for(int v = 0; v < N; v++){
        printf("%d:", v);
        Node *p = adj[v];
        while(p != NULL){
            printf(" %d", p->vertex);
            p = p->next;
        }
        printf("\n");
    }
}

int main(){
    for(int i = 0; i < N; i++){
        adj[i] = NULL;
    }
    addEdge(0, 1);
    addEdge(0, 2);
    addEdge(1, 3);
    addEdge(2, 3);
    print();
    return 0;
}
