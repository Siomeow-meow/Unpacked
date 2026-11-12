#include <stdio.h>
#include <stdbool.h>

#define N 8

typedef struct {
    bool member[N];
} Set;

Set emptySet(){
    Set s;
    for(int i = 0; i < N; i++){
        s.member[i] = false;
    }
    return s;
}

void add(Set *s, int x){
    s->member[x] = true;
}

Set unionSet(Set a, Set b){
    Set r = emptySet();
    for(int i = 0; i < N; i++){
        r.member[i] = a.member[i] || b.member[i];
    }
    return r;
}

Set intersect(Set a, Set b){
    Set r = emptySet();
    for(int i = 0; i < N; i++){
        r.member[i] = a.member[i] && b.member[i];
    }
    return r;
}

void display(Set s){
    printf("{ ");
    for(int i = 0; i < N; i++){
        if(s.member[i]){
            printf("%d ", i);
        }
    }
    printf("}\n");
}

int main(){
    Set A = emptySet();
    Set B = emptySet();
    add(&A, 1);
    add(&A, 2);
    add(&B, 2);
    add(&B, 6);

    display(unionSet(A, B));
    display(intersect(A, B));
    return 0;
}
