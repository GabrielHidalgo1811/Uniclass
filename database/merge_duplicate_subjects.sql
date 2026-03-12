-- CLEANUP SCRIPT: Merge duplicate subjects
-- This script merges subjects with the same name (case-insensitive) for each user.
-- It keeps the first one found and updates all related records to point to it.

DO $$ 
DECLARE 
    r RECORD;
    master_id UUID;
BEGIN
    -- Loop through duplicate subject names per user
    FOR r IN (
        SELECT user_id, LOWER(TRIM(name)) as clean_name, MIN(id::text)::uuid as first_id
        FROM subjects
        GROUP BY user_id, LOWER(TRIM(name))
        HAVING COUNT(*) > 1
    ) LOOP
        master_id := r.first_id;

        -- Update schedule_classes
        UPDATE schedule_classes
        SET subject_id = master_id
        WHERE subject_id IN (
            SELECT id FROM subjects 
            WHERE user_id = r.user_id 
            AND LOWER(TRIM(name)) = r.clean_name
            AND id != master_id
        );

        -- Update grades
        UPDATE grades
        SET subject_id = master_id
        WHERE subject_id IN (
            SELECT id FROM subjects 
            WHERE user_id = r.user_id 
            AND LOWER(TRIM(name)) = r.clean_name
            AND id != master_id
        );

        -- Update reminders
        UPDATE reminders
        SET subject_id = master_id
        WHERE subject_id IN (
            SELECT id FROM subjects 
            WHERE user_id = r.user_id 
            AND LOWER(TRIM(name)) = r.clean_name
            AND id != master_id
        );

        -- Delete the duplicate subjects
        DELETE FROM subjects
        WHERE user_id = r.user_id 
        AND LOWER(TRIM(name)) = r.clean_name
        AND id != master_id;
        
    END LOOP;
END $$;
