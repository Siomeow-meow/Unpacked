#include <stdio.h>
#include <stdlib.h>

int main(){
    int *a = calloc(2, sizeof(int));
    a[0] = 5;
    a[1] = 6;
    a = realloc(a, 4 * sizeof(int));
    a[2] = 7;
    a[3] = 8;
    for(int i = 0; i < 4; i++){
        printf("%d ", a[i]);
    }
    printf("\n");
    free(a);
    return 0;
}
