require('dotenv').config();
const { z } = require('zod');
const { createStructuredModel } = require('./services/ai/modelFactory');
const { companyInsightOutputSchema } = require('./services/ai/schemas');

async function run() {
  try {
    const structuredModel = await createStructuredModel(companyInsightOutputSchema, {
      name: 'DealVoiceCompanyInsight',
    });
    
    const systemPrompt = "Test prompt";
    
    console.log("Invoking...");
    const parsed = await structuredModel.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Test company' }
    ]);
    console.log("Success:", parsed);
  } catch (err) {
    console.error("FAIL:", err);
  }
}
run();
