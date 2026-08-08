/**
 * Maps Lead 'status' values to 'pipelineStage' values and vice versa.
 */

function statusToPipeline(status) {
  switch (status) {
    case 'Follow Up':
    case 'Call Later':
    case 'Future Needs':
      return { pipelineStage: 'FOLLOW_UP', connectionOutcome: 'BUSY' };
    case 'Converted':
      return { pipelineStage: 'CLOSED_WON' };
    case 'Not Interested':
    case 'Invalid':
    case 'DNP / Not Reachable':
    case 'Busy':
    case 'Switch off':
      return { pipelineStage: 'CLOSED_LOST' };
    default:
      return {};
  }
}

function pipelineToStatus(stage) {
  switch (stage) {
    case 'FOLLOW_UP':
    case 'QUALIFICATION':
    case 'NEEDS_ANALYSIS':
      return 'Follow Up';
    case 'VALUE_PROPOSITION':
    case 'PROPOSAL_QUOTE':
    case 'NEGOTIATION_REVIEW':
      return 'Details Shared';
    case 'CLOSED_WON':
      return 'Converted';
    case 'CLOSED_LOST':
      return 'Not Interested';
    default:
      return null;
  }
}

module.exports = {
  statusToPipeline,
  pipelineToStatus,
};
