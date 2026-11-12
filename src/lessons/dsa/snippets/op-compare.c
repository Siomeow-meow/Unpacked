#include <stdio.h>

int main(){
    int age = 20;
    int hasId = 1;
    int adult = age >= 18;
    int canEnter = adult && hasId;
    int child = !adult;
    int x = 5;
    x += 3;
    x++;
    printf("adult=%d canEnter=%d child=%d x=%d\n", adult, canEnter, child, x);
    return 0;
}
