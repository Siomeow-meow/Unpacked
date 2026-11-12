#include <stdio.h>

int main(){
    int scores[5] = {70, 85, 60, 95, 80};
    int sum = 0;
    int max = scores[0];
    for(int i = 0; i < 5; i++){
        sum += scores[i];
        if(scores[i] > max){
            max = scores[i];
        }
    }
    printf("sum=%d max=%d average=%d\n", sum, max, sum / 5);
    return 0;
}
