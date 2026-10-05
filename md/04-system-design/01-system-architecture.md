Each document answers one question.

Document	Answers
System Architecture	How are all parts connected?
Database Design	What data do we store?
Navigation Design	How does the user move through the app?
UI Design	What does every screen contain?
API Design	How does frontend communicate with backend?
Data Flow	How does information move through the system?
Step 1 — System Architecture

Create

04-system-design/
    01-system-architecture.md
Growth OS Architecture
                USER
                  │
                  │
        ┌─────────────────┐
        │ Web Browser     │
        │ Chrome / Edge   │
        └─────────────────┘
                  │
                  │ HTTP Request
                  ▼
        ┌─────────────────┐
        │ HTML            │
        │ CSS             │
        │ JavaScript      │
        └─────────────────┘
                  │
          Fetch API Requests
                  ▼
        ┌─────────────────┐
        │ Express Server  │
        │ Node.js         │
        └─────────────────┘
          │          │
          │          │
          ▼          ▼
   SQLite Database   AI Service (Future)

This is the complete architecture.

Software Layers

Professional software is divided into layers.

Presentation Layer
        │
Business Logic Layer
        │
Data Layer
1. Presentation Layer

Everything the user sees.

HTML

CSS

JavaScript

Responsibilities

display pages
show buttons
animations
forms
charts
responsive layout
2. Business Logic Layer

Built with

Express
Node.js

Responsibilities

receive requests
calculate streaks
validate forms
save data
send responses
authentication
3. Data Layer

Built with

SQLite

Stores

Users

Habits

Journal

Focus Sessions

Analytics

Settings
Why Three Layers?

Imagine you later replace HTML with React.

HTML

↓

React

The backend stays the same.

Or

SQLite

↓

PostgreSQL

Frontend stays the same.

This is why software engineers separate responsibilities.

Component Diagram

Think of Growth OS as six small applications working together.

                    Growth OS

                         │

────────────────────────────────────────────

Dashboard

Habits

Focus

Journal

Analytics

Settings

────────────────────────────────────────────

           Shared Database

Every module talks to the same database.

Communication
Dashboard
      │
      ▼
Express Route
      │
Controller
      │
SQLite
      │
Controller
      │
Dashboard

Every page works like this.

Future Expansion

Your architecture should support future features.

Current

Browser
↓

Express

↓

SQLite

Later

Browser

↓

React

↓

Express

↓

PostgreSQL

↓

OpenAI API

↓

Firebase Auth

↓

Cloud Storage

Nothing major changes.

That's called scalable architecture.

Software Engineering Principles Used

While designing Growth OS, we're applying principles that make systems easier to build and maintain:

1. Separation of Concerns (SoC)

Each part has one responsibility.

HTML → Structure

CSS → Styling

JavaScript → Interaction

Express → Business Logic

SQL → Data
2. Single Responsibility Principle (SRP)

Each module does one job.

Examples:

Habits Module

only handles habits
Journal Module

only handles journals
Focus Module

only handles focus sessions
3. Modularity

Instead of one huge application, we build many small modules.

Dashboard

Habits

Focus

Journal

Analytics

Settings

This makes it easier to debug, test, and extend.

4. Scalability

The system should allow new features without rewriting existing ones.

Examples:

Add AI Coach
Add calendar integration
Add achievements
Add notifications
Add mobile app
Deliverable Complete

After this step, your project documentation will look like: