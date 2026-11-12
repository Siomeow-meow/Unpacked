#include <stdio.h>

int square(int x){
    return x * x;
}

int bigger(int a, int b){
    if(a > b){
        return a;
    }
    return b;
}

int main(){
    int s = square(6);
    int m = bigger(s, 30);
    printf("square=%d bigger=%d\n", s, m);
    return 0;
}
