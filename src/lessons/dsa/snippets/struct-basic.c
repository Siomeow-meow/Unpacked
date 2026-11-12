#include <stdio.h>

typedef struct {
    int id;
    char name[10];
    float gpa;
} Student;

int main(){
    Student s = {7, "Ana", 3.5};
    printf("%d %s %.1f\n", s.id, s.name, s.gpa);
    Student list[2] = {{1, "Ben", 2.8}, {2, "Cy", 3.9}};
    for(int i = 0; i < 2; i++){
        printf("%d: %s (%.1f)\n", list[i].id, list[i].name, list[i].gpa);
    }
    return 0;
}
