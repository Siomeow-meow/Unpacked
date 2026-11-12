#include <stdio.h>
#include <string.h>

int main(){
    char word[8] = "stack";
    int len = 0;
    while(word[len] != '\0'){
        len++;
    }
    printf("%s has %d letters (strlen says %d)\n", word, len, (int)strlen(word));
    for(int i = len - 1; i >= 0; i--){
        printf("%c", word[i]);
    }
    printf("\n");
    return 0;
}
