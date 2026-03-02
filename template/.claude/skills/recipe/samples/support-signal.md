# Sample: SupportSignal (NDIS Disability Support)

A support coordination app for disability service providers. Tracks companies, their group homes (sites), workers (users), and the incidents and journal entries that happen during shifts.

**Use with**: `file-crud` recipe. Optionally combine with `nav-shell` recipe.

---

## Entities

### Company
The service provider organisation.

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | **namish field** — used for file slug |
| `abn` | string | Australian Business Number |
| `address` | string | |
| `phone` | string | optional |

Namish field: `name`
Example filename: `sunrise-disability-services-a3kp7.json`

---

### Site (Group Home)
A physical location run by a Company.

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | **namish field** |
| `address` | string | |
| `companyId` | string | FK → Company (5-char ID) |
| `capacity` | number | number of residents |

Namish field: `name`
Example filename: `northside-house-b7m2x.json`
Relationship: `companyId` → Company

---

### User (Worker / Staff)
A staff member who works at one or more sites.

| Field | Type | Notes |
|-------|------|-------|
| `firstName` | string | |
| `lastName` | string | |
| `email` | string | |
| `companyId` | string | FK → Company |
| `role` | string | e.g. 'support-worker', 'coordinator', 'admin' |

Namish field: composite `${firstName}-${lastName}` → `john-smith-x9q2m.json`
Relationship: `companyId` → Company

---

### Incident
Something significant that happened at a site, involving a participant.

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | **namish field** — brief description |
| `date` | string | ISO date |
| `siteId` | string | FK → Site |
| `reportedBy` | string | FK → User (5-char ID) |
| `participantName` | string | name of the person involved |
| `severity` | string | 'low' / 'medium' / 'high' |
| `beforeDescription` | string | what happened before the incident |
| `duringDescription` | string | what happened during |
| `afterDescription` | string | what happened after |

Namish field: `title`
Example filename: `fall-in-bathroom-incident-c5r8k.json`
Relationships: `siteId` → Site, `reportedBy` → User

---

### MomentThatMatters (Journal Entry)
A brief observation recorded by a worker during a shift.

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | **namish field** — brief label |
| `content` | string | the observation |
| `date` | string | ISO date and time |
| `siteId` | string | FK → Site |
| `userId` | string | FK → User (author) |
| `participantName` | string | optional — who this is about |
| `tags` | string[] | optional — e.g. ['wellbeing', 'behaviour'] |

Namish field: `title`
Example filename: `morning-routine-positive-d2k9p.json`
Relationships: `siteId` → Site, `userId` → User

---

## Entity Classification

| Entity | Type | Notes |
|--------|------|-------|
| Company | System / configuration | Set up once, rarely changes |
| Site | System / configuration | Set up once per location |
| User | System / configuration | Managed by admin |
| Incident | Domain / operational | Created frequently during service |
| MomentThatMatters | Domain / operational | Created every shift |

---

## Suggested Nav Mapping (for nav-shell recipe)

| Nav Item | View Key | Entity | Tier |
|----------|----------|--------|------|
| Dashboard | `dashboard` | — (summary stats) | primary |
| Companies | `companies` | Company | primary |
| Sites | `sites` | Site | primary |
| Users | `users` | User | secondary |
| Incidents | `incidents` | Incident | primary |
| Journal | `journal` | MomentThatMatters | primary |

---

## Data Folder Structure

```
data/
├── companies/
│   └── sunrise-disability-services-a3kp7.json
├── sites/
│   └── northside-house-b7m2x.json
├── users/
│   └── john-smith-x9q2m.json
├── incidents/
│   └── fall-in-bathroom-incident-c5r8k.json
└── moments-that-matter/
    └── morning-routine-positive-d2k9p.json
```

---

## Notes

- Sites and Users are filtered by Company in practice (show only sites/users belonging to the selected company). This filtering is the developer's responsibility after scaffolding.
- Incidents and MomentThatMatters link to a Site — so when a user is "at" a site, the app should pre-fill `siteId` based on context. Not part of the recipe; developer-implemented.
- The `participantName` is stored as a plain string here (not a separate Participant entity) to keep the system simple. A Participant entity can be added as a future extension.
