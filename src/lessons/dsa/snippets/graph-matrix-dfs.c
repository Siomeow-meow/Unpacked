#include <stdio.h>
#include <stdbool.h>

#define N 5

int adj[N][N];
bool visited[N];

void addEdge(int a, int b){
    adj[a][b] = 1;
    adj[b][a] = 1;
}

void dfs(int v){
    visited[v] = true;
    printf("visit %d\n", v);
    for(int w = 0; w < N; w++){
        if(adj[v][w] == 1 && !visited[w]){
            dfs(w);
        }
    }
}

int main(){
    for(int i = 0; i < N; i++){
        visited[i] = false;
        for(int j = 0; j < N; j++){
            adj[i][j] = 0;
        }
    }
    addEdge(0, 1);
    addEdge(0, 2);
    addEdge(1, 3);
    addEdge(2, 4);

    dfs(0);
    return 0;
}
