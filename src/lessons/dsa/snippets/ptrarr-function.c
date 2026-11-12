#include <stdio.h>

int sum(int *arr, int n){
    int total = 0;
    for(int i = 0; i < n; i++){
        total += arr[i];
    }
    return total;
}

void doubleAll(int *arr, int n){
    for(int i = 0; i < n; i++){
        arr[i] = arr[i] * 2;
    }
}

int main(){
    int a[3] = {1, 2, 3};
    printf("sum=%d\n", sum(a, 3));
    doubleAll(a, 3);
    printf("after doubleAll: %d %d %d\n", a[0], a[1], a[2]);
    return 0;
}
