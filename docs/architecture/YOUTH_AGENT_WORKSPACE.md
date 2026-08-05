# Youth Agent Workspace — Architecture

## Overview

Professional mobile-first field ops workspace for approved Youth Agents.

```mermaid
flowchart TB
  subgraph Client["/agent/workspace"]
    Today
    Assignments
    Messages
    Earnings
    Performance
    Profile
  end

  subgraph APIs["/api/agent/workspace/*"]
    Guard["featureFlag fail-closed"]
    WS["workspaceService"]
  end

  subgraph Domain
    AL["attendanceLifecycle"]
    FR["fieldReportLifecycle"]
    EP["explainablePerformance"]
  end

  subgraph Data
    AR[(attendanceRequests)]
    Drafts[(fieldReportDrafts)]
    Msgs[(assignmentMessages)]
    Ledger[(agentEarningsLedger)]
    Audit[(agentWorkspaceAuditEvents)]
  end

  Client --> Guard --> WS
  WS --> AL
  WS --> FR
  WS --> EP
  WS --> AR
  WS --> Drafts
  WS --> Msgs
  WS --> Ledger
  WS --> Audit
```

## Assignment state machine

Reuses attendance workflow (no duplicate):

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> assigned: dispatch
  assigned --> accepted: agent accept
  accepted --> en_route: agent
  en_route --> arrived: agent
  arrived --> in_progress: agent
  in_progress --> completed: agent
  completed --> closed: admin/system
  pending --> cancelled: sme/admin
  assigned --> cancelled: sme/admin
  in_progress --> disputed: sme/admin/agent
```

## Field report lifecycle

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> submitted: agent submit
  submitted --> locked: system
  locked --> verified: SME
  locked --> rejected: SME
  rejected --> draft: agent revise
```

## Security

- Flag `youth_agent_workspace_v1` fail-closed + UID allow-list
- All mutations via Admin SDK APIs after `verifyApiUser`
- Firestore client writes disabled for ledger/audit; drafts/messages ownership-scoped
- Evidence under `briefing-proofs/{requestId}/**` and `workspace-evidence/{requestId}/**`
