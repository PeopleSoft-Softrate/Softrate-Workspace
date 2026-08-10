const mongoose = require('mongoose');
require('dotenv').config();

const Lead = require('../models/Lead');
const Deal = require('../models/Deal');

async function migrate() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI is missing');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Find all leads that have a pipelineStage set
    const leadsInPipeline = await Lead.find({
      pipelineStage: { $in: [
        'NEW', 'QUALIFICATION', 'NEEDS_ANALYSIS', 
        'VALUE_PROPOSITION', 'PROPOSAL_QUOTE', 'NEGOTIATION_REVIEW', 
        'CLOSED_WON', 'CLOSED_LOST'
      ]}
    });

    console.log(`Found ${leadsInPipeline.length} leads in pipeline to migrate to Deals.`);

    let migratedCount = 0;
    for (const lead of leadsInPipeline) {
      // Check if a deal already exists for this lead
      const existingDeal = await Deal.findOne({ leadId: lead._id });
      if (existingDeal) {
        continue;
      }

      const deal = new Deal({
        companyCode: lead.companyCode,
        leadId: lead._id,
        assignedEmployeeId: lead.assignedEmployeeId,
        leadCompanyName: lead.leadCompanyName,
        contactName: lead.contactName,
        contactNumber: lead.contactNumber,
        directorEmailAddress: lead.directorEmailAddress,
        
        dealName: 'Legacy Deal', // Or use product name if known, but for old leads it's unknown
        amount: 0,
        closingDate: null,
        description: lead.remarks || '',
        
        pipelineStage: lead.pipelineStage,
        connectionOutcome: lead.connectionOutcome,
        qualificationOutcome: lead.qualificationOutcome,
        qualificationReason: lead.qualificationReason,
        lostReason: lead.lostReason,
        stageChangedAt: lead.stageChangedAt || lead.createdAt,
        
        createdByRole: 'admin',
        createdByName: 'Migration Script',
      });

      await deal.save();
      migratedCount++;
    }

    console.log(`Successfully migrated ${migratedCount} leads to deals.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
