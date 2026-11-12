#include <stdio.h>

int main(){
    FILE *fp = fopen("notes.txt", "w");
    if(fp == NULL){
        printf("could not open the file\n");
        return 1;
    }
    fprintf(fp, "apple\n");
    fprintf(fp, "banana\n");
    fputs("cherry\n", fp);
    fclose(fp);

    char line[20];
    fp = fopen("notes.txt", "r");
    while(fgets(line, 20, fp) != NULL){
        printf("read: %s", line);
    }
    fclose(fp);
    return 0;
}
