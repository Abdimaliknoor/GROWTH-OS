Perfect. Now we're at one of the most important design phases.

Phase 5 — API Design
What is an API?

Think of the API as the waiter between the frontend and the database.

User
 │
 ▼
Frontend (HTML/CSS/JavaScript)
 │
 │ HTTP Request
 ▼
Express API
 │
 ▼
SQLite Database

The frontend never talks directly to the database.

Instead:

Click Button
      │
      ▼
JavaScript
      │
      ▼
Express Route (API)
      │
      ▼
Controller
      │
      ▼
Database
      │
      ▼
Return Response
      │
      ▼
Update UI
API Design Process

A software engineer designs APIs from the user actions, not randomly.

The process is:

Screen
      │
      ▼
User Action
      │
      ▼
Business Process
      │
      ▼
Database Operation
      │
      ▼
API Endpoint
Example

Dashboard

↓

User clicks

Add Habit

↓

System

Store Habit

↓

Database

INSERT INTO habits

↓

API

POST /api/habits
Step 1 — List Every Module

Growth OS

Authentication

Onboarding

Dashboard

Habits

Focus

Journal

Analytics

AI

Reset Mode

Settings

Each module gets its own API.

1. Authentication API

Purpose

Manage users.

Register
POST /api/auth/register

Request

{
  "name":"Abdimalik",
  "email":"abdi@gmail.com",
  "password":"123456"
}

Response

{
  "success": true,
  "message":"User created"
}
Login
POST /api/auth/login
Logout
POST /api/auth/logout
Current User
GET /api/auth/me
2. User Profile API

Get profile

GET /api/users/profile

Update profile

PUT /api/users/profile
3. Habit API
Get all habits
GET /api/habits
Get one habit
GET /api/habits/:id
Create habit
POST /api/habits

Request

{
    "title":"Running",
    "frequency":"Daily"
}
Update habit
PUT /api/habits/:id
Delete habit
DELETE /api/habits/:id
Complete habit
POST /api/habits/:id/complete
Undo completion
DELETE /api/habits/:id/complete
4. Focus API

Start timer

POST /api/focus/start

Stop timer

POST /api/focus/stop

History

GET /api/focus/history

Statistics

GET /api/focus/stats
5. Journal API

All entries

GET /api/journal

Single entry

GET /api/journal/:id

Create

POST /api/journal

Edit

PUT /api/journal/:id

Delete

DELETE /api/journal/:id
6. Dashboard API

Instead of making 10 requests, the dashboard loads everything at once.

GET /api/dashboard

Returns

{
    "user": {},
    "habits": [],
    "todayFocus": {},
    "journal": {},
    "analytics": {},
    "aiInsight": {}
}
7. Analytics API

Overview

GET /api/analytics

Weekly

GET /api/analytics/weekly

Monthly

GET /api/analytics/monthly

Habit analytics

GET /api/analytics/habits

Focus analytics

GET /api/analytics/focus
8. AI API

Generate insight

POST /api/ai/insight

History

GET /api/ai/history

Daily reflection

POST /api/ai/reflection
9. Reset Mode API

Reset life

POST /api/reset

History

GET /api/reset/history
10. Settings API

View settings

GET /api/settings

Update settings

PUT /api/settings
Organizing the API

Instead of mixing all routes together, organize them by module:

/api
│
├── /auth
│   ├── POST /register
│   ├── POST /login
│   ├── POST /logout
│   └── GET /me
│
├── /users
│   ├── GET /profile
│   └── PUT /profile
│
├── /habits
│   ├── GET /
│   ├── GET /:id
│   ├── POST /
│   ├── PUT /:id
│   ├── DELETE /:id
│   └── POST /:id/complete
│
├── /focus
│
├── /journal
│
├── /analytics
│
├── /dashboard
│
├── /settings
│
├── /reset
│
└── /ai
How this maps to your Express project

Your backend folder can mirror the API structure:

server/
│
├── routes/
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── habit.routes.js
│   ├── focus.routes.js
│   ├── journal.routes.js
│   ├── analytics.routes.js
│   ├── dashboard.routes.js
│   ├── settings.routes.js
│   ├── reset.routes.js
│   └── ai.routes.js
│
├── controllers/
│   ├── auth.controller.js
│   ├── habit.controller.js
│   ├── focus.controller.js
│   └── ...
│
├── services/
│   ├── habit.service.js
│   ├── analytics.service.js
│   └── ...
│
├── models/
│   ├── user.model.js
│   ├── habit.model.js
│   └── ...