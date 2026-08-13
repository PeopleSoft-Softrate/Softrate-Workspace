/**
 * Maps Lead 'status' values to 'pipelineStage' values and vice versa.
 */

function statusToPipeline(status) {
  switch (status) {
    case 'Follow Up':
      return { pipelineStage: 'QUALIFICATION', connectionOutcome: 'BUSY' };
    case 'Converted':
      return { pipelineStage: 'CLOSED_WON' };
    case 'Not Interested':
    case 'Invalid':
    case 'Not Connected':
    case 'Closed Lost':
      return { pipelineStage: 'CLOSED_LOST' };
    default:
      return {};
  }
}

function pipelineToStatus(stage) {
  switch (stage) {
    case 'QUALIFICATION':
    case 'NEEDS_ANALYSIS':
      return 'Follow Up';
    case 'VALUE_PROPOSITION':
    case 'PROPOSAL_QUOTE':
    case 'NEGOTIATION_REVIEW':
      return 'Follow Up';
    case 'CLOSED_WON':
      return 'Converted';
    case 'CLOSED_LOST':
      return 'Closed Lost';
    default:
      return null;
  }
}

module.exports = {
  statusToPipeline,
  pipelineToStatus,
};
