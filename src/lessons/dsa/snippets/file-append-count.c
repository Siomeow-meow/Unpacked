#include <stdio.h>

int main(){
    FILE *fp = fopen("log.txt", "w");
    fputs("start\n", fp);
    fclose(fp);

    fp = fopen("log.txt", "a");
    fputs("second\n", fp);
    fputs("third\n", fp);
    fclose(fp);

    fp = fopen("log.txt", "r");
    int c;
    int lines = 0;
    while((c = fgetc(fp)) != EOF){
        if(c == '\n'){
            lines++;
        }
    }
    fclose(fp);
    printf("log.txt has %d lines\n", lines);
    return 0;
}
