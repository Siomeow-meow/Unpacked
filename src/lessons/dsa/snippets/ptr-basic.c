#include <stdio.h>

int main(){
    int x = 10;
    int *p = &x;
    printf("x=%d, *p=%d\n", x, *p);
    *p = 25;
    printf("after *p = 25: x=%d\n", x);
    return 0;
}
