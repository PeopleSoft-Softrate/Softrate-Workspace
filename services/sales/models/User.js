const mongoose = require('mongoose');

const TEAM_SIZE_OPTIONS = ['1-5', '6-10', '11-15', '16-25', '26-50', '50+'];
const INDUSTRY_OPTIONS = [
  'IT / ITES',
  'BPO / KPO',
  'Banking & Finance',
  'Healthcare',
  'Retail & E-commerce',
  'Manufacturing',
  'Telecom',
  'Education',
  'Real Estate',
  'Other',
];

const userSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    companyAddress: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    countryCode: {
      type: String,
      required: [true, 'Country code is required'],
      trim: true,
      default: '+91'
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    companyCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true
    },
    teamSize: {
      type: String,
      required: [true, 'Team size is required'],
    },
    industry: {
      type: String,
      enum: INDUSTRY_OPTIONS,
      required: [true, 'Industry is required'],
    },
    status: {
      type: String,
      enum: ['Free-Trial-Request', 'Free-Trial', 'Paid', 'On due'],
      default: 'Free-Trial-Request',
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    trialStartDate: {
      type: Date,
    },
    tags: [{
      type: String,
      trim: true
    }],
    relationshipManager: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
      workingDays: { type: String, trim: true },
      workingHours: { type: String, trim: true }
    },
    rmRequestTime: {
      type: Date
    },
    // ── Email Integration ──
    emailIntegration: {
      provider: { type: String, default: 'resend' },
      resendApiKey: { type: String, trim: true, default: '' },
      resendSenderDomain: { type: String, trim: true, default: '' },
      isActive: { type: Boolean, default: false }
    },
    // ── Company-level App Settings ──
    breakHourLimit: {
      type: Number,
      default: 60, // minutes
    },
    connectedCallDuration: {
      type: Number,
      default: 30, // seconds — professional baseline
    },
    leadStatuses: {
      type: [String],
      default: [
        'New',
        'Converted',
        'Follow Up',
        'Not Interested',
        'Connected',
        'Invalid',
        'Not Connected',
        'Closed Lost'
      ],
    },
    interestedPageStatuses: {
      type: [String],
      default: ['Follow Up'],
    },
    dnpPageStatuses: {
      type: [String],
      default: ['Not Connected', 'Not Interested', 'Invalid'],
    },
    convertedPageStatuses: {
      type: [String],
      default: ['Converted'],
    },
    subscriptionTo: {
      type: Date,
    },
    // ── Invoice Generation Settings ──
    invoiceLogo: {
      type: String, // Base64 or URL
    },
    invoiceSeal: {
      type: String, // Base64 or URL
    },
    invoiceTerms: {
      type: String,
      trim: true,
    },
    quotationBannerText: {
      type: String,
      trim: true,
      default: 'Think Software,\nThink Softrate.',
    },
    showCompanyNameOnInvoice: {
      type: Boolean,
      default: true,
    },
    gstNumber: {
      type: String,
      trim: true,
    },
    gstPercentage: {
      type: Number,
      default: 18,
    },
    invoiceRegisteredAddress: {
      type: String,
      trim: true,
    },
    invoiceFooter: {
      type: String,
      trim: true,
    },
    bankDetails: {
      bankName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      branchName: { type: String, trim: true },
    },
    bankDetails2: {
      bankName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      branchName: { type: String, trim: true },
    },
    contactDetails: {
      website: { type: String, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    products: [{
      name: { type: String, required: true },
      minPrice: { type: Number, required: true },
      maxPrice: { type: Number, required: true },
      tags: [{ type: String, trim: true }],
      sacHsn: { type: String, trim: true },
    }],
    productRemarks: [String],
    // Active accepted collaboration partners (company codes)
    collaboratingCompanies: [{ type: String, trim: true }],
    // Invites this company has SENT
    sentInvites: [{
      companyCode: { type: String, trim: true, uppercase: true },
      companyName: { type: String, trim: true },
      status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
      sentAt: { type: Date, default: Date.now }
    }],
    // Invites this company has RECEIVED
    receivedInvites: [{
      fromCompanyCode: { type: String, trim: true, uppercase: true },
      fromCompanyName: { type: String, trim: true },
      status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
      receivedAt: { type: Date, default: Date.now }
    }],
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    resendApiKey: { type: String, trim: true },
    resendSenderDomain: { type: String, trim: true },
    // ── Proposal Templates ──
    proposalTemplates: [{
      _id: { type: String },
      name: { type: String, trim: true },
      pages: { type: Array, default: [] },
      createdAt: { type: Date },
      updatedAt: { type: Date },
    }],
  },
  {
    timestamps: true, 
  }
);

module.exports = mongoose.model('User', userSchema);
module.exports.INDUSTRY_OPTIONS = INDUSTRY_OPTIONS;
module.exports.INDUSTRY_OPTIONS = INDUSTRY_OPTIONS;
