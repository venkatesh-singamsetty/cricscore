-- Clean up any duplicate/orphan legal deliveries in ball_events caused by undo + re-score race conditions.
-- Retains the latest legal delivery row for each (inning_id, over_number, ball_number) while preserving extras (WIDE, NO_BALL) and retirements.
DELETE FROM ball_events b1
USING ball_events b2
WHERE b1.inning_id = b2.inning_id
  AND b1.over_number = b2.over_number
  AND b1.ball_number = b2.ball_number
  AND b1.id <> b2.id
  AND UPPER(COALESCE(b1.extra_type, 'NONE')) NOT IN ('WIDE', 'NO_BALL')
  AND UPPER(COALESCE(b1.wicket_type, 'NONE')) NOT IN ('RETIRED_HURT', 'RETIRED_OUT')
  AND UPPER(COALESCE(b2.extra_type, 'NONE')) NOT IN ('WIDE', 'NO_BALL')
  AND UPPER(COALESCE(b2.wicket_type, 'NONE')) NOT IN ('RETIRED_HURT', 'RETIRED_OUT')
  AND (
    b1.created_at < b2.created_at
    OR (b1.created_at = b2.created_at AND b1.id::text < b2.id::text)
  );
