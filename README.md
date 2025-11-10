# FamilieTask

FamilieTask is an app designed to make it easy to create and share tasks among family members. The goal is to help families keep track of who is responsible for what, and when tasks need to be done.

## Status
The project has just started and is currently under development. This is an initial plan for how the app will be built and what features it will include.

## Planned Features
- Create an account and set up a family/group
- Add family members to the group
- Assign and track tasks
- Roles: Admin and Standard user
- Overview of completed and ongoing tasks

## Technology (Planned)
- Backend: Node.js with Express
- Database: SQLite
- Frontend: HTML and CSS communicating with the backend via API

---

# FamilieTask App - Database Documentation

This document describes the structure of the database used in the FamilieTask App. The database consists of four tables: `Users`, `Families`, `FamilyMembers`, and `Tasks`.  

---

## 🧑‍💻 Users Table

Stores information about users.

| Column    | Type    | Description                              |
|-----------|---------|------------------------------------------|
| id        | INTEGER | Primary key, autoincrement               |
| username  | TEXT    | Username, cannot be null                 |
| email     | TEXT    | User's email, must be unique             |
| password  | TEXT    | User's password, cannot be null          |

---

## 🏠 Families Table

Stores information about families.

| Column | Type    | Description                        |
|--------|---------|------------------------------------|
| id     | INTEGER | Primary key, autoincrement         |
| name   | TEXT    | Name of the family, cannot be null |

---

## 👨‍👩‍👧‍👦 FamilyMembers Table

Manages which users are members of which families and their roles.
| Column     | Type    | Description                                                              |
|------------|---------|--------------------------------------------------------------------------|
| id         | INTEGER | Primary key, autoincrement                                               |
| family_id  | INTEGER | References Families(id), must exist                                      |
| user_id    | INTEGER | References Users(id), must exist                                         |
| role       | TEXT    | Role in the family: `'owner'`, `'admin'` or `'standard'`                 |

---

**Notes:**  
- We could avoid the `FamilyMembers` table and run a one to many relationship between `User`and `Famlily`, but inlucing it ensures scalability and it makes it easier to adapt roles.
- The `'owner'` role should automatically be assigned to the user who creates the family. Owner Gets the same functionallity as an admin and some extra benefits.
- `'admin'` can assign tasks and manage members.  
- `'standard'` represents regular family members.

---

## ✅ Tasks Table

Stores tasks that are linked to families and users.

| Column      | Type    | Description                                                |
|-------------|---------|------------------------------------------------------------|
| id          | INTEGER | Primary key, autoincrement                                 |
| family_id   | INTEGER | References Families(id)                                    |
| assigned_to | INTEGER | References Users(id), can be null if unassigned            |
| title       | TEXT    | Task title, cannot be null                                 |
| description | TEXT    | Optional description of the task                           |
| status      | TEXT    | Task status, default: `'pending'`                          |
| due_date    | TEXT    | Task due date (optional)                                   |
| created     | TEXT    | Creation timestamp, default: CURRENT_TIMESTAMP             |

---

## 🔗 Relationships

- A `User` can be a member of multiple `Families` through `FamilyMembers`.
- A `Family` can have multiple members with different roles.  
- A `Task` always belongs to a `Family` and can be assigned to a `User`.  
- `FamilyMembers.role` controls access and permissions within the family.

---
