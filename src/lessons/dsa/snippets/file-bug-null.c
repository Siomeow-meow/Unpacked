#include <stdio.h>

int main(){
    char line[20];
    FILE *fp = fopen("missing.txt", "r");
    fgets(line, 20, fp);
    printf("%s", line);
    fclose(fp);
    return 0;
}
