#include <stdio.h>

int main(){
    int a[4] = {10, 20, 30, 40};
    int *p = a;
    printf("%d %d\n", *p, *(p + 2));
    p++;
    printf("after p++: %d\n", *p);
    for(int *q = a; q < a + 4; q++){
        printf("%d ", *q);
    }
    printf("\n");
    return 0;
}
