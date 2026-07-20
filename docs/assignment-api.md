# Assignment API

Base path: `/api/v1/assignments`

## Endpoints

| Method | Path | Permission |
|--------|------|------------|
| POST | `/assignments` | `assignment:create` |
| POST | `/assignments/batch` | `assignment:create` |
| GET | `/assignments` | `assignment:read` |
| GET | `/assignments/current` | `assignment:read:self` |
| GET | `/assignments/upcoming` | `assignment:read:self` |
| GET | `/assignments/:id` | self / supervisor / admin (service) |
| PATCH | `/assignments/:id/status` | `assignment:update` |
| POST | `/assignments/:id/confirm` | `assignment:confirm:self` |
| POST | `/assignments/:id/reassign` | `assignment:reassign` |
| DELETE | `/assignments/:id` | `assignment:cancel` → soft cancel |

## Create rules

- Shift must be DRAFT or SCHEDULED
- Officer ACTIVE; supervisor valid when supplied
- No duplicate active assignment for same officer+shift
- Overlap detection → `ASSIGNMENT_TIME_CONFLICT`
- Batch is all-or-nothing inside a transaction

See also: [assignment-overlap-policy.md](./assignment-overlap-policy.md)
