const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Company = require('./models/CompanyModel');
  const company = await Company.findOne({});
  const template = company?.settings?.communication?.offboardingRejectionTemplate;
  const customSignature = company?.settings?.communication?.emailSignatureUrl;
  const customLogo = company?.settings?.communication?.emailLogoUrl;

  const signatureHtml = customSignature 
        ? `<div style="margin-top: 30px;"><img src="${customSignature}" alt="Company Signature" style="max-height: 80px; display: block;" /></div>`
        : "DEFAULT_SIGNATURE";

  console.log("Original Template includes {signature}?", template.includes('{signature}'));
  
  let htmlContent = template
          .replace(/{formattedName}/g, "John Doe")
          .replace(/{signature}/g, signatureHtml);
          
  console.log("Final HTML includes {signature}?", htmlContent.includes('{signature}'));
  console.log("Final HTML includes signature tag?", htmlContent.includes('Company Signature'));
  
  process.exit(0);
});
