# QueenB Match

QueenB Match is a mentoring coordination app for matching mentees with mentors in the community.

## Tech Stack

- Frontend: React, TypeScript, Material UI, FullCalendar
- Backend: Node.js, Express, TypeScript
- Database: MongoDB with Mongoose
- Auth: JWT login tokens and hashed passwords

## What The MVP Includes

- Register and login
- Every new user is a regular user and can request mentoring as a mentee
- A user becomes a mentor by creating a mentor profile
- Mentor list
- Meeting request flow
- Mentor proposes times
- Mentee chooses one proposed time
- Hebrew RTL interface
- Home page calendar with month, week, and day views
- Mentor/mentee meeting switch for users who are mentors
- Admin dashboard for users and meetings

## Local Setup

Use `npm.cmd` in PowerShell.

1. Install MongoDB Community Server locally, or start Docker Desktop and run:

```bash
docker compose up -d
```

2. Start MongoDB if you installed it without Docker.
3. Install dependencies:

```bash
npm.cmd install
cd server
npm.cmd install
cd ../client
npm.cmd install
```

4. Create `server/.env` from `server/.env.example`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/queenb-match
JWT_SECRET=dev-secret-change-me
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-character-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
APP_BASE_URL=http://localhost:5000
MEETING_TIME_ZONE=Asia/Jerusalem
ADMIN_EMAIL=admin@queenb.local
ADMIN_PASSWORD=admin123
ADMIN_USERNAME=מנהלת קהילה
```

You can also create `client/.env` from `client/.env.example`.

5. Create the admin user:

```bash
cd server
npm.cmd run seed:admin
```

6. Run the app from the project root:

```bash
npm.cmd run dev
```

Frontend: http://localhost:3000

Backend: http://localhost:5000

## Demo Flow

1. Register user A.
2. User A creates a mentor profile.
3. Register user B.
4. User B opens the mentor list and requests a meeting with user A.
5. User A opens the calendar as mentor and proposes times.
6. User B opens the calendar as mentee and selects a time.
7. The meeting appears in the calendar.
8. Login as admin to see all users and meetings.

## Helpful Terms

- API: backend route the frontend calls, for example `/api/auth/login`.
- Schema: the shape of a MongoDB document.
- JWT: a login token kept by the browser after login.
- Mongoose: a library that connects TypeScript/JavaScript code to MongoDB schemas.
