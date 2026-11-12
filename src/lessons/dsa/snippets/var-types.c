#include <stdio.h>

int main(){
    int age = 19;
    float price = 2.5;
    char grade = 'A';
    double pi = 3.14159;
    printf("age=%d price=%.1f grade=%c pi=%.2f\n", age, price, grade, pi);
    printf("an int takes %d bytes, a char takes %d byte\n", (int)sizeof(int), (int)sizeof(char));
    return 0;
}
