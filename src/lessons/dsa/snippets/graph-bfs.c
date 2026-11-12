#include <stdio.h>
#include <stdbool.h>

#define N 6

int adj[N][N];
bool visited[N];

void addEdge(int a, int b){
    adj[a][b] = 1;
    adj[b][a] = 1;
}

void bfs(int start){
    int queue[N];
    int front = 0;
    int rear = 0;

    visited[start] = true;
    queue[rear++] = start;

    while(front < rear){
        int v = queue[front++];
        printf("visit %d\n", v);
        for(int w = 0; w < N; w++){
            if(adj[v][w] == 1 && !visited[w]){
                visited[w] = true;
                queue[rear++] = w;
            }
        }
    }
}

int main(){
    addEdge(0, 1);
    addEdge(0, 2);
    addEdge(1, 3);
    addEdge(2, 4);
    addEdge(3, 5);
    addEdge(4, 5);
    bfs(0);
    return 0;
}
