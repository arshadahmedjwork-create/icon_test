-- 1. Insert 4 Mock Students into event_students
-- Assuming generic bcrypt hash for "password123" is: $2b$10$Ep5.ZIfXwQ1WpA06E59lOOUo1FZZmXj0eDqfK8Y9FqZ4Vw8mK4B.m
INSERT INTO event_students ("participantName", email, mobile, password, college, course, year, "approvalStatus", "paymentStatus", "profileStatus", "registeredAt")
VALUES 
('Alice Sharma', 'alice@student.com', '9876543210', '$2b$10$Ep5.ZIfXwQ1WpA06E59lOOUo1FZZmXj0eDqfK8Y9FqZ4Vw8mK4B.m', 'Saveetha Dental College', 'BDS', '3rd Year', 'APPROVED', 'PAID', 'COMPLETED', NOW()),
('Bob Singh', 'bob@student.com', '8765432109', '$2b$10$Ep5.ZIfXwQ1WpA06E59lOOUo1FZZmXj0eDqfK8Y9FqZ4Vw8mK4B.m', 'SRM Dental College', 'MDS - Orthodontics', '1st Year', 'APPROVED', 'PAID', 'COMPLETED', NOW()),
('Charlie Patel', 'charlie@student.com', '7654321098', '$2b$10$Ep5.ZIfXwQ1WpA06E59lOOUo1FZZmXj0eDqfK8Y9FqZ4Vw8mK4B.m', 'Manipal College of Dental Sciences', 'BDS', '4th Year', 'PENDING', 'PENDING', 'INCOMPLETE', NOW()),
('Diana Reddy', 'diana@student.com', '6543210987', '$2b$10$Ep5.ZIfXwQ1WpA06E59lOOUo1FZZmXj0eDqfK8Y9FqZ4Vw8mK4B.m', 'Govt Dental College Chennai', 'MDS - Periodontics', '2nd Year', 'APPROVED', 'PAID', 'COMPLETED', NOW());


-- 2. Insert 2 Mock Judges into members
-- We need the returned member IDs to link to the 'judges' table.
-- Supabase supports WITH queries, but let's just use raw UUIDs for simplicity in this mock script
DO $$
DECLARE
    judge1_id uuid := gen_random_uuid();
    judge2_id uuid := gen_random_uuid();
BEGIN
    INSERT INTO members (id, email, password, name, role, "isActive", "mustChangePassword")
    VALUES 
    (judge1_id, 'judge1@example.com', '$2b$10$Ep5.ZIfXwQ1WpA06E59lOOUo1FZZmXj0eDqfK8Y9FqZ4Vw8mK4B.m', 'Dr. Smith', 'JUDGE', true, false),
    (judge2_id, 'judge2@example.com', '$2b$10$Ep5.ZIfXwQ1WpA06E59lOOUo1FZZmXj0eDqfK8Y9FqZ4Vw8mK4B.m', 'Dr. Jones', 'JUDGE', true, false);

    -- 3. Insert Judge Profiles linking back to the members
    INSERT INTO judges ("memberId", "fullName", "isAcademic", college, specialization, time_slots)
    VALUES 
    (judge1_id, 'Dr. Smith', true, 'Saveetha Dental College', 'Oral Surgery', '["Morning", "Afternoon"]'::jsonb),
    (judge2_id, 'Dr. Jones', false, 'Private Practice', 'Orthodontics', '["Morning"]'::jsonb);
END $$;
