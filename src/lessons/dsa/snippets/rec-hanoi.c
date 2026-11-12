#include <stdio.h>

void hanoi(int n, char from, char to, char via){
    if(n == 0){
        return;
    }
    hanoi(n - 1, from, via, to);
    printf("move disk %d from %c to %c\n", n, from, to);
    hanoi(n - 1, via, to, from);
}

int main(){
    hanoi(3, 'A', 'C', 'B');
    return 0;
}
