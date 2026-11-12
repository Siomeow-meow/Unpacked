#include <stdio.h>

int main(){
    FILE *fp = fopen("scores.txt", "w");
    int i;
    for(i = 1; i <= 5; i++){
        fprintf(fp, "%d\n", i * 10);
    }
    fclose(fp);

    fp = fopen("scores.txt", "r");
    int value;
    int sum = 0;
    while(fscanf(fp, "%d", &value) == 1){
        sum = sum + value;
    }
    fclose(fp);
    printf("sum = %d\n", sum);
    return 0;
}
