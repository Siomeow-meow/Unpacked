#include <stdio.h>

int binarySearch(int arr[], int n, int target){
    int low = 0;
    int high = n - 1;
    while(low <= high){
        int mid = (low + high) / 2;
        if(arr[mid] == target){
            return mid;
        } else if(arr[mid] < target){
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return -1;
}

int main(){
    int a[7] = {3, 8, 12, 17, 25, 31, 40};
    printf("25 is at index %d\n", binarySearch(a, 7, 25));
    printf("10 is at index %d\n", binarySearch(a, 7, 10));
    return 0;
}
