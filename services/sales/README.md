# softrate_call

## Pipeline Stage ↔ Lead Status Mapping

The Pipeline board operates using the `pipelineStage` field, while other areas of the application use the `status` field. To keep them synchronized, the backend automatically maps changes between the two:

**When Pipeline Stage Changes ➔ Update Status:**
- Moving to `FOLLOW_UP`, `QUALIFICATION`, `NEEDS_ANALYSIS` ➔ Status becomes **"Follow Up"**
- Moving to `VALUE_PROPOSITION`, `PROPOSAL_QUOTE`, `NEGOTIATION_REVIEW` ➔ Status becomes **"Details Shared"**
- Moving to `CLOSED_WON` ➔ Status becomes **"Converted"**
- Moving to `CLOSED_LOST` ➔ Status becomes **"Not Interested"**

**When Status Changes ➔ Update Pipeline Stage:**
- Status changed to **"Follow Up"**, **"Call Later"**, or **"Future Needs"** ➔ Stage becomes `FOLLOW_UP`
- Status changed to **"Converted"** ➔ Stage becomes `CLOSED_WON`
- Status changed to **"Not Interested"**, **"Invalid"**, **"DNP / Not Reachable"**, **"Busy"**, **"Switch off"** ➔ Stage becomes `CLOSED_LOST`
