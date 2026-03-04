# Bar Chores App — Application Flowchart

> Gamified bar staff task management system with three user roles.

---

## 1. High-Level Overview

```mermaid
flowchart TB
    subgraph APP["🍺 Bar Chores App"]
        direction TB

        LOGIN{"Login Screen"}

        LOGIN -->|"Email + Password"| SA["Super Admin"]
        LOGIN -->|"Email + Password"| VA["Venue Admin"]
        LOGIN -->|"Venue → Profile → PIN"| ST["Staff"]

        subgraph SA_FLOW["Super Admin"]
            SA --> SA1["Manage Venues"]
            SA --> SA2["Assign Venue Admins"]
        end

        subgraph VA_FLOW["Venue Admin"]
            VA --> VA1["Dashboard & Analytics"]
            VA --> VA2["Manage Staff"]
            VA --> VA3["Manage Tasks"]
            VA --> VA4["Review Submissions"]
            VA --> VA5["Approve Rewards"]
            VA --> VA6["Venue Theme"]
        end

        subgraph ST_FLOW["Staff"]
            ST --> ST1["View Dashboard"]
            ST --> ST2["Claim & Complete Tasks"]
            ST --> ST3["Leaderboard"]
            ST --> ST4["Redeem Rewards"]
            ST --> ST5["Edit Profile"]
        end
    end

    style APP fill:#1a1a2e,color:#fff
    style SA_FLOW fill:#4a1942,color:#fff
    style VA_FLOW fill:#16213e,color:#fff
    style ST_FLOW fill:#0f3460,color:#fff
```

---

## 2. Authentication Flows

### Admin & Super Admin Login

```mermaid
flowchart LR
    A["Admin visits /login\nor /superadmin/login"] --> B["Enter email + password"]
    B --> C["Supabase Auth\nsignInWithPassword"]
    C --> D{"Auth success?"}
    D -->|No| E["Show error message"]
    E --> B
    D -->|Yes| F["Fetch profile via REST API"]
    F --> G{"Role check"}
    G -->|super_admin| H["/superadmin"]
    G -->|venue_admin| I["/admin/dashboard"]
    G -->|wrong role| J["Redirect to correct login"]
```

### Staff Login (PIN-Based)

```mermaid
flowchart TD
    A["Staff visits /staff-login"] --> B["Select Venue\nfrom grid"]
    B --> C["Venue theme\ncolors applied"]
    C --> D["Select Profile\nfrom card grid"]
    D --> E["Enter PIN"]
    E --> F["Call Edge Function\nstaff-auth"]

    F --> G{"PIN valid?"}
    G -->|No| H["Show error"]
    H --> E
    G -->|Yes| I["Edge Function returns\ncustom JWT"]
    I --> J["Verify OTP with\nSupabase Auth"]
    J --> K["Load profile"]

    K --> L{"First login?\navatar_type = NULL"}
    L -->|Yes| M["/staff/profile\nForced setup"]
    L -->|No| N["/staff/dashboard"]

    M --> O["Choose avatar\nBuilder or Photo"]
    O --> P["Change PIN\nfrom default"]
    P --> Q["Auto-logout"]
    Q --> A
```

---

## 3. Staff Workflow

```mermaid
flowchart TD
    START["Staff Dashboard"] --> VIEW["View Today's Tasks\n+ Activity Feed"]

    VIEW --> TASKS["/staff/tasks"]

    TASKS --> T1["My Assigned Tasks\nAdmin-assigned to me"]
    TASKS --> T2["Open Tasks\nUnassigned, claimable"]
    TASKS --> T3["Available Tasks\nSelf-assign from gallery"]
    TASKS --> T4["Propose New Task\nTitle + Description"]

    T1 --> COMPLETE
    T2 --> CLAIM["Claim Task"]
    CLAIM --> COMPLETE
    T3 --> TAKE["Take Task\nSelf-assign"]
    TAKE --> COMPLETE
    T4 --> PENDING_APPROVAL["Awaits Admin\nApproval + Points"]

    COMPLETE{"Complete Task"}
    COMPLETE -->|"No photo required"| AUTO["Auto-approved\nPoints awarded instantly"]
    COMPLETE -->|"Photo required"| PHOTO["Upload Photo\nStatus → Submitted"]

    AUTO --> CONFETTI["🎉 Confetti!\n+ Points animation"]
    PHOTO --> WAIT["Awaits Admin Review"]
    WAIT -->|Approved| CONFETTI
    WAIT -->|Rejected| REDO["Task back to pending"]

    CONFETTI --> POINTS["Points added to total"]
    POINTS --> LB["/staff/leaderboard\nRank vs teammates"]
    POINTS --> REWARDS["/staff/rewards"]

    REWARDS --> R1{"Enough points?"}
    R1 -->|"≥100 pts"| DRINK["Request Drink Ticket\n🍺 100 pts"]
    R1 -->|"≥1000 pts"| BOTTLE["Request Bottle Ticket\n🍾 1000 pts"]
    R1 -->|No| EARN["Keep earning!"]

    DRINK --> ADMIN_APPROVE["Admin approves\nCode generated"]
    BOTTLE --> ADMIN_APPROVE
    ADMIN_APPROVE --> CODE["Redemption Code\ne.g. DRK-ABC2"]

    style CONFETTI fill:#22c55e,color:#000
    style AUTO fill:#22c55e,color:#000
```

---

## 4. Venue Admin Workflow

```mermaid
flowchart TD
    DASH["Admin Dashboard"] --> STATS["View Stats\nActive Staff | Pending | Tasks Today | Points"]
    DASH --> PENDING["Review Pending\nSubmissions"]
    DASH --> LEADER["Top Performers\nToday/Week/Month/All"]
    DASH --> CAL["Weekly Calendar\nTask status overview"]

    DASH --> STAFF["/admin/users"]
    STAFF --> S1["Create Staff\nUsername + PIN via Edge Fn"]
    STAFF --> S2["Edit Staff\nName, Username"]
    STAFF --> S3["Reset PIN"]
    STAFF --> S4["Delete Staff"]

    DASH --> TASK["/admin/tasks"]
    TASK --> T1["Create Task\nTitle, Desc, Points, Photo req"]
    TASK --> T2["Toggle Active/Inactive"]
    TASK --> T3["Review Staff Proposals"]
    T3 --> T3A["Set Points + Approve"]
    T3 --> T3B["Reject Proposal"]

    DASH --> ASSIGN["/admin/assignments"]
    ASSIGN --> A1["Assign Task to Staff\nor leave Open"]
    ASSIGN --> A2["Review Photo Submissions"]
    A2 --> A3{"Approve or Reject?"}
    A3 -->|Approve| A4["Points awarded\nto staff member"]
    A3 -->|Reject| A5["Task back to pending\nStaff notified"]

    DASH --> REWARD["/admin/rewards"]
    REWARD --> R1["Review Reward Requests"]
    R1 --> R2{"Approve?"}
    R2 -->|Yes| R3["Generate code\nDeduct points"]
    R2 -->|No| R4["Reject request"]
    R3 --> R5["Mark as Used\nwhen redeemed at bar"]

    DASH --> THEME["/admin/theme"]
    THEME --> TH1["Set Colors\nPrimary, Accent, Background"]
    THEME --> TH2["Upload Logo"]
    THEME --> TH3["Custom App Name"]
    THEME --> TH4["Live Preview"]

    style DASH fill:#2563eb,color:#fff
    style A4 fill:#22c55e,color:#000
```

---

## 5. Super Admin Workflow

```mermaid
flowchart LR
    SA["Super Admin\nDashboard"] --> V1["Create Venue\nName + Address → auto-slug"]
    SA --> V2["Delete Venue\nCascade all data"]
    SA --> V3["View All Venues\nwith admin list"]
    SA --> A1["Assign Admin\nto Venue"]
    SA --> A2["Remove Admin\nfrom Venue"]

    V1 --> AUTO["Auto-creates\nvenue_settings row"]

    style SA fill:#7c3aed,color:#fff
```

---

## 6. Task Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: Admin creates task\nor Staff proposes

    state Created {
        Proposed --> Active: Admin approves\n(sets points)
        Proposed --> Rejected: Admin rejects
        Active --> Inactive: Admin deactivates
        Inactive --> Active: Admin reactivates
    }

    Active --> Assigned: Admin assigns to staff\nor staff claims/takes

    state Assignment {
        Pending --> Submitted: Staff completes
        Submitted --> Approved: Admin approves\n(or auto if no photo)
        Submitted --> RejectedA: Admin rejects
        RejectedA --> Pending: Staff can retry
    }

    Assigned --> Assignment
    Approved --> PointsAwarded: Points ledger entry\n(positive delta)
    PointsAwarded --> [*]

    note right of Approved
        If task is recurring,
        pg_cron resets it
        nightly for next day
    end note
```

---

## 7. Points & Rewards Flow

```mermaid
flowchart TD
    subgraph EARN["Earning Points"]
        TASK_DONE["Task Approved"] --> LEDGER_POS["Points Ledger\n+ positive delta"]
        LEDGER_POS --> TRIGGER["DB Trigger\nupdates points_total"]
        TRIGGER --> PROFILE["Profile\npoints_total updated"]
    end

    subgraph SPEND["Spending Points"]
        REQUEST["Staff requests\nreward"] --> ADMIN_REV["Admin reviews"]
        ADMIN_REV -->|Approve| LEDGER_NEG["Points Ledger\n- negative delta"]
        ADMIN_REV -->|Reject| DENIED["Request denied\npoints kept"]
        LEDGER_NEG --> TRIGGER2["DB Trigger\nupdates points_total"]
        TRIGGER2 --> CODE["Redemption code\ngenerated"]
    end

    subgraph DISPLAY["Live Displays"]
        PROFILE --> LEADERBOARD["Leaderboard\nranked by points"]
        PROFILE --> DASH_POINTS["Dashboard\npoints card"]
        PROFILE --> REWARD_BAL["Rewards page\nbalance check"]
    end

    subgraph REALTIME["Realtime Updates"]
        LEDGER_POS --> RT["Supabase Realtime\npoints_ledger INSERT"]
        LEDGER_NEG --> RT
        RT --> ACTIVITY["Activity Feed\nstaff dashboard"]
        RT --> LB_UPDATE["Leaderboard\nauto-refresh"]
        RT --> ADMIN_DASH["Admin dashboard\nlive stats"]
    end

    style EARN fill:#166534,color:#fff
    style SPEND fill:#991b1b,color:#fff
    style REALTIME fill:#1e40af,color:#fff
```

---

## 8. Data Flow Architecture

```mermaid
flowchart TD
    subgraph CLIENT["Frontend (React + Vite)"]
        UI["React Components"]
        AUTH_CTX["Auth Context\nsession, profile, role"]
        VENUE_CTX["Venue Context\nsettings, theme"]
        ROUTER["React Router\nrole-based routing"]
    end

    subgraph SUPABASE["Supabase Backend"]
        SB_AUTH["Supabase Auth\nemail/password login"]
        EDGE["Edge Functions\nstaff-auth (JWT)\nstaff-create"]
        DB["PostgreSQL"]
        RLS["Row Level Security\n24 policies"]
        TRIGGERS["Triggers\npoints_total\nvenue_settings\nupdated_at"]
        CRON["pg_cron\nnightly task reset"]
        REALTIME2["Realtime\npoints_ledger events"]
        STORAGE["Storage Buckets\ntask-photos\nprofile-pictures\nvenue-assets"]
    end

    UI --> AUTH_CTX
    UI --> VENUE_CTX
    AUTH_CTX --> SB_AUTH
    AUTH_CTX --> EDGE
    UI --> DB
    DB --> RLS
    RLS --> TRIGGERS
    CRON --> DB
    DB --> REALTIME2
    REALTIME2 --> UI
    UI --> STORAGE

    style CLIENT fill:#0f172a,color:#fff
    style SUPABASE fill:#1e3a5f,color:#fff
```

---

## 9. Route Map

```mermaid
flowchart TD
    ROOT["/"] --> LOGIN_ROUTES
    ROOT --> PROTECTED_ROUTES
    ROOT --> NOT_FOUND["/* → 404"]

    subgraph LOGIN_ROUTES["Public Routes"]
        L1["/login\nAdmin Login"]
        L2["/staff-login\nStaff PIN Login"]
        L3["/superadmin/login\nSuper Admin Login"]
    end

    subgraph PROTECTED_ROUTES["Protected Routes"]
        subgraph SA_ROUTES["Super Admin"]
            SA1["/superadmin\nDashboard"]
        end

        subgraph ADMIN_ROUTES["Venue Admin — AdminLayout"]
            A1["/admin/dashboard"]
            A2["/admin/users"]
            A3["/admin/tasks"]
            A4["/admin/assignments"]
            A5["/admin/rewards"]
            A6["/admin/theme"]
        end

        subgraph STAFF_ROUTES["Staff — StaffLayout"]
            S1["/staff/dashboard"]
            S2["/staff/tasks"]
            S3["/staff/leaderboard"]
            S4["/staff/rewards"]
            S5["/staff/profile"]
        end
    end

    PROTECTED_ROUTES --> GUARD["RequireAuth\nRole check + redirect"]

    style LOGIN_ROUTES fill:#374151,color:#fff
    style SA_ROUTES fill:#581c87,color:#fff
    style ADMIN_ROUTES fill:#1e3a5f,color:#fff
    style STAFF_ROUTES fill:#064e3b,color:#fff
```

---

## 10. Database Schema Relationships

```mermaid
erDiagram
    VENUES ||--o{ PROFILES : "has staff & admins"
    VENUES ||--|| VENUE_SETTINGS : "has settings"
    VENUES ||--o{ TASKS : "has tasks"
    VENUES ||--o{ TASK_ASSIGNMENTS : "has assignments"
    VENUES ||--o{ POINTS_LEDGER : "tracks points"
    VENUES ||--o{ REWARD_REDEMPTIONS : "tracks rewards"

    PROFILES ||--o{ TASK_ASSIGNMENTS : "assigned to"
    PROFILES ||--o{ POINTS_LEDGER : "earns/spends"
    PROFILES ||--o{ REWARD_REDEMPTIONS : "redeems"
    PROFILES ||--o{ TASKS : "proposes"

    TASKS ||--o{ TASK_ASSIGNMENTS : "assigned as"
    TASK_ASSIGNMENTS ||--o| POINTS_LEDGER : "awards points"

    VENUES {
        uuid id PK
        text name
        text address
        text slug
    }
    VENUE_SETTINGS {
        uuid id PK
        uuid venue_id FK
        text primary_color
        text accent_color
        text background_color
        text logo_url
        text app_name
    }
    PROFILES {
        uuid id PK
        uuid venue_id FK
        text role
        text username
        text display_name
        text pin_hash
        text email
        text avatar_type
        text avatar_url
        jsonb avatar_config
        int points_total
    }
    TASKS {
        uuid id PK
        uuid venue_id FK
        text title
        text description
        int points
        bool requires_photo
        bool is_recurring
        bool is_active
        text approval_status
    }
    TASK_ASSIGNMENTS {
        uuid id PK
        uuid task_id FK
        uuid venue_id FK
        uuid assigned_to FK
        date due_date
        text status
        timestamp completed_at
        text photo_url
    }
    POINTS_LEDGER {
        uuid id PK
        uuid profile_id FK
        uuid venue_id FK
        int delta
        text reason
        uuid assignment_id FK
    }
    REWARD_REDEMPTIONS {
        uuid id PK
        uuid profile_id FK
        uuid venue_id FK
        text reward_type
        int points_spent
        text status
        text redemption_code
    }
```

---

*Generated for Bar Chores App v1.8.2 — March 2026*
