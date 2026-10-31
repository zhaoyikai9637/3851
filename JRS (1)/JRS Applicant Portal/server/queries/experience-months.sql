-- Read-only MySQL 8 query for the proposed shared schema (not yet deployed).
-- Bind :as_of to YYYY-MM-01 and :min_months to an integer, e.g. 12.
-- Calendar months are inclusive; overlapping jobs are merged per application.
WITH ranges AS (
  SELECT application_id, experience_id, start_date,
    LEAST(COALESCE(end_date, CAST(:as_of AS DATE)), CAST(:as_of AS DATE)) AS finish
  FROM APPLICANT_WORK_EXPERIENCE
  WHERE start_date <= CAST(:as_of AS DATE)
), boundaries AS (
  SELECT *, MAX(finish) OVER (
    PARTITION BY application_id ORDER BY start_date, experience_id
    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS previous_finish FROM ranges
), groups AS (
  SELECT *, SUM(CASE WHEN previous_finish IS NULL OR start_date > DATE_ADD(previous_finish, INTERVAL 1 MONTH) THEN 1 ELSE 0 END)
    OVER (PARTITION BY application_id ORDER BY start_date, experience_id) AS group_id
  FROM boundaries
), merged AS (
  SELECT application_id, group_id, MIN(start_date) AS first_month, MAX(finish) AS last_month
  FROM groups GROUP BY application_id, group_id
)
SELECT application_id, SUM(TIMESTAMPDIFF(MONTH, first_month, last_month) + 1) AS experience_months
FROM merged GROUP BY application_id
HAVING experience_months >= :min_months;
