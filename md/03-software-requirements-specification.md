# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

**Project Name:** Growth OS

**Document Version:** 1.0

**Author:** Abdimalik Noor

**Date:** __________________

---

# Table of Contents

1. Introduction
2. Overall Description
3. Functional Requirements
4. Non-Functional Requirements
5. Use Cases
6. User Stories
7. External Interface Requirements
8. Data Requirements
9. Business Rules
10. Assumptions
11. Constraints
12. Acceptance Criteria
13. Future Enhancements

---

# 1. Introduction

## 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional and non-functional requirements of Growth OS.

The document acts as a blueprint for the design, development, testing, deployment, and maintenance of the system.

---

## 1.2 Scope

Growth OS is an AI-powered Personal Growth Operating System that enables users to build discipline, improve productivity, develop habits, manage focus sessions, write journals, and monitor long-term personal growth through one centralized platform.

---

## 1.3 Objectives

The objectives of Growth OS are:

- Help users become more disciplined.
- Improve productivity.
- Track daily habits.
- Encourage journaling.
- Visualize progress.
- Provide AI-generated insights.
- Create a modern and responsive experience.

---

## 1.4 Intended Audience

This document is intended for:

- Developers
- UI/UX Designers
- Testers
- Project Maintainers
- Lecturers
- Future Contributors

---

## 1.5 Definitions

AI — Artificial Intelligence

Dashboard — Main page displaying user progress.

Habit — Daily activity tracked repeatedly.

Focus Session — A timed deep work session.

Journal — Daily written reflection.

Analytics — Statistics generated from user activity.

Identity Statement — User's desired future identity.

---

# 2. Overall Description

## 2.1 Product Perspective

Growth OS is a web application.

Users interact using a browser.

The frontend communicates with an Express backend.

The backend stores information inside an SQL database.

Future versions may integrate AI services and cloud storage.

---

## 2.2 Product Functions

Growth OS allows users to:

- Register
- Login
- Complete onboarding
- Track habits
- Use a focus timer
- Write journals
- View analytics
- Receive AI insights
- Reset personal goals
- Manage settings

---

## 2.3 User Characteristics

Target users include:

- Students
- Developers
- Entrepreneurs
- Professionals
- Self-improvement enthusiasts

---

## 2.4 Operating Environment

Frontend

- HTML
- CSS
- JavaScript

Backend

- Node.js
- Express.js

Database

- SQLite

Version Control

- Git
- GitHub

Deployment

- Render (Future)

---

# 3. Functional Requirements

## Authentication Module

| ID | Requirement |
|----|-------------|
| FR-001 | Register account |
| FR-002 | Login |
| FR-003 | Logout |
| FR-004 | Validate credentials |
| FR-005 | Update profile |
| FR-006 | Store user information |
| FR-007 | Delete account |

---

## Onboarding Module

| ID | Requirement |
|----|-------------|
| FR-008 | Display introduction screens |
| FR-009 | Skip introduction |
| FR-010 | Collect user name |
| FR-011 | Collect identity statement |
| FR-012 | Collect goals |
| FR-013 | Collect preferred habits |
| FR-014 | Save onboarding information |
| FR-015 | Redirect to dashboard |

---

## Dashboard Module

| ID | Requirement |
|----|-------------|
| FR-016 | Display greeting |
| FR-017 | Display identity card |
| FR-018 | Display today's habits |
| FR-019 | Display streak summary |
| FR-020 | Display focus progress |
| FR-021 | Display journal preview |
| FR-022 | Display AI insights |
| FR-023 | Display analytics summary |
| FR-024 | Refresh dashboard automatically |

---

## Habit Module

| ID | Requirement |
|----|-------------|
| FR-025 | Create habit |
| FR-026 | Edit habit |
| FR-027 | Delete habit |
| FR-028 | Mark habit completed |
| FR-029 | Record completion date |
| FR-030 | Calculate streak |
| FR-031 | Display history |
| FR-032 | Categorize habits |

---

## Focus Module

| ID | Requirement |
|----|-------------|
| FR-033 | Start timer |
| FR-034 | Pause timer |
| FR-035 | Resume timer |
| FR-036 | Stop timer |
| FR-037 | Save focus session |
| FR-038 | Calculate daily focus |
| FR-039 | Display weekly focus |

---

## Journal Module

| ID | Requirement |
|----|-------------|
| FR-040 | Create journal |
| FR-041 | Edit journal |
| FR-042 | Delete journal |
| FR-043 | Search journals |
| FR-044 | Display journal history |
| FR-045 | Organize by date |

---

## Analytics Module

| ID | Requirement |
|----|-------------|
| FR-046 | Calculate habit completion |
| FR-047 | Calculate focus statistics |
| FR-048 | Generate weekly report |
| FR-049 | Generate monthly report |
| FR-050 | Display charts |
| FR-051 | Display consistency heatmap |
| FR-052 | Display progress trends |

---

## AI Module

| ID | Requirement |
|----|-------------|
| FR-053 | Analyze habits |
| FR-054 | Analyze focus |
| FR-055 | Analyze journals |
| FR-056 | Generate daily insights |
| FR-057 | Recommend improvements |
| FR-058 | Summarize weekly growth |

---

## Reset Mode

| ID | Requirement |
|----|-------------|
| FR-059 | Display Reset Mode |
| FR-060 | Guide user through reset |
| FR-061 | Save reset plan |
| FR-062 | Display reset history |

---

## Settings Module

| ID | Requirement |
|----|-------------|
| FR-063 | Update profile |
| FR-064 | Manage notifications |
| FR-065 | Change application theme |
| FR-066 | Export user data |
| FR-067 | Delete account |

---

# 4. Non-Functional Requirements

## Performance

- Dashboard loads within 2 seconds.
- Database queries should be optimized.
- Smooth page transitions.

---

## Security

- Password encryption.
- Session management.
- Input validation.
- SQL injection prevention.
- Authentication.

---

## Reliability

- Data should not be lost.
- Automatic error handling.
- Stable backend server.

---

## Usability

- Responsive design.
- Easy navigation.
- Clean interface.
- Accessible typography.
- Consistent spacing.

---

## Maintainability

- Modular architecture.
- Reusable code.
- Organized folders.
- Clear documentation.

---

## Scalability

Future versions should support:

- React frontend
- PostgreSQL
- Firebase
- Supabase
- AI APIs
- Mobile applications

---

# 5. Use Cases

## Use Case 1

Create Habit

Actor

User

Steps

1. Open Habits page.
2. Click Add Habit.
3. Enter habit details.
4. Save habit.

Result

Habit appears on dashboard.

---

## Use Case 2

Complete Habit

1. Open Dashboard.
2. Select habit.
3. Mark Complete.
4. System updates streak.

---

## Use Case 3

Start Focus Session

1. Open Focus page.
2. Choose duration.
3. Click Start.
4. Timer begins.
5. Session saved after completion.

---

## Use Case 4

Write Journal

1. Open Journal.
2. Write entry.
3. Save.
4. Journal stored.

---

# 6. User Stories

As a student,

I want to track habits

so that I remain disciplined.

---

As a programmer,

I want to measure focus time

so that I improve productivity.

---

As a user,

I want AI insights

so that I understand my growth.

---

As a user,

I want all my personal growth data in one application

so that I don't switch between multiple apps.

---

# 7. External Interface Requirements

## User Interface

Desktop

Tablet

Mobile

Responsive design

---

## Hardware

Desktop

Laptop

Tablet

Phone

---

## Software

Chrome

Firefox

Edge

Safari

---

## Future Integrations

Firebase Authentication

Supabase

OpenAI API

Google OAuth

---

# 8. Data Requirements

Users

- id
- name
- email
- password

Habits

- id
- title
- description
- streak
- completed

Focus Sessions

- id
- duration
- date

Journal

- id
- title
- content
- created_at

Analytics

- id
- weekly_score
- monthly_score

Settings

- id
- theme
- notifications

---

# 9. Business Rules

- One user owns many habits.
- One user owns many journal entries.
- One user owns many focus sessions.
- Habit streak increases only once per day.
- Analytics are generated from user activity.
- AI insights require sufficient historical data.

---

# 10. Assumptions

- Users have internet access.
- Users have modern web browsers.
- JavaScript is enabled.
- Database service is available.

---

# 11. Constraints

- Free technologies.
- SQLite database (Version 1).
- HTML/CSS/JavaScript frontend.
- Express backend.
- Limited AI during initial release.

---

# 12. Acceptance Criteria

Growth OS is complete when:

✔ Users can register.

✔ Users can login.

✔ Users complete onboarding.

✔ Users create habits.

✔ Users complete habits.

✔ Users start focus sessions.

✔ Users create journals.

✔ Users view analytics.

✔ Users receive AI insights.

✔ Dashboard displays user progress.

✔ Data persists in database.

✔ Responsive on desktop, tablet, and mobile.

---

# 13. Future Enhancements

Version 2

- React frontend
- Authentication
- Cloud synchronization
- Better analytics

Version 3

- AI Coach
- Voice Journaling
- Notifications
- Smart recommendations

Version 4

- Mobile application
- Wearable integration
- Community features
- Team accountability