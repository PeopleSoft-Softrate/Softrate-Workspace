const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema({
  name: { type: String, required: true },
  domain: { type: String, unique: true, sparse: true },
  companyCode: { type: String, unique: true, required: true },
  dbName: { type: String, unique: true, required: true },
  logo: { type: String, default: null },
  subscriptionStatus: { 
    type: String, 
    enum: ['active', 'trial', 'suspended', 'cancelled'], 
    default: 'trial' 
  },
  subscriptionExpiresAt: { type: Date },
  // Required work hours per day per role type (used for short-time calculation)
  workDurationSettings: {
    hr:       { type: Number, default: 8 },
    manager:  { type: Number, default: 8 },
    employee: { type: Number, default: 8 },
    intern:   { type: Number, default: 6 },
  },
  settings: {
    themeColor: { type: String, default: '#00657F' },
    receivingEmail: { type: String, default: null }, // Email to receive system notifications
    locations: [{
      name: { type: String, default: 'Headquarters' },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      radius: { type: Number, default: 200 }, // allowable distance in meters
      addedBy: { type: String, default: 'hr' } // Can be 'hr' or employeeId
    }],
    communication: {
      whatsappNotifications: { type: Boolean, default: false },
      emailNotifications: { type: Boolean, default: true },
      emailLogoUrl: { type: String, default: null },
      emailSignatureUrl: { type: String, default: null },
      offboardingRejectionTemplate: { 
        type: String, 
        default: `<div style="font-family: sans-serif; line-height: 1.5; color: #333;">
  <p style="margin: 0 0 10px 0;">Dear {formattedName},</p>
  <p style="margin: 0 0 10px 0;">Thank you for submitting your offboarding form. After careful review, we regret to inform you that your form has been rejected. This could be due to pending formalities such as:</p>
  <ol style="padding-left: 20px; margin: 0 0 15px 0;">
    <li style="margin-bottom: 4px;">Return of all company-issued assets is not completed.</li>
    <li style="margin-bottom: 4px;">Knowledge transfer and handover of pending tasks is not completed.</li>
    <li style="margin-bottom: 4px;">Project documentation is not up to date.</li>
    <li style="margin-bottom: 4px;">Outstanding approvals or submissions have not been cleared.</li>
  </ol>
  <p style="margin: 0 0 10px 0;">Kindly complete the above formalities and resubmit your offboarding form at the earliest.</p>
  <p style="margin: 0 0 15px 0;">For further details or assistance, please contact your HR at <a href="mailto:hr@softrateglobal.com" style="color: #007bb6;">hr@softrateglobal.com</a>.</p>
  {signature}
</div>`
      },
      onboardingTemplateEmployee: {
        type: String,
        default: `<div style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <h2>Hi {formattedName},</h2>
  <p>Your profile has been <b>approved</b> 🎉</p>
  <p><b>Employee ID:</b> {employeeId}</p>
  <p><b>Onboarding Date:</b> {onboardingDate}</p>
  {signature}
</div>`
      },
      onboardingTemplateIntern: {
        type: String,
        default: `<div style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <p>Dear {formattedName},</p>
  <p>Softrate Global welcomes you Onboard, We herein have attached your Official Offer Letter and Company Culture Book for joining us.</p>
  <p>You can share your offer letter on Linkedin by mentioning @softrate with hashtags #careeratsoftrate #softratetechpark #softratetechnologies</p>
  <p>Also read out the annexure completely that had been attached in this mail and make sure you are agreeing with our policies by signing and filling up the date in the attached annexure.</p>
  <p>Your internship details are as follows:</p>
  <ul>
    <li>Onboarding Date: {onboardingDate}</li>
    <li>End Date: {endDate}</li>
  </ul>
  <p style="margin: 0 0 0 0;">To proceed further, please log in to the PeopleSoft portal using the credentials shared separately.</p>
  {signature}
</div>`
      }
    },
    employeeRoles: [{ type: String }],
    internRoles: [{ type: String }],
    hrPolicyUrl: { type: String, default: null },
    hrPolicyUpdatedAt: { type: Date, default: null },
    payrollSettings: {
      pfCalculateEmployee: { type: Boolean, default: false },
      pfCalculateIntern: { type: Boolean, default: false },
      pfPercentage: { type: Number, default: 12 },
      taxPercentage: { type: Number, default: 10 },
      taxLimitThreshold: { type: Number, default: 50000 },

      // LOP (Loss of Pay) Settings
      // Applies to: pending leaves + absence without any approval
      lopSettings: {
        enableLopEmployee:      { type: Boolean, default: false },
        enableLopIntern:        { type: Boolean, default: false },
        // 'percentage' = % of per-day salary deducted | 'amount' = flat ₹ per day
        lopTypeEmployee:        { type: String, enum: ['percentage', 'amount'], default: 'percentage' },
        lopTypeIntern:          { type: String, enum: ['percentage', 'amount'], default: 'percentage' },
        // Used when lopType === 'percentage' (100 = full-day deduction)
        lopPercentageEmployee:  { type: Number, default: 100 },
        lopPercentageIntern:    { type: Number, default: 100 },
        // Used when lopType === 'amount' (flat ₹ per unauthorized day)
        lopAmountEmployee:      { type: Number, default: 0 },
        lopAmountIntern:        { type: Number, default: 0 },
        // Working days per month (used to derive per-day salary from basic)
        workingDaysEmployee:    { type: Number, default: 26 },
        workingDaysIntern:      { type: Number, default: 26 }
      }
    },
    offerLetterSettings: {
      companyName: { type: String, default: 'Softrate Technologies (P) Ltd' },
      address: { type: String, default: 'SOFTRATE TECH PARK, MANGADU, CHENNAI, INDIA, 600 122' },
      contact: { type: String, default: '(+91) 8148633580 | hr@softrateglobal.com' },
      website: { type: String, default: 'www.softrateglobal.com' },
      logoUrl: { type: String, default: null },
      signatureUrl: { type: String, default: null },
      signatoryName: { type: String, default: 'Hiring Manager' },
      signatoryRole: { type: String, default: 'Softrate Global (India)' },
      workLocation: { type: String, default: 'Softrate Tech Park, Chennai' },
      annexureUrl: { type: String, default: null },
      ndaUrl: { type: String, default: null },
      templateContent: { type: String, default: null },
      logoSize: { type: Number, default: 50 },
      borderWidth: { type: Number, default: 10 },
      documentTemplates: {
        offerLetter: { orientation: { type: String, default: 'portrait' }, pages: [{ backgroundUrl: String, placeholders: [{ key: String, x: Number, y: Number, fontSize: Number, isBold: Boolean, color: String }], paragraphs: [mongoose.Schema.Types.Mixed] }] },
        annexure: { orientation: { type: String, default: 'portrait' }, pages: [{ backgroundUrl: String, placeholders: [{ key: String, x: Number, y: Number, fontSize: Number, isBold: Boolean, color: String }], paragraphs: [mongoose.Schema.Types.Mixed] }] },
        nda: { orientation: { type: String, default: 'portrait' }, pages: [{ backgroundUrl: String, placeholders: [{ key: String, x: Number, y: Number, fontSize: Number, isBold: Boolean, color: String }], paragraphs: [mongoose.Schema.Types.Mixed] }] },
        lor: { orientation: { type: String, default: 'landscape' }, pages: [{ backgroundUrl: String, placeholders: [{ key: String, x: Number, y: Number, fontSize: Number, isBold: Boolean, color: String }], paragraphs: [mongoose.Schema.Types.Mixed] }] },
        internshipCompletion: { orientation: { type: String, default: 'landscape' }, pages: [{ backgroundUrl: String, placeholders: [{ key: String, x: Number, y: Number, fontSize: Number, isBold: Boolean, color: String }], paragraphs: [mongoose.Schema.Types.Mixed] }] },
        projectCompletion: { orientation: { type: String, default: 'landscape' }, pages: [{ backgroundUrl: String, placeholders: [{ key: String, x: Number, y: Number, fontSize: Number, isBold: Boolean, color: String }], paragraphs: [mongoose.Schema.Types.Mixed] }] }
      }
    },
    leavePolicies: {
      type: [{
        name: { type: String, required: true }, // e.g., 'Sick Leave'
        allowance: { type: Number, required: true }, // e.g., 12
        appliesTo: { type: String, enum: ['employee', 'intern', 'both'], default: 'both' }
      }],
      default: [
        { name: 'Casual Leave', allowance: 12, appliesTo: 'both' },
        { name: 'Sick Leave', allowance: 12, appliesTo: 'both' }
      ]
    }
  }
}, { timestamps: true });

// Update timestamp on save
CompanySchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

module.exports = { name: "Company", schema: CompanySchema };
