#include <stdio.h>

int main(){
    int score = 78;
    char grade;
    if(score >= 90){
        grade = 'A';
    } else if(score >= 80){
        grade = 'B';
    } else if(score >= 70){
        grade = 'C';
    } else {
        grade = 'F';
    }
    printf("score %d is grade %c\n", score, grade);
    return 0;
}
