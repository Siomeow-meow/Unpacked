#include <stdio.h>

void addTen(int x){
    x = x + 10;
    printf("inside addTen: x=%d\n", x);
}

int main(){
    int n = 5;
    addTen(n);
    printf("back in main: n=%d\n", n);
    return 0;
}
