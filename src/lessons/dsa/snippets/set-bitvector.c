#include <stdio.h>

typedef unsigned int Set;

Set add(Set s, int x){
    return s | (1 << x);
}

Set removeElem(Set s, int x){
    return s & ~(1 << x);
}

int contains(Set s, int x){
    return (s >> x) & 1;
}

Set unionSet(Set a, Set b){
    return a | b;
}

Set intersect(Set a, Set b){
    return a & b;
}

void display(Set s){
    printf("{ ");
    for(int i = 0; i < 8; i++){
        if(contains(s, i)){
            printf("%d ", i);
        }
    }
    printf("}\n");
}

int main(){
    Set A = 0;
    Set B = 0;
    A = add(A, 1);
    A = add(A, 3);
    A = add(A, 5);
    B = add(B, 3);
    B = add(B, 4);
    B = add(B, 5);

    display(A);
    display(B);
    display(unionSet(A, B));
    display(intersect(A, B));

    A = removeElem(A, 3);
    display(A);
    return 0;
}
