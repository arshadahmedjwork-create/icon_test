---
description: Step-by-step workflow for implementing MIDAS SRS requirements
---

# MIDAS Implementation Workflow

This workflow outlines the sequence of technical tasks required to align the current Admin/Core Team dashboard implementation with the approved SRS.

## Phase 1: Core Logic & Intelligence (The "Brain")

### 1.1 Master Data Refinement
- **Objective**: Ensure all necessary constraints exist for automation.
- [ ] **Update Judge Model**: Add `college_id` or `exclusion_list` to `Judge` type to support "Academic judge must not belong to participating colleges" rule.
- [ ] **Update Student/Abstract Model**: Ensure `college` is a mandatory structured field (not free text) for conflict matching.
- [ ] **Refine Event Config**: Verify `capacities` object in `EventConfig` matches specific SRS numbers (10-12 Online Paper, 8 Offline, etc.).

### 1.2 Session Allocation Engine (FR-4 & FR-5)
- **Objective**: Automate the complex manual task of scheduling.
- [ ] **Create `autoScheduler.ts` Service**:
    - Input: List of Approved Abstracts + Judge Pool + Event Config.
    - Logic:
        - Group by Subject + Mode + Type.
        - Split large groups into Sessions based on Capacity.
        - Assign Judges: Pick 1 Academic + 2 Non-Academic.
        - **Constraint Check**: Ensure Academic Judge College != Student College in that session.
- [ ] **UI Integration**: Add "Auto-Schedule" button in `SessionManagement.tsx` to trigger this service and preview results.

## Phase 2: Pre-Event Operations

### 2.1 Registration & Verification (FR-1)
- **Objective**: Manage student entry.
- [ ] **Staff Dashboard**: Implement "Verify Student" view.
- [ ] **MIDAS ID Generation**: Create a utility to generate unique IDs (e.g., `MID-2026-001`) upon approval.

### 2.2 Abstract Workflow (FR-3)
- **Objective**: Manage scientific content.
- [ ] **Abstract Status Flow**: Implement `Submitted` -> `Under Review` -> `Accepted` -> `Revision` logic.
- [ ] **Email Triggers**: Mock the "Provisional Acceptance Email" notification.

## Phase 3: Event Day Execution

### 3.1 Live Evaluation Module (FR-6)
- **Objective**: Real-time scoring.
- [ ] **Judge Session View**: Create a view for Judges to see their assigned current session.
- [ ] **Scoring Form**:
    - enforce "All criteria must be filled".
    - Allow score modification until "Final Submit".

### 3.2 Attendance & Monitoring
- **Objective**: Verify presence.
- [ ] **Moderator View**: Simple list to mark "Present/Absent" for students in a session.

## Phase 4: Post-Event Automation

### 4.1 Result Calculation (FR-7)
- **Objective**: Determine winners.
- [ ] **Winner Logic**:
    - Calculate Session Toppers (1st, 2nd, 3rd).
    - Handle Ties (Weightage based or shared rank).
    - **Subject Topper**: Compare 1st place winners across sessions of same subject.
- [ ] **Results Dashboard**: Enhance `ResultsViewer.tsx` to show these specific breakdowns.

### 4.2 Certificates
- **Objective**: Distribute credentials.
- [ ] **Certificate Generator**: Create logic to generate/serve a placeholder PDF with dynamic names/ranks.
- [ ] **Email Dispatch**: Mock the "Send All Certificates" action.
