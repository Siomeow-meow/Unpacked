#include <stdio.h>

int factorial(int n){
    if(n <= 1){
        return 1;
    }
    return n * factorial(n - 1);
}

int main(){
    int r = factorial(4);
    printf("4! = %d\n", r);
    return 0;
}
