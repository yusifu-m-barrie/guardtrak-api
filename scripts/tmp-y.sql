SELECT u."employeeId", u."firstName", o.id AS officer_profile_id, o."officerNumber"
FROM officer_profiles o
JOIN users u ON u.id = o."userId"
WHERE u."employeeId" = '3185' OR u."firstName" ILIKE '%Yusifu%';
