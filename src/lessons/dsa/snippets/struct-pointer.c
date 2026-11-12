#include <stdio.h>

typedef struct {
    int x;
    int y;
} Point;

void moveCopy(Point p){
    p.x = p.x + 5;
}

void movePtr(Point *p){
    p->x = p->x + 5;
}

int main(){
    Point a = {1, 2};
    moveCopy(a);
    printf("after moveCopy: x=%d\n", a.x);
    movePtr(&a);
    printf("after movePtr: x=%d\n", a.x);
    return 0;
}
