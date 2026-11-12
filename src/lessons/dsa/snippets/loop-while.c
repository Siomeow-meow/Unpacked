#include <stdio.h>

int main(){
    int n = 3;
    while(n > 0){
        printf("%d... ", n);
        n--;
    }
    printf("liftoff!\n");
    int digits = 0;
    int num = 4096;
    do {
        digits++;
        num = num / 10;
    } while(num > 0);
    printf("4096 has %d digits\n", digits);
    return 0;
}
