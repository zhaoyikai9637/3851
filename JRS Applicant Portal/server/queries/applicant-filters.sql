-- Read-only example against the proposed shared schema (not yet deployed).
-- Bind :country_code as ISO 3166-1 alpha-2 (e.g. SG), :skill_code as a catalog
-- code (e.g. REACT). Omit either predicate in the calling query if not filtering it.
-- One row per application even when several jobs contain the same skill.
SELECT d.application_id, d.candidate_id, d.position_id,
       d.country_code, d.state_code, d.city_name
FROM APPLICANT_APPLICATION_DETAILS AS d
WHERE d.country_code = :country_code
  AND EXISTS (
    SELECT 1 FROM APPLICANT_WORK_EXPERIENCE AS e
    JOIN APPLICANT_WORK_SKILL AS s ON s.experience_id = e.experience_id
    WHERE e.application_id = d.application_id AND s.skill_code = :skill_code
  );

-- For a minimum employment duration, join application_id to the result of
-- experience-months.sql. Do not add up individual job durations: overlaps
-- would otherwise count the same calendar month more than once.
