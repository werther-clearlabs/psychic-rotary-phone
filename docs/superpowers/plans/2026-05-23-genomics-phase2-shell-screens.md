# Genomics Portal — Phase 2: Shell & Screens

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Design system CSS, sidebar Clinical section, root redirect, Zustand store, and all list/detail screens (Dashboard, Case list, Case detail, Run list, Run detail, Protocol library).

**Prerequisite:** Phase 1 complete (`docs/superpowers/plans/2026-05-23-genomics-phase1-foundation.md`).

**Architecture:** New `/genomics` TanStack route group with a layout wrapper that imports the Clear Labs CSS tokens. Sidebar gets a Clinical section above Workspace items. Screens use React Query to fetch from the Phase 1 API routes. Report & Review tab (Monaco canvas) is Phase 3.

**Tech Stack:** TanStack Router (file-based routes), React Query, Zustand, `@monaco-editor/react` (Phase 3 only), Clear Labs design tokens (CSS custom properties), Hugeicons (`@hugeicons/core-free-icons`)

---

### Task 1: Clear Labs design system CSS

**Files:**
- Create: `src/styles/genomics/tokens.css`

- [ ] **Step 1: Create the CSS tokens file**

This file contains all Clear Labs V3.0 design tokens. Import it only in the genomics layout route — never globally.

```css
/* src/styles/genomics/tokens.css */
:root {
  /* Brand */
  --brand-50:  oklch(0.98 0.0079 216.62);
  --brand-100: oklch(0.907 0.031 226.1);
  --brand-200: oklch(0.814 0.06 225.7);
  --brand-300: oklch(0.724 0.088 227.6);
  --brand-400: oklch(0.637 0.11 230.3);
  --brand-500: oklch(0.559 0.122 237);
  --brand-600: oklch(0.476 0.103 236.1);
  --brand-700: oklch(0.39 0.083 235.4);
  --brand-800: oklch(0.298 0.062 233);
  --brand-900: oklch(0.2 0.039 229);
  --brand-950: oklch(0.22 0.0424 228.69);

  /* Greyscale */
  --gray-50:  oklch(0.99 0.0013 286.38);
  --gray-100: oklch(0.985 0.002 247.839);
  --gray-200: oklch(0.974 0.004 237);
  --gray-300: oklch(0.937 0.01 248.1);
  --gray-400: oklch(0.851 0.018 253.4);
  --gray-500: oklch(0.771 0.022 261.8);
  --gray-600: oklch(0.678 0.03 263.4);
  --gray-700: oklch(0.551 0.035 263.4);
  --gray-800: oklch(0.426 0.027 263);
  --gray-900: oklch(0.308 0.02 260.6);
  --gray-950: oklch(0.28 0.0062 258.36);
  --white: oklch(1 0 0);
  --black: oklch(0 0 0);

  /* Semantic — green */
  --color-green-100: oklch(0.95 0.05 145);
  --color-green-500: oklch(0.55 0.17 145);
  --color-green-600: oklch(0.47 0.15 145);

  /* Semantic — yellow */
  --color-yellow-100: oklch(0.97 0.06 90);
  --color-yellow-500: oklch(0.75 0.17 75);
  --color-yellow-600: oklch(0.65 0.16 75);

  /* Semantic — red */
  --color-red-100: oklch(0.96 0.04 20);
  --color-red-500: oklch(0.55 0.22 25);
  --color-red-600: oklch(0.47 0.20 25);

  /* Spacing (8pt grid) */
  --cl-space-1: 4px;
  --cl-space-2: 8px;
  --cl-space-3: 12px;
  --cl-space-4: 16px;
  --cl-space-5: 20px;
  --cl-space-6: 24px;
  --cl-space-8: 32px;
  --cl-space-10: 40px;
  --cl-space-12: 48px;

  /* Radii */
  --cl-radius-xs: 2px;
  --cl-radius-sm: 3px;
  --cl-radius-md: 5px;
  --cl-radius-lg: 6px;
  --cl-radius-pill: 999px;

  /* Elevation */
  --cl-shadow-1: 0px 6px 16px 0px rgba(0, 0, 0, 0.1);
  --cl-shadow-focus: 0 0 0 3px rgba(0, 125, 178, 0.30);

  /* Motion */
  --cl-ease: cubic-bezier(0.4, 0, 0.2, 1);
  --cl-dur-fast: 120ms;
  --cl-dur: 180ms;
  --cl-dur-slow: 240ms;
}

/* Genomics page baseline — applied to the layout wrapper */
.cl-page {
  background: var(--gray-100);
  color: var(--gray-900);
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 22px;
  min-height: 100vh;
}

/* Title bar */
.cl-title-bar {
  height: 56px;
  background: var(--white);
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  align-items: center;
  padding: 0 var(--cl-space-6);
  gap: var(--cl-space-4);
}
.cl-title-bar h1 {
  font-size: 18px;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0;
}

/* Toolbar / tabs */
.cl-toolbar {
  height: 48px;
  background: var(--white);
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  align-items: flex-end;
  padding: 0 var(--cl-space-6);
  gap: var(--cl-space-2);
}
.cl-tab {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 var(--cl-space-4);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.44px;
  color: var(--gray-600);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color var(--cl-dur-fast) var(--cl-ease), border-color var(--cl-dur-fast) var(--cl-ease);
}
.cl-tab[aria-selected="true"],
.cl-tab.active {
  color: var(--brand-500);
  border-bottom-color: var(--brand-500);
}

/* Card */
.cl-card {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--cl-radius-md);
  box-shadow: none;
}
.cl-card:hover { box-shadow: var(--cl-shadow-1); }

/* Status stripe (4px left border) */
.cl-status-stripe { border-left: 4px solid var(--gray-400); }
.cl-status-stripe.completed { border-left-color: var(--color-green-500); }
.cl-status-stripe.running { border-left-color: var(--brand-500); }
.cl-status-stripe.failed { border-left-color: var(--color-red-500); }
.cl-status-stripe.queued { border-left-color: var(--gray-400); }

/* Buttons */
.cl-btn {
  border-radius: var(--cl-radius-sm);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background var(--cl-dur-fast) var(--cl-ease);
  border: none;
  outline: none;
}
.cl-btn:focus-visible { box-shadow: var(--cl-shadow-focus); }
.cl-btn-sm { padding: 4px 12px; }
.cl-btn-md { padding: 8px 20px; }
.cl-btn-primary { background: var(--brand-500); color: var(--white); }
.cl-btn-primary:hover { background: var(--brand-600); }
.cl-btn-secondary { background: transparent; border: 1px solid var(--brand-500); color: var(--brand-600); }
.cl-btn-secondary:hover { background: var(--brand-50); }
.cl-btn-tertiary { background: transparent; color: var(--gray-900); }

/* Table */
.cl-table { width: 100%; border-collapse: collapse; }
.cl-table th {
  height: 40px; text-align: left; padding: 0 var(--cl-space-4);
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.44px;
  color: var(--gray-700); background: var(--white); border-bottom: 1px solid var(--gray-200);
}
.cl-table td {
  height: 48px; padding: 0 var(--cl-space-4);
  font-size: 12px; color: var(--gray-900); border-bottom: 1px solid var(--gray-200);
}
.cl-table tr:hover td { background: var(--gray-200); cursor: pointer; }

/* Status badge chip */
.cl-badge {
  display: inline-flex; align-items: center;
  padding: 2px 6px; border-radius: var(--cl-radius-xs);
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.44px;
  font-family: 'Helvetica Condensed', Helvetica, Arial, sans-serif;
}
.cl-badge-active   { background: var(--color-green-100); color: var(--color-green-600); }
.cl-badge-closed   { background: var(--gray-200); color: var(--gray-700); }
.cl-badge-pending  { background: var(--color-yellow-100); color: var(--color-yellow-600); }
.cl-badge-running  { background: var(--brand-100); color: var(--brand-600); }
.cl-badge-failed   { background: var(--color-red-100); color: var(--color-red-600); }
.cl-badge-queued   { background: var(--gray-200); color: var(--gray-600); }
.cl-badge-draft    { background: var(--color-yellow-100); color: var(--color-yellow-600); }
.cl-badge-signed   { background: var(--color-green-100); color: var(--color-green-600); }

/* Content area */
.cl-content { padding: var(--cl-space-6); display: flex; flex-direction: column; gap: var(--cl-space-4); }

/* Stat cards row */
.cl-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--cl-space-4); }
.cl-stat-card { padding: var(--cl-space-4); }
.cl-stat-card .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.44px; color: var(--gray-700); margin-bottom: var(--cl-space-1); }
.cl-stat-card .value { font-size: 28px; font-weight: 700; color: var(--gray-900); }

/* Pipeline stage chevron row */
.cl-stage-list { display: flex; flex-direction: column; gap: var(--cl-space-2); }
.cl-stage-row {
  display: flex; align-items: center; gap: var(--cl-space-3);
  padding: var(--cl-space-2) var(--cl-space-3);
  border-radius: var(--cl-radius-sm);
  font-size: 12px; font-family: 'Helvetica Condensed', Helvetica, Arial, sans-serif;
}
.cl-stage-row.completed { background: var(--color-green-100); border: 1px solid var(--color-green-600); color: var(--color-green-600); }
.cl-stage-row.running   { background: var(--brand-100);       border: 1px solid var(--brand-500);       color: var(--brand-600); }
.cl-stage-row.pending   { background: var(--gray-300);        border: 1px solid var(--gray-400);        color: var(--gray-700); }
.cl-stage-row.failed    { background: var(--color-red-100);   border: 1px solid var(--color-red-600);   color: var(--color-red-600); }
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/genomics/tokens.css
git commit -m "feat: Clear Labs design system CSS tokens for genomics portal"
```

---

### Task 2: Genomics-store (Zustand)

**Files:**
- Create: `src/stores/genomics-store.ts`

- [ ] **Step 1: Write the store**

```typescript
// src/stores/genomics-store.ts
import { create } from 'zustand'
import type { Case, Run, Report } from '../server/genomics/types'

interface GenomicsState {
  // Active entities (set when detail screens mount)
  activeCase: Case | null
  activeRun: Run | null
  activeReport: Report | null

  // Live run log lines keyed by runId
  runLogs: Record<string, string[]>

  // Report section currently being edited (section key e.g. "8")
  editingSection: string | null

  // Generate report modal state
  generateModalOpen: boolean
  generateProtocolId: string | null
  generateVariableOverrides: Record<string, string>

  // Actions
  setActiveCase: (c: Case | null) => void
  setActiveRun: (r: Run | null) => void
  setActiveReport: (r: Report | null) => void
  appendRunLog: (runId: string, line: string) => void
  clearRunLog: (runId: string) => void
  setEditingSection: (key: string | null) => void
  openGenerateModal: (protocolId?: string) => void
  closeGenerateModal: () => void
  setGenerateProtocolId: (id: string) => void
  setVariableOverride: (name: string, value: string) => void
  resetVariableOverrides: () => void
}

export const useGenomicsStore = create<GenomicsState>()((set) => ({
  activeCase: null,
  activeRun: null,
  activeReport: null,
  runLogs: {},
  editingSection: null,
  generateModalOpen: false,
  generateProtocolId: null,
  generateVariableOverrides: {},

  setActiveCase: (c) => set({ activeCase: c }),
  setActiveRun: (r) => set({ activeRun: r }),
  setActiveReport: (r) => set({ activeReport: r }),
  appendRunLog: (runId, line) =>
    set((s) => ({ runLogs: { ...s.runLogs, [runId]: [...(s.runLogs[runId] ?? []), line] } })),
  clearRunLog: (runId) =>
    set((s) => ({ runLogs: { ...s.runLogs, [runId]: [] } })),
  setEditingSection: (key) => set({ editingSection: key }),
  openGenerateModal: (protocolId) =>
    set({ generateModalOpen: true, generateProtocolId: protocolId ?? null, generateVariableOverrides: {} }),
  closeGenerateModal: () =>
    set({ generateModalOpen: false, generateProtocolId: null, generateVariableOverrides: {} }),
  setGenerateProtocolId: (id) => set({ generateProtocolId: id }),
  setVariableOverride: (name, value) =>
    set((s) => ({ generateVariableOverrides: { ...s.generateVariableOverrides, [name]: value } })),
  resetVariableOverrides: () => set({ generateVariableOverrides: {} }),
}))
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/genomics-store.ts
git commit -m "feat: genomics Zustand store"
```

---

### Task 3: Sidebar Clinical section

**Files:**
- Modify: `src/screens/chat/components/chat-sidebar.tsx`

The sidebar is **data-driven**, not raw JSX. Existing sections (Main, Knowledge) are arrays of `NavItemDef` (~lines 783–881) rendered via `<SectionLabel>` + `<CollapsibleSection>` (~lines 1078–1110). We add a new Clinical group following the same pattern. All required icons (`DashboardSquare01Icon`, `UserGroupIcon`, `Rocket01Icon`, `CheckListIcon`) are already imported.

- [ ] **Step 1: Add active-route booleans**

Around line 781 (just before the existing `const isDashboardActive = pathname === '/dashboard'`), add:

```typescript
const isGenomicsDashboardActive = pathname === '/genomics' || pathname === '/genomics/'
const isGenomicsCasesActive = pathname.startsWith('/genomics/cases')
const isGenomicsRunsActive = pathname.startsWith('/genomics/runs')
const isGenomicsProtocolsActive = pathname.startsWith('/genomics/protocols')
```

- [ ] **Step 2: Add a `clinicalItems` array**

Insert this block immediately before the existing `const mainItems: Array<NavItemDef> = [` (around line 783):

```typescript
const clinicalItems: Array<NavItemDef> = [
  {
    kind: 'link',
    to: '/genomics',
    icon: DashboardSquare01Icon,
    label: 'Genomics',
    active: isGenomicsDashboardActive,
  },
  {
    kind: 'link',
    to: '/genomics/cases',
    icon: UserGroupIcon,
    label: 'Cases',
    active: isGenomicsCasesActive,
  },
  {
    kind: 'link',
    to: '/genomics/runs',
    icon: Rocket01Icon,
    label: 'Runs',
    active: isGenomicsRunsActive,
  },
  {
    kind: 'link',
    to: '/genomics/protocols',
    icon: CheckListIcon,
    label: 'Protocols',
    active: isGenomicsProtocolsActive,
  },
]
```

- [ ] **Step 3: Add `clinicalExpanded` persisted state**

Find the existing `usePersistedBool` calls for `mainExpanded` and `knowledgeExpanded` (search the file for `usePersistedBool`). Alongside them, add:

```typescript
const [clinicalExpanded, setClinicalExpanded] = usePersistedBool(
  'sidebar.clinicalExpanded',
  true,
)
const toggleClinical = () => setClinicalExpanded((v) => !v)
const clinicalNav = '/genomics'
```

If the existing helpers use a different signature (e.g. a single `toggleMain` returned by a helper hook), match that pattern — the goal is parity with how Main/Knowledge sections handle expand state.

- [ ] **Step 4: Render the Clinical section in the sidebar JSX**

Find the existing `<SectionLabel label="Main" .../>` block (around line 1078). Insert this block **immediately before it** so Clinical appears at the top of the sidebar above Main:

```tsx
<SectionLabel
  label="Clinical"
  isCollapsed={isVisuallyCollapsed}
  transition={transition}
  collapsible
  expanded={clinicalExpanded}
  onToggle={toggleClinical}
  navigateTo={clinicalNav}
/>
<CollapsibleSection
  expanded={clinicalExpanded || isCollapsed}
  items={clinicalItems}
  isCollapsed={isVisuallyCollapsed}
  transition={transition}
  onSelectSession={onSelectSession}
/>
```

- [ ] **Step 5: Verify in browser**

```bash
pnpm dev
```

Open `http://localhost:3000`. Sidebar should show a new **Clinical** section above **Main**, with four items: Genomics, Cases, Runs, Protocols. Clicking each routes to `/genomics/...`. Collapsing the section should persist across reloads.

- [ ] **Step 6: Commit**

```bash
git add src/screens/chat/components/chat-sidebar.tsx
git commit -m "feat: add Clinical section to sidebar nav"
```

---

### Task 4: Root redirect + genomics layout route

**Files:**
- Modify: `src/routes/index.tsx`
- Create: `src/routes/genomics.tsx` (layout wrapper)
- Create: `src/routes/genomics/index.tsx` (dashboard)

- [ ] **Step 1: Change root redirect from /chat to /genomics**

```typescript
// src/routes/index.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  ssr: false,
  beforeLoad: function redirectToGenomics() {
    throw redirect({ to: '/genomics', replace: true })
  },
  component: function IndexRoute() {
    return null
  },
})
```

- [ ] **Step 2: Create genomics layout route**

This is the parent layout for all `/genomics/*` routes. It imports the CL tokens CSS.

```typescript
// src/routes/genomics.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'
import tokensCss from '../styles/genomics/tokens.css?url'

export const Route = createFileRoute('/genomics')({
  head: () => ({
    links: [{ rel: 'stylesheet', href: tokensCss }],
  }),
  component: function GenomicsLayout() {
    return (
      <div className="cl-page">
        <Outlet />
      </div>
    )
  },
})
```

- [ ] **Step 3: Create placeholder dashboard route**

```typescript
// src/routes/genomics/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { GenomicsDashboard } from '../../screens/genomics/dashboard-screen'

export const Route = createFileRoute('/genomics/')({
  component: GenomicsDashboard,
})
```

- [ ] **Step 4: Create placeholder dashboard screen**

```tsx
// src/screens/genomics/dashboard-screen.tsx
export function GenomicsDashboard() {
  return (
    <div>
      <div className="cl-title-bar">
        <h1>Genomics Dashboard</h1>
      </div>
      <div className="cl-content">
        <p style={{ color: 'var(--gray-700)' }}>Dashboard loading…</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify redirect and layout**

```bash
pnpm dev
```

Navigate to `http://localhost:3000/` — should redirect to `/genomics` and show "Genomics Dashboard" with the CL light theme (white title bar, light gray page background).

- [ ] **Step 6: Commit**

```bash
git add src/routes/index.tsx src/routes/genomics.tsx src/routes/genomics/index.tsx src/screens/genomics/dashboard-screen.tsx
git commit -m "feat: root redirect to /genomics, genomics layout with CL tokens"
```

---

### Task 5: Dashboard screen (real content)

**Files:**
- Modify: `src/screens/genomics/dashboard-screen.tsx`

- [ ] **Step 1: Write the real dashboard**

```tsx
// src/screens/genomics/dashboard-screen.tsx
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { Case, Run } from '../../server/genomics/types'

async function fetchCases(): Promise<Case[]> {
  const res = await fetch('/api/genomics/cases')
  if (!res.ok) throw new Error('Failed to fetch cases')
  const data = await res.json() as { cases: Case[] }
  return data.cases
}

async function fetchRuns(): Promise<Run[]> {
  const res = await fetch('/api/genomics/runs')
  if (!res.ok) throw new Error('Failed to fetch runs')
  const data = await res.json() as { runs: Run[] }
  return data.runs
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`cl-badge cl-badge-${status}`}>{status}</span>
}

export function GenomicsDashboard() {
  const { data: cases = [] } = useQuery({ queryKey: ['genomics', 'cases'], queryFn: fetchCases })
  const { data: runs = [] } = useQuery({ queryKey: ['genomics', 'runs'], queryFn: fetchRuns })

  const openCases = cases.filter((c) => c.status === 'active').length
  const activeRuns = runs.filter((r) => r.status === 'running' || r.status === 'queued').length
  const recentCases = cases.slice(0, 5)
  const activeRunsList = runs.filter((r) => r.status === 'running' || r.status === 'queued').slice(0, 5)

  return (
    <div>
      <div className="cl-title-bar">
        <h1>Genomics Dashboard</h1>
      </div>

      <div className="cl-content">
        {/* Stats */}
        <div className="cl-stats-row">
          {[
            { label: 'Open Cases', value: openCases },
            { label: 'Active Runs', value: activeRuns },
            { label: 'Total Cases', value: cases.length },
            { label: 'Total Runs', value: runs.length },
          ].map((s) => (
            <div key={s.label} className="cl-card cl-stat-card">
              <div className="label">{s.label}</div>
              <div className="value">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--cl-space-4)' }}>
          {/* Recent Cases */}
          <div className="cl-card">
            <div style={{ padding: 'var(--cl-space-4)', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Recent Cases</span>
              <Link to="/genomics/cases" style={{ fontSize: 12, color: 'var(--brand-600)' }}>View all →</Link>
            </div>
            <table className="cl-table">
              <thead><tr><th>Patient</th><th>Diagnosis</th><th>Status</th></tr></thead>
              <tbody>
                {recentCases.length === 0 && (
                  <tr><td colSpan={3} style={{ color: 'var(--gray-500)', textAlign: 'center' }}>No cases yet</td></tr>
                )}
                {recentCases.map((c) => (
                  <tr key={c.id} onClick={() => window.location.href = `/genomics/cases/${c.id}`}>
                    <td>{c.patient_name ?? '—'}</td>
                    <td style={{ color: 'var(--gray-700)' }}>{c.diagnosis ?? '—'}</td>
                    <td><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Active Runs */}
          <div className="cl-card">
            <div style={{ padding: 'var(--cl-space-4)', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Active Runs</span>
              <Link to="/genomics/runs" style={{ fontSize: 12, color: 'var(--brand-600)' }}>View all →</Link>
            </div>
            <table className="cl-table">
              <thead><tr><th>Name</th><th>Pipeline</th><th>Status</th></tr></thead>
              <tbody>
                {activeRunsList.length === 0 && (
                  <tr><td colSpan={3} style={{ color: 'var(--gray-500)', textAlign: 'center' }}>No active runs</td></tr>
                )}
                {activeRunsList.map((r) => (
                  <tr key={r.id} onClick={() => window.location.href = `/genomics/runs/${r.id}`}>
                    <td>{r.name}</td>
                    <td style={{ color: 'var(--gray-700)' }}>{r.pipeline}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser — create a test Case via API then reload dashboard**

```bash
# In a terminal while pnpm dev is running:
curl -X POST http://localhost:3000/api/genomics/cases \
  -H "Content-Type: application/json" \
  -d '{"patient_name":"Jane Doe","diagnosis":"NSCLC","stage":"IIIa","status":"active"}'
```

Reload `http://localhost:3000/genomics` — should show Jane Doe in Recent Cases with the Active badge.

- [ ] **Step 3: Commit**

```bash
git add src/screens/genomics/dashboard-screen.tsx
git commit -m "feat: genomics dashboard with live case/run stats"
```

---

### Task 6: Case list screen

**Files:**
- Create: `src/routes/genomics/cases.tsx`
- Create: `src/screens/genomics/case-list-screen.tsx`

- [ ] **Step 1: Create the route**

```typescript
// src/routes/genomics/cases.tsx
import { createFileRoute } from '@tanstack/react-router'
import { CaseListScreen } from '../../screens/genomics/case-list-screen'

export const Route = createFileRoute('/genomics/cases')({
  component: CaseListScreen,
})
```

- [ ] **Step 2: Create the screen**

```tsx
// src/screens/genomics/case-list-screen.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { Case } from '../../server/genomics/types'

async function fetchCases(): Promise<Case[]> {
  const res = await fetch('/api/genomics/cases')
  if (!res.ok) throw new Error('Failed to fetch cases')
  return ((await res.json()) as { cases: Case[] }).cases
}

async function createCase(body: Partial<Case>): Promise<Case> {
  const res = await fetch('/api/genomics/cases', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to create case')
  return ((await res.json()) as { case: Case }).case
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`cl-badge cl-badge-${status}`}>{status}</span>
}

export function CaseListScreen() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: cases = [], isLoading } = useQuery({ queryKey: ['genomics', 'cases'], queryFn: fetchCases })
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ patient_name: '', patient_id: '', diagnosis: '', stage: '', status: 'active' as const })

  const mutation = useMutation({
    mutationFn: createCase,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['genomics', 'cases'] }); setShowForm(false) },
  })

  const filtered = cases.filter((c) =>
    !filter || (c.patient_name ?? '').toLowerCase().includes(filter.toLowerCase()) ||
    (c.diagnosis ?? '').toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div>
      <div className="cl-title-bar">
        <h1>Cases</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--cl-space-2)' }}>
          <input
            placeholder="Search…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ border: '1px solid var(--gray-400)', borderRadius: 'var(--cl-radius-sm)', padding: '4px 10px', fontSize: 12, width: 200 }}
          />
          <button className="cl-btn cl-btn-primary cl-btn-sm" onClick={() => setShowForm(true)}>
            + New Case
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--gray-200)', padding: 'var(--cl-space-4) var(--cl-space-6)', display: 'flex', gap: 'var(--cl-space-3)', alignItems: 'flex-end' }}>
          {([
            { key: 'patient_name', label: 'Patient Name' },
            { key: 'patient_id', label: 'Patient ID' },
            { key: 'diagnosis', label: 'Diagnosis' },
            { key: 'stage', label: 'Stage' },
          ] as const).map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
              <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)' }}>{label}</span>
              <input
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                style={{ border: '1px solid var(--gray-400)', borderRadius: 'var(--cl-radius-sm)', padding: '4px 8px', fontSize: 12, width: 140 }}
              />
            </label>
          ))}
          <button className="cl-btn cl-btn-primary cl-btn-sm" onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Create'}
          </button>
          <button className="cl-btn cl-btn-tertiary cl-btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      )}

      <div className="cl-content">
        <div className="cl-card">
          <table className="cl-table">
            <thead>
              <tr>
                <th>Patient</th><th>Patient ID</th><th>Diagnosis</th><th>Stage</th>
                <th>Status</th><th>Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-500)', padding: 32 }}>No cases found</td></tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => navigate({ to: '/genomics/cases/$caseId', params: { caseId: c.id } })}>
                  <td style={{ fontWeight: 700 }}>{c.patient_name ?? '—'}</td>
                  <td style={{ color: 'var(--gray-700)' }}>{c.patient_id ?? '—'}</td>
                  <td>{c.diagnosis ?? '—'}</td>
                  <td style={{ color: 'var(--gray-700)' }}>{c.stage ?? '—'}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td style={{ color: 'var(--gray-600)', fontSize: 11 }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Test in browser**

```bash
pnpm dev
```

Navigate to `/genomics/cases`. Should show the table. Click "+ New Case", fill the form, submit — row should appear.

- [ ] **Step 4: Commit**

```bash
git add src/routes/genomics/cases.tsx src/screens/genomics/case-list-screen.tsx
git commit -m "feat: case list screen with inline create form"
```

---

### Task 7: Case detail screen — shell + Overview tab

**Files:**
- Create: `src/routes/genomics/cases.$caseId.tsx`
- Create: `src/screens/genomics/case-detail-screen.tsx`

- [ ] **Step 1: Create the route**

```typescript
// src/routes/genomics/cases.$caseId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { CaseDetailScreen } from '../../screens/genomics/case-detail-screen'

export const Route = createFileRoute('/genomics/cases/$caseId')({
  component: CaseDetailScreen,
})
```

- [ ] **Step 2: Create the screen with tabs**

```tsx
// src/screens/genomics/case-detail-screen.tsx
import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { Case, CaseSample, Report } from '../../server/genomics/types'

async function fetchCase(id: string): Promise<{ case: Case; samples: CaseSample[] }> {
  const res = await fetch(`/api/genomics/cases/${id}`)
  if (!res.ok) throw new Error('Failed to fetch case')
  return res.json() as Promise<{ case: Case; samples: CaseSample[] }>
}

async function fetchReport(caseId: string): Promise<Report | null> {
  const res = await fetch(`/api/genomics/cases/${caseId}/report`)
  if (!res.ok) return null
  const data = await res.json() as { report: Report | null }
  return data.report
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`cl-badge cl-badge-${status}`}>{status}</span>
}

const TABS = ['Overview', 'Report & Review', 'Files', 'Runs', 'History'] as const
type Tab = typeof TABS[number]

export function CaseDetailScreen() {
  const { caseId } = useParams({ from: '/genomics/cases/$caseId' })
  const [activeTab, setActiveTab] = useState<Tab>('Overview')

  const { data, isLoading } = useQuery({ queryKey: ['genomics', 'case', caseId], queryFn: () => fetchCase(caseId) })
  const { data: report } = useQuery({ queryKey: ['genomics', 'case', caseId, 'report'], queryFn: () => fetchReport(caseId) })

  if (isLoading) return <div className="cl-content" style={{ color: 'var(--gray-500)' }}>Loading…</div>
  if (!data) return <div className="cl-content" style={{ color: 'var(--color-red-600)' }}>Case not found</div>

  const { case: c, samples } = data

  return (
    <div>
      {/* Title bar */}
      <div className="cl-title-bar">
        <Link to="/genomics/cases" style={{ color: 'var(--brand-600)', fontSize: 12, marginRight: 8 }}>← Cases</Link>
        <h1 style={{ marginRight: 12 }}>{c.patient_name ?? c.patient_id ?? 'Case'}</h1>
        <StatusBadge status={c.status} />
        {c.diagnosis && <span style={{ fontSize: 13, color: 'var(--gray-700)', marginLeft: 8 }}>{c.diagnosis}{c.stage ? ` · ${c.stage}` : ''}</span>}
      </div>

      {/* Tabs */}
      <div className="cl-toolbar">
        {TABS.map((t) => (
          <button key={t} className={`cl-tab${activeTab === t ? ' active' : ''}`}
            aria-selected={activeTab === t} onClick={() => setActiveTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="cl-content">
        {activeTab === 'Overview' && <OverviewTab c={c} samples={samples} report={report} />}
        {activeTab === 'Report & Review' && (
          <div style={{ color: 'var(--gray-500)' }}>Report & Review — see Phase 3 plan</div>
        )}
        {activeTab === 'Files' && <FilesTab samples={samples} />}
        {activeTab === 'Runs' && <RunsTab caseId={caseId} />}
        {activeTab === 'History' && <HistoryTab report={report} />}
      </div>
    </div>
  )
}

function OverviewTab({ c, samples, report }: { c: Case; samples: CaseSample[]; report: Report | null }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--cl-space-4)' }}>
      <div className="cl-card" style={{ padding: 'var(--cl-space-4)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)', marginBottom: 8 }}>Patient</div>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px 8px', fontSize: 13 }}>
          <dt style={{ color: 'var(--gray-600)' }}>Name</dt><dd style={{ margin: 0 }}>{c.patient_name ?? '—'}</dd>
          <dt style={{ color: 'var(--gray-600)' }}>ID</dt><dd style={{ margin: 0 }}>{c.patient_id ?? '—'}</dd>
          <dt style={{ color: 'var(--gray-600)' }}>DOB</dt><dd style={{ margin: 0 }}>{c.dob ?? '—'}</dd>
          <dt style={{ color: 'var(--gray-600)' }}>Diagnosis</dt><dd style={{ margin: 0 }}>{c.diagnosis ?? '—'}</dd>
          <dt style={{ color: 'var(--gray-600)' }}>Stage</dt><dd style={{ margin: 0 }}>{c.stage ?? '—'}</dd>
        </dl>
      </div>

      <div className="cl-card" style={{ padding: 'var(--cl-space-4)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)', marginBottom: 8 }}>Samples</div>
        {samples.length === 0 && <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>No samples added</p>}
        {samples.map((s) => (
          <div key={s.id} style={{ fontSize: 13, marginBottom: 6 }}>
            <span style={{ fontWeight: 700 }}>{s.sample_id ?? 'Sample'}</span>
            {s.sample_type && <span style={{ color: 'var(--gray-600)', marginLeft: 6 }}>({s.sample_type})</span>}
            {s.fastq_path && <div style={{ fontSize: 11, color: 'var(--brand-600)', marginTop: 2, wordBreak: 'break-all' }}>{s.fastq_path}</div>}
            {s.vcf_path && <div style={{ fontSize: 11, color: 'var(--brand-600)', marginTop: 2, wordBreak: 'break-all' }}>{s.vcf_path}</div>}
          </div>
        ))}
      </div>

      <div className="cl-card" style={{ padding: 'var(--cl-space-4)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)', marginBottom: 8 }}>Report Status</div>
        {report ? (
          <div>
            <span className={`cl-badge cl-badge-${report.status}`}>{report.status}</span>
            {report.protocol_version && <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 6 }}>Protocol v{report.protocol_version}</div>}
            {report.signed_by && <div style={{ fontSize: 12, color: 'var(--color-green-600)', marginTop: 4 }}>Signed by {report.signed_by}</div>}
          </div>
        ) : (
          <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>No report generated</p>
        )}
      </div>

      {c.ehr_summary && (
        <div className="cl-card" style={{ padding: 'var(--cl-space-4)', gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)', marginBottom: 8 }}>EHR Summary</div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--gray-700)', lineHeight: '22px' }}>{c.ehr_summary}</p>
        </div>
      )}
    </div>
  )
}

function FilesTab({ samples }: { samples: CaseSample[] }) {
  const files = samples.flatMap((s) => [
    s.fastq_path ? { path: s.fastq_path, type: 'FASTQ', sample: s.sample_id } : null,
    s.vcf_path ? { path: s.vcf_path, type: 'VCF', sample: s.sample_id } : null,
  ]).filter(Boolean) as { path: string; type: string; sample: string | null }[]

  return (
    <div className="cl-card">
      <table className="cl-table">
        <thead><tr><th>Type</th><th>Sample</th><th>Path</th></tr></thead>
        <tbody>
          {files.length === 0 && <tr><td colSpan={3} style={{ color: 'var(--gray-500)', textAlign: 'center', padding: 24 }}>No files linked</td></tr>}
          {files.map((f, i) => (
            <tr key={i}>
              <td><span className="cl-badge cl-badge-closed">{f.type}</span></td>
              <td style={{ color: 'var(--gray-700)' }}>{f.sample ?? '—'}</td>
              <td style={{ fontSize: 11, color: 'var(--brand-600)', wordBreak: 'break-all' }}>{f.path}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RunsTab({ caseId }: { caseId: string }) {
  const { data: allRuns = [] } = useQuery({
    queryKey: ['genomics', 'runs'],
    queryFn: async () => {
      const res = await fetch('/api/genomics/runs')
      return ((await res.json()) as { runs: import('../../server/genomics/types').Run[] }).runs
    },
  })
  return (
    <div className="cl-card">
      <table className="cl-table">
        <thead><tr><th>Name</th><th>Pipeline</th><th>Reference</th><th>Status</th></tr></thead>
        <tbody>
          {allRuns.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--gray-500)', textAlign: 'center', padding: 24 }}>No linked runs</td></tr>}
          {allRuns.map((r) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 700 }}>{r.name}</td>
              <td>{r.pipeline}</td>
              <td style={{ color: 'var(--gray-700)' }}>{r.reference ?? '—'}</td>
              <td><span className={`cl-badge cl-badge-${r.status}`}>{r.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HistoryTab({ report }: { report: Report | null }) {
  if (!report) return <div style={{ color: 'var(--gray-500)', padding: 24 }}>No report history</div>
  return (
    <div className="cl-card" style={{ padding: 'var(--cl-space-4)' }}>
      <div style={{ fontSize: 13 }}>
        <div>Report created: <strong>{new Date(report.created_at).toLocaleString()}</strong></div>
        {report.protocol_version && <div style={{ marginTop: 4 }}>Generated with Protocol v<strong>{report.protocol_version}</strong></div>}
        {report.signed_by && <div style={{ marginTop: 4, color: 'var(--color-green-600)' }}>Signed by <strong>{report.signed_by}</strong> at {new Date(report.signed_at!).toLocaleString()}</div>}
        {!report.signed_by && <div style={{ marginTop: 4, color: 'var(--gray-500)' }}>Not yet signed</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Test in browser**

```bash
pnpm dev
```

Navigate to `/genomics/cases`, click a case row → should open Case detail with tab bar.

- [ ] **Step 4: Commit**

```bash
git add src/routes/genomics/cases.$caseId.tsx src/screens/genomics/case-detail-screen.tsx
git commit -m "feat: case detail screen with overview, files, runs, history tabs"
```

---

### Task 8: Run list + Run detail screens

**Files:**
- Create: `src/routes/genomics/runs.tsx`
- Create: `src/routes/genomics/runs.$runId.tsx`
- Create: `src/screens/genomics/run-list-screen.tsx`
- Create: `src/screens/genomics/run-detail-screen.tsx`

- [ ] **Step 1: Create run routes**

```typescript
// src/routes/genomics/runs.tsx
import { createFileRoute } from '@tanstack/react-router'
import { RunListScreen } from '../../screens/genomics/run-list-screen'
export const Route = createFileRoute('/genomics/runs')({ component: RunListScreen })
```

```typescript
// src/routes/genomics/runs.$runId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { RunDetailScreen } from '../../screens/genomics/run-detail-screen'
export const Route = createFileRoute('/genomics/runs/$runId')({ component: RunDetailScreen })
```

- [ ] **Step 2: Write `run-list-screen.tsx`**

```tsx
// src/screens/genomics/run-list-screen.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { Run } from '../../server/genomics/types'

async function fetchRuns(): Promise<Run[]> {
  const res = await fetch('/api/genomics/runs')
  return ((await res.json()) as { runs: Run[] }).runs
}

async function createRun(body: Partial<Run> & { name: string; pipeline: string }): Promise<Run> {
  const res = await fetch('/api/genomics/runs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, status: 'queued' }),
  })
  return ((await res.json()) as { run: Run }).run
}

export function RunListScreen() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: runs = [], isLoading } = useQuery({ queryKey: ['genomics', 'runs'], queryFn: fetchRuns })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', pipeline: 'wgs-mutect2', reference: 'GRCh38', fastq_path: '', output_path: '', pbrun_command: '' })

  const mutation = useMutation({
    mutationFn: createRun,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['genomics', 'runs'] }); setShowForm(false) },
  })

  return (
    <div>
      <div className="cl-title-bar">
        <h1>Runs</h1>
        <div style={{ marginLeft: 'auto' }}>
          <button className="cl-btn cl-btn-primary cl-btn-sm" onClick={() => setShowForm(true)}>+ New Run</button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--gray-200)', padding: 'var(--cl-space-4) var(--cl-space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--cl-space-3)', alignItems: 'flex-end' }}>
          {([
            { key: 'name', label: 'Run Name', width: 160 },
            { key: 'pipeline', label: 'Pipeline', width: 140 },
            { key: 'reference', label: 'Reference', width: 100 },
            { key: 'fastq_path', label: 'FASTQ Path (NAS)', width: 220 },
            { key: 'output_path', label: 'Output Path (NAS)', width: 220 },
            { key: 'pbrun_command', label: 'pbrun Command', width: 220 },
          ] as const).map(({ key, label, width }) => (
            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
              <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)' }}>{label}</span>
              <input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                style={{ border: '1px solid var(--gray-400)', borderRadius: 'var(--cl-radius-sm)', padding: '4px 8px', fontSize: 12, width }} />
            </label>
          ))}
          <button className="cl-btn cl-btn-primary cl-btn-sm" onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Create'}
          </button>
          <button className="cl-btn cl-btn-tertiary cl-btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      )}

      <div className="cl-content">
        <div className="cl-card">
          <table className="cl-table">
            <thead><tr><th>Name</th><th>Pipeline</th><th>Reference</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Loading…</td></tr>}
              {!isLoading && runs.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-500)', padding: 32 }}>No runs yet</td></tr>}
              {runs.map((r) => (
                <tr key={r.id} onClick={() => navigate({ to: '/genomics/runs/$runId', params: { runId: r.id } })}>
                  <td style={{ fontWeight: 700 }}>{r.name}</td>
                  <td>{r.pipeline}</td>
                  <td style={{ color: 'var(--gray-700)' }}>{r.reference ?? '—'}</td>
                  <td><span className={`cl-badge cl-badge-${r.status}`}>{r.status}</span></td>
                  <td style={{ color: 'var(--gray-600)', fontSize: 11 }}>{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `run-detail-screen.tsx`**

```tsx
// src/screens/genomics/run-detail-screen.tsx
import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useGenomicsStore } from '../../stores/genomics-store'
import type { Run, RunStage } from '../../server/genomics/types'

async function fetchRun(id: string): Promise<{ run: Run; stages: RunStage[] }> {
  const res = await fetch(`/api/genomics/runs/${id}`)
  if (!res.ok) throw new Error('Failed to fetch run')
  return res.json() as Promise<{ run: Run; stages: RunStage[] }>
}

const STAGE_ICON: Record<string, string> = {
  completed: '✓', running: '⟳', pending: '○', failed: '✗',
}

export function RunDetailScreen() {
  const { runId } = useParams({ from: '/genomics/runs/$runId' })
  const appendRunLog = useGenomicsStore((s) => s.appendRunLog)
  const clearRunLog = useGenomicsStore((s) => s.clearRunLog)
  const logLines = useGenomicsStore((s) => s.runLogs[runId] ?? [])
  const logRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['genomics', 'run', runId],
    queryFn: () => fetchRun(runId),
    refetchInterval: 3000, // poll every 3s while run may be active
  })

  // SSE log stream
  useEffect(() => {
    clearRunLog(runId)
    const es = new EventSource(`/api/genomics/runs/${runId}/log`)
    es.onmessage = (e) => {
      const parsed = JSON.parse(e.data) as { line: string }
      if (parsed.line) appendRunLog(runId, parsed.line)
    }
    return () => es.close()
  }, [runId, appendRunLog, clearRunLog])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logLines])

  if (isLoading) return <div className="cl-content" style={{ color: 'var(--gray-500)' }}>Loading…</div>
  if (!data) return <div className="cl-content" style={{ color: 'var(--color-red-600)' }}>Run not found</div>

  const { run, stages } = data

  return (
    <div>
      <div className="cl-title-bar">
        <Link to="/genomics/runs" style={{ color: 'var(--brand-600)', fontSize: 12, marginRight: 8 }}>← Runs</Link>
        <h1 style={{ marginRight: 12 }}>{run.name}</h1>
        <span className={`cl-badge cl-badge-${run.status}`}>{run.status}</span>
        <span style={{ fontSize: 13, color: 'var(--gray-700)', marginLeft: 8 }}>{run.pipeline}{run.reference ? ` · ${run.reference}` : ''}</span>
      </div>

      <div className="cl-content">
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--cl-space-4)', alignItems: 'start' }}>
          {/* Left: pipeline stages */}
          <div className="cl-card" style={{ padding: 'var(--cl-space-3)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)', marginBottom: 8, padding: '0 var(--cl-space-1)' }}>
              Pipeline Stages
            </div>
            <div className="cl-stage-list">
              {stages.length === 0 && <div style={{ color: 'var(--gray-500)', fontSize: 12, padding: 8 }}>No stages recorded</div>}
              {stages.map((s) => {
                const elapsed = s.started_at
                  ? s.finished_at
                    ? `${Math.round((s.finished_at - s.started_at) / 1000)}s`
                    : `${Math.round((Date.now() - s.started_at) / 60000)}m…`
                  : null
                return (
                  <div key={s.id} className={`cl-stage-row ${s.status}`}>
                    <span style={{ fontWeight: 700, width: 14, textAlign: 'center' }}>{STAGE_ICON[s.status] ?? '?'}</span>
                    <span style={{ flex: 1 }}>{s.name}</span>
                    {elapsed && <span style={{ fontSize: 10, opacity: 0.8 }}>{elapsed}</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: live log + metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cl-space-3)' }}>
            <div className="cl-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--gray-200)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)' }}>
                Live Log
              </div>
              <div ref={logRef} style={{
                fontFamily: 'monospace', fontSize: 11, padding: 12,
                height: 300, overflowY: 'auto', background: 'var(--gray-950)',
                color: '#4ade80', lineHeight: '18px',
              }}>
                {logLines.length === 0 && <span style={{ color: '#555' }}>Waiting for log output…</span>}
                {logLines.map((line, i) => <div key={i}>{line}</div>)}
              </div>
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--cl-space-3)' }}>
              {[
                { label: 'Pipeline', value: run.pipeline },
                { label: 'Reference', value: run.reference ?? '—' },
                { label: 'Status', value: run.status },
              ].map((m) => (
                <div key={m.label} className="cl-card cl-stat-card" style={{ padding: 'var(--cl-space-3)' }}>
                  <div className="label">{m.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>{m.value}</div>
                </div>
              ))}
            </div>

            {run.fastq_path && (
              <div className="cl-card" style={{ padding: 'var(--cl-space-3)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)', marginBottom: 4 }}>FASTQ Path</div>
                <div style={{ fontSize: 12, color: 'var(--brand-600)', wordBreak: 'break-all' }}>{run.fastq_path}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test in browser**

Navigate to `/genomics/runs`, create a run, click row → Run detail shows stages + log panel.

- [ ] **Step 5: Commit**

```bash
git add src/routes/genomics/runs.tsx src/routes/genomics/runs.$runId.tsx src/screens/genomics/run-list-screen.tsx src/screens/genomics/run-detail-screen.tsx
git commit -m "feat: run list and run detail screens with SSE log"
```

---

### Task 9: Protocol library screen

**Files:**
- Create: `src/routes/genomics/protocols.tsx`
- Create: `src/routes/genomics/protocols.$protocolId.tsx`
- Create: `src/screens/genomics/protocol-list-screen.tsx`
- Create: `src/screens/genomics/protocol-detail-screen.tsx`

- [ ] **Step 1: Create routes**

```typescript
// src/routes/genomics/protocols.tsx
import { createFileRoute } from '@tanstack/react-router'
import { ProtocolListScreen } from '../../screens/genomics/protocol-list-screen'
export const Route = createFileRoute('/genomics/protocols')({ component: ProtocolListScreen })
```

```typescript
// src/routes/genomics/protocols.$protocolId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { ProtocolDetailScreen } from '../../screens/genomics/protocol-detail-screen'
export const Route = createFileRoute('/genomics/protocols/$protocolId')({ component: ProtocolDetailScreen })
```

- [ ] **Step 2: Write `protocol-list-screen.tsx`**

```tsx
// src/screens/genomics/protocol-list-screen.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { Protocol } from '../../server/genomics/types'

async function fetchProtocols(): Promise<Protocol[]> {
  const res = await fetch('/api/genomics/protocols')
  return ((await res.json()) as { protocols: Protocol[] }).protocols
}

async function createProtocol(body: Omit<Protocol, 'id' | 'is_active' | 'created_at' | 'updated_at'>): Promise<Protocol> {
  const res = await fetch('/api/genomics/protocols', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return ((await res.json()) as { protocol: Protocol }).protocol
}

export function ProtocolListScreen() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: protocols = [], isLoading } = useQuery({ queryKey: ['genomics', 'protocols'], queryFn: fetchProtocols })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', version: '1.0', assay_type: 'WGS', description: '', prompt_template: '', skills: '', variables: '[]' })

  const mutation = useMutation({
    mutationFn: (f: typeof form) => createProtocol({
      ...f,
      skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean),
      variables: JSON.parse(f.variables) as Protocol['variables'],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['genomics', 'protocols'] }); setShowForm(false) },
  })

  return (
    <div>
      <div className="cl-title-bar">
        <h1>Protocols</h1>
        <div style={{ marginLeft: 'auto' }}>
          <button className="cl-btn cl-btn-primary cl-btn-sm" onClick={() => setShowForm(true)}>+ New Protocol</button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--gray-200)', padding: 'var(--cl-space-4) var(--cl-space-6)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cl-space-3)', alignItems: 'flex-end', marginBottom: 'var(--cl-space-3)' }}>
            {([
              { key: 'name', label: 'Protocol Name', width: 200 },
              { key: 'version', label: 'Version', width: 80 },
              { key: 'assay_type', label: 'Assay Type', width: 120 },
              { key: 'description', label: 'Description', width: 280 },
              { key: 'skills', label: 'Skills (comma-separated)', width: 320 },
            ] as const).map(({ key, label, width }) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
                <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)' }}>{label}</span>
                <input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={{ border: '1px solid var(--gray-400)', borderRadius: 'var(--cl-radius-sm)', padding: '4px 8px', fontSize: 12, width }} />
              </label>
            ))}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, marginBottom: 'var(--cl-space-3)' }}>
            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)' }}>Prompt Template (use {'{{variable}}'} syntax)</span>
            <textarea value={form.prompt_template} onChange={(e) => setForm((f) => ({ ...f, prompt_template: e.target.value }))}
              rows={4} style={{ border: '1px solid var(--gray-400)', borderRadius: 'var(--cl-radius-sm)', padding: '6px 8px', fontSize: 12, width: '100%', fontFamily: 'monospace' }} />
          </label>
          <div style={{ display: 'flex', gap: 'var(--cl-space-2)' }}>
            <button className="cl-btn cl-btn-primary cl-btn-sm" onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Create Protocol'}
            </button>
            <button className="cl-btn cl-btn-tertiary cl-btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="cl-content">
        <div className="cl-card">
          <table className="cl-table">
            <thead><tr><th>Name</th><th>Version</th><th>Assay Type</th><th>Skills</th><th>Status</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Loading…</td></tr>}
              {!isLoading && protocols.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-500)', padding: 32 }}>No protocols yet</td></tr>}
              {protocols.map((p) => (
                <tr key={p.id} onClick={() => navigate({ to: '/genomics/protocols/$protocolId', params: { protocolId: p.id } })}>
                  <td style={{ fontWeight: 700 }}>{p.name}</td>
                  <td style={{ color: 'var(--gray-700)' }}>v{p.version}</td>
                  <td><span className="cl-badge cl-badge-closed">{p.assay_type}</span></td>
                  <td style={{ color: 'var(--gray-600)', fontSize: 11 }}>{p.skills.length} skills</td>
                  <td><span className={`cl-badge ${p.is_active ? 'cl-badge-active' : 'cl-badge-closed'}`}>{p.is_active ? 'Active' : 'Retired'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `protocol-detail-screen.tsx`**

```tsx
// src/screens/genomics/protocol-detail-screen.tsx
import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from '@tanstack/react-router'
import type { Protocol } from '../../server/genomics/types'

async function fetchProtocol(id: string): Promise<Protocol> {
  const res = await fetch(`/api/genomics/protocols/${id}`)
  if (!res.ok) throw new Error('Not found')
  return ((await res.json()) as { protocol: Protocol }).protocol
}

export function ProtocolDetailScreen() {
  const { protocolId } = useParams({ from: '/genomics/protocols/$protocolId' })
  const { data: protocol, isLoading } = useQuery({ queryKey: ['genomics', 'protocol', protocolId], queryFn: () => fetchProtocol(protocolId) })

  if (isLoading) return <div className="cl-content" style={{ color: 'var(--gray-500)' }}>Loading…</div>
  if (!protocol) return <div className="cl-content" style={{ color: 'var(--color-red-600)' }}>Protocol not found</div>

  return (
    <div>
      <div className="cl-title-bar">
        <Link to="/genomics/protocols" style={{ color: 'var(--brand-600)', fontSize: 12, marginRight: 8 }}>← Protocols</Link>
        <h1 style={{ marginRight: 12 }}>{protocol.name}</h1>
        <span className="cl-badge cl-badge-closed" style={{ marginRight: 8 }}>v{protocol.version}</span>
        <span className="cl-badge cl-badge-closed">{protocol.assay_type}</span>
        <span className={`cl-badge ${protocol.is_active ? 'cl-badge-active' : 'cl-badge-closed'}`} style={{ marginLeft: 8 }}>
          {protocol.is_active ? 'Active' : 'Retired'}
        </span>
      </div>

      <div className="cl-content">
        {protocol.description && (
          <div className="cl-card" style={{ padding: 'var(--cl-space-4)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)', marginBottom: 6 }}>Description</div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--gray-700)', lineHeight: '22px' }}>{protocol.description}</p>
          </div>
        )}

        <div className="cl-card" style={{ padding: 'var(--cl-space-4)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)', marginBottom: 8 }}>
            Skill Sequence ({protocol.skills.length} skills)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {protocol.skills.map((s, i) => (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ background: 'var(--brand-100)', color: 'var(--brand-700)', padding: '3px 8px', borderRadius: 'var(--cl-radius-xs)', fontSize: 11, fontFamily: "'Helvetica Condensed',Helvetica,sans-serif" }}>{s}</span>
                {i < protocol.skills.length - 1 && <span style={{ color: 'var(--gray-500)' }}>→</span>}
              </span>
            ))}
          </div>
        </div>

        <div className="cl-card" style={{ padding: 'var(--cl-space-4)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)', marginBottom: 8 }}>Prompt Template</div>
          <pre style={{ margin: 0, fontSize: 12, color: 'var(--gray-800)', background: 'var(--gray-100)', padding: 12, borderRadius: 'var(--cl-radius-sm)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '20px' }}>
            {protocol.prompt_template}
          </pre>
        </div>

        {protocol.variables.length > 0 && (
          <div className="cl-card">
            <table className="cl-table">
              <thead><tr><th>Variable</th><th>Label</th><th>Source</th><th>Editable</th></tr></thead>
              <tbody>
                {protocol.variables.map((v) => (
                  <tr key={v.name}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{`{{${v.name}}}`}</td>
                    <td>{v.label}</td>
                    <td style={{ color: 'var(--gray-700)', fontSize: 12 }}>{v.source}</td>
                    <td>{v.editable ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test in browser — create a Protocol then view its detail**

```bash
pnpm dev
```

Navigate to `/genomics/protocols` → "+ New Protocol" → fill form → Create. Click row → detail view shows skills chain and template.

- [ ] **Step 5: Run all tests to confirm no regressions**

```bash
pnpm test
pnpm lint
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/genomics/protocols.tsx src/routes/genomics/protocols.$protocolId.tsx src/screens/genomics/protocol-list-screen.tsx src/screens/genomics/protocol-detail-screen.tsx
git commit -m "feat: protocol list and detail screens"
```

---

**Phase 2 complete.** Navigation shell, design tokens, all list/detail screens, and Zustand store are in place. Move to Phase 3 for the Report & Review tab (Monaco canvas, generate modal, PDF export).
