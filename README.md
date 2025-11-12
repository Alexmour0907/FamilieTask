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

This document describes the structure of the database used in the FamilieTask App. The database tables and columns below are aligned with the current SQLite schema.

---

## 🧑‍💻 Users Table

Stores information about users.

| Column    | Type    | Description                              |
|-----------|---------|------------------------------------------|
| id        | INTEGER | Primary key, autoincrement               |
| username  | TEXT    | Username, cannot be null                 |
| email     | TEXT    | User's email, must be unique             |
| password  | TEXT    | User's password, cannot be null          |
| points    | INTEGER | Accumulated points for gamification, default: 0 |

---

## 🏠 Families Table

Stores information about families.

| Column | Type    | Description                        |
|--------|---------|------------------------------------|
| id     | INTEGER | Primary key, autoincrement         |
| name   | TEXT    | Name of the family, cannot be null |
| owner_id | INTEGER | References `Users(id)` — family owner |
| join_code | TEXT | Unique join code for invitations   |
| last_code_update | TIMESTAMP | Timestamp of last join_code update |

---

## 👨‍👩‍👧‍👦 FamilyMembers Table

Manages which users are members of which families and their roles.

| Column     | Type    | Description                                                              |
|------------|---------|--------------------------------------------------------------------------|
| family_id  | INTEGER | References `Families(id)`                                                 |
| user_id    | INTEGER | References `Users(id)`                                                   |
| role       | TEXT    | Role in the family: `'admin'` or `'standard'` (default: `'standard'`)    |

Primary key: composite (`family_id`, `user_id`).

---

**Notes:**  
- The `owner` of a family is stored on the `Families.owner_id` column; `FamilyMembers` tracks membership and member-level roles (`admin`, `standard`).
- `admin` can assign tasks and manage members; `standard` represents regular members.

---

## ✅ Tasks Table

Stores task definitions that belong to a family.

| Column        | Type    | Description                                               |
|---------------|---------|-----------------------------------------------------------|
| id            | INTEGER | Primary key, autoincrement                                |
| family_id     | INTEGER | References `Families(id)`                                 |
| title         | TEXT    | Task title, cannot be null                                |
| description   | TEXT    | Optional description of the task                          |
| difficulty    | TEXT    | Difficulty: `light`, `easy`, `medium`, `hard` (default: `medium`) |
| points_reward | INTEGER | Points awarded for completing the task (default: 10)      |
| created_by    | INTEGER | References `Users(id)` — who created the task (NOT NULL)  |
| created       | TIMESTAMP | Creation timestamp, default: CURRENT_TIMESTAMP         |
| deadline      | TIMESTAMP | Optional deadline                                      |

---

## 📝 AssignedTasks Table

Tracks assignment of tasks to users and the assignment lifecycle.

| Column        | Type    | Description                                                      |
|---------------|---------|------------------------------------------------------------------|
| id            | INTEGER | Primary key, autoincrement                                       |
| task_id       | INTEGER | References `Tasks(id)`                                           |
| user_id       | INTEGER | References `Users(id)` — may be NULL if unassigned              |
| status        | TEXT    | `not_assigned`, `pending`, `completed`, `approved` (default: `not_assigned`) |
| assigned_date | TIMESTAMP | Timestamp when assignment created (default: CURRENT_TIMESTAMP) |

---

## 🔔 JoinRequests Table

Tracks requests from users to join a family (used for approval flows).

| Column      | Type    | Description                                              |
|-------------|---------|----------------------------------------------------------|
| id          | INTEGER | Primary key, autoincrement                               |
| family_id   | INTEGER | References `Families(id)`                                |
| user_id     | INTEGER | References `Users(id)`                                  |
| status      | TEXT    | `pending`, `approved`, `rejected` (default: `pending`)  |
| requested_at| TIMESTAMP | When the request was made (default: CURRENT_TIMESTAMP) |
| expires_at  | TIMESTAMP | When the request expires (default: now + 7 days)       |

---

## 🔗 Relationships

- A `User` can be a member of multiple `Families` through `FamilyMembers`.
- A `Family` can have multiple members with different roles.
- A `Task` belongs to a `Family`; assignments for tasks are stored in `AssignedTasks`.
- `JoinRequests` supports an approval/expiry flow to join a family.

---
