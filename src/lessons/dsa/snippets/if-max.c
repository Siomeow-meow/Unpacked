#include <stdio.h>

int main(){
    int a = 12, b = 31, c = 7;
    int max = a;
    if(b > max){
        max = b;
    }
    if(c > max){
        max = c;
    }
    if(max % 2 == 0){
        printf("the largest is %d (even)\n", max);
    } else {
        printf("the largest is %d (odd)\n", max);
    }
    return 0;
}
