# Intro to Learning Analytics (a made-up course): grading notes

These notes and `grades.csv` come from the same course. The teaching assistant merged the grade sheet from the two classes' records. **All names and student IDs in the sheet are made up.**

## How the semester grade is calculated

| Item | Weight |
|---|---|
| Homework (average of HW1 to HW4) | 30% |
| Quizzes (average of Quiz1 and Quiz2) | 20% |
| Midterm | 20% |
| Final | 30% |

- Round the semester grade to a whole number. **60 or above passes.**

## When an exam has no score

- The exam column says "absent": the student missed the exam without leave, so **that exam counts as 0**.
- The exam column is blank and the Note says "excused": the leave was approved, so **that exam is left out**. The semester grade is scaled up from the other items.
  For example, if the final was excused, compute homework 30%, quizzes 20% and midterm 20% (70% in total), then convert that to a 100-point scale.

## Resubmissions

- Some students handed homework in late, and the teaching assistant entered their scores again. If the same student appears in two rows, **use the row with the later RecordedAt**.

## Personal data

- Grades are personal data. **A public report** (including one on GitHub) **must not show students' names**. To refer to a student, use **the last three digits of the student ID**.
