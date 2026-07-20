# Assignment Overlap Policy

Active assignments conflict when:

- same officer
- status in `ASSIGNED`, `CONFIRMED`, `IN_PROGRESS`
- shift ranges overlap: `existingStart < proposedEnd AND existingEnd > proposedStart`

Overnight shifts are supported via absolute UTC timestamps.

`CANCELLED`, `REASSIGNED`, `MISSED`, and `COMPLETED` do not block new assignments.

Checks run inside create/batch/reassign transactions. Stronger DB exclusion constraints may be added later.
