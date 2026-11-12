#include <stdio.h>

int main(){
    int a = 5;
    int b = a;
    a = a + 1;
    int total = a + b;
    printf("a=%d b=%d total=%d\n", a, b, total);
    return 0;
}
