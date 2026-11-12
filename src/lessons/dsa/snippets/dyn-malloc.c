#include <stdio.h>
#include <stdlib.h>

int main(){
    int n = 4;
    int *a = malloc(n * sizeof(int));
    for(int i = 0; i < n; i++){
        a[i] = (i + 1) * 10;
    }
    int sum = 0;
    for(int i = 0; i < n; i++){
        sum += a[i];
    }
    printf("sum=%d\n", sum);
    free(a);
    return 0;
}
