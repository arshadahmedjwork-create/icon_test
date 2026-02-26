# MIDAS Scientific Event Management System - System Architecture & Design

## 1. Backend Project Structure & Technology Stack

The backend will be a **modular monolith** using Node.js (Express) with a focus on scalability and clean separation of concerns.

### Recommended Folder Structure
```
/midas-backend
├── src
│   ├── config          # Environment variables, DB connection, S3 config
│   ├── middleware      # Auth, RBAC, Validation, Error Handling
│   ├── modules         # Feature-based modules (Controller, Service, Repository, Routes)
│   │   ├── auth
│   │   ├── student
│   │   ├── judge
│   │   ├── session
│   │   ├── evaluation
│   │   ├── payment
│   │   ├── attendance
│   │   └── admin
│   ├── shared          # Shared utilities (Logger, Email Service, S3 Helper)
│   ├── app.ts          # Express App setup
│   └── server.ts       # Server entry point
├── db
│   ├── migrations      # Database migrations
│   └── seeds           # Seed data for development
├── tests               # Integration and Unit tests
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 2. PostgreSQL Database Schema

### Users & Roles
- **users**: `id (UUID)`, `email (unique)`, `password_hash`, `role (enum: student, judge, admin)`, `created_at`, `updated_at`

### Student Management
- **students**: `user_id (fk)`, `midas_id (unique)`, `full_name`, `phone`, `dob`, `college`, `course`, `year`, `registration_status (pending, approved, rejected)`, `qr_code_url`
- **student_events**: `student_id (fk)`, `event_type (paper, poster)`, `mode (online, offline)`, `topic/subject`

### Submissions
- **submissions**: `id`, `student_id (fk)`, `event_type`, `title`, `abstract_text`, `abstract_file_url`, `presentation_file_url`, `status (draft, submitted, approved)`, `submission_date`

### Judge Management
- **judges**: `user_id (fk)`, `full_name`, `is_academic (bool)`, `college/institution`, `specialization`, `years_experience`
- **judge_availability**: `judge_id (fk)`, `date`, `time_slot_start`, `time_slot_end`, `mode_preference`

### Sessions & Orchestration
- **sessions**: `id`, `name`, `type (paper/poster)`, `mode (online/offline)`, `subject`, `start_time`, `end_time`, `meeting_link (online)`, `venue (offline)`, `session_chair_id (fk to judges)`
- **session_judges**: `session_id`, `judge_id`, `role (evaluator, chair)`
- **session_participants**: `session_id`, `student_id`, `presentation_order`

### Evaluations
- **evaluation_criteria**: `id`, `event_type`, `criteria_name`, `max_score`, `weightage`
- **evaluations**: `session_id`, `judge_id`, `student_id`, `criteria_id`, `score`, `comments`, `created_at`

### Attendance
- **attendance**: `session_id`, `user_id`, `status (present, absent)`, `marked_by (moderator_id)`, `timestamp`

### Payments (Future-Ready)
- **payments**: `id`, `user_id`, `amount`, `currency`, `provider (razorpay)`, `transaction_id`, `status (pending, success, failed)`, `receipt_url`

---

## 3. Role-Based API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT
- `GET /api/auth/me` - Get current user profile

### Students
- `POST /api/students/profile` - Create/Update profile
- `POST /api/students/register-event` - Register for an event
- `POST /api/submissions/upload` - Secure upload for Abstract/PPT (Multer -> S3)
- `GET /api/students/dashboard` - Get status, sessions, and evaluation results

### Judges
- `GET /api/judges/sessions` - Get assigned sessions
- `POST /api/evaluations/submit` - Submit score for a student
- `GET /api/judges/schedule` - View schedule

### Admin
- `GET /api/admin/users` - Manage all users
- `POST /api/admin/sessions/orchestrate` - Trigger auto-grouping algorithm
- `POST /api/admin/certificates/generate` - Trigger certificate generation
- `GET /api/reports/stats` - Overall stats for dashboard

---

## 4. Algorithms & Logic

### Session Orchestration Engine
1.  **Filter**: Group approved submissions by `Mode` (Online/Offline) and `Type` (Paper/Poster).
2.  **Sub-group**: By `Subject` similarity.
3.  **Analyze**: Check college diversity. Ideally max 2 students from same college per session.
4.  **Create Sessions**:
    -   Online Paper: Chunks of 10-12
    -   Offline Paper: Chunks of 8
    -   Online Poster: Chunks of 15
    -   Offline Poster: Chunks of 12
5.  **Assign Judges**:
    -   Fetch available judges for the time slot.
    -   Constraint check: Judge college != Any student college in session.
    -   Mix: 1 Academic + 2 Non-Academic.

### Evaluation & Tie-Breaking
1.  Fetch all scores for a student in a specific event.
2.  Calculate weighted average based on criteria.
3.  Sort primarily by Total Score.
4.  **Tie-Breaker**: If scores equal -> Check weighted score of specific high-priority criteria (e.g., "Scientific Content").
5.  Rank top 3.

---

## 5. Deployment Architecture (AWS)

-   **Compute**: AWS Elastic Beanstalk (Node.js environment) or EC2 with Docker Compose.
-   **Database**: AWS RDS for PostgreSQL (Multi-AZ for high availability).
-   **Storage**: AWS S3 for documents (Abstracts, PPTs, Certificates). Use IAM roles for secure access.
-   **Static Frontend**: AWS S3 + CloudFront for React app.
-   **CI/CD**: GitHub Actions building Docker images and pushing to ECR, then deploying to Beanstalk.

---

## 6. Real-Time Dashboard (WebSockets)

Events to emit via Socket.io:
-   `session:started` / `session:ended`
-   `attendance:marked` (updates counts)
-   `evaluation:submitted` (updates completion %)
-   `winner:announced` (flashes on screen)

---

## 7. Certificate Generation Flow

1.  **Trigger**: Admin clicks "Generate Certificates" or Session ends.
2.  **Validation**: Check attendance status (Must be 'Present').
3.  **Fetch**: Get Template from S3 and User Data from DB.
4.  **Process**: Use library `pdf-lib` or `puppeteer` to overlay text (Name, ID, Rank) onto PDF.
5.  **Store**: Upload generated PDF to S3.
6.  **Notify**: Send email with download link (Signed URL).
