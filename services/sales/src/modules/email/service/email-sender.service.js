const { Resend } = require('resend');
const mongoose = require('mongoose');
const Employee = require('../../../../models/Employee');
const User = require('../../../../models/User');

/**
 * Sends an email on behalf of an employee using Resend.
 * @param {string} companyCode - The company code of the employee.
 * @param {string} employeeId - The ID of the employee sending the email.
 * @param {Object} mailOptions - The email options (to, subject, html, attachments, etc).
 */
async function sendEmailFromCRM(companyCode, employeeId, mailOptions) {
  try {
    // Look up the employee to get their name and email
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      throw new Error(`Employee with ID ${employeeId} not found.`);
    }

    // Look up the company (tenant) for configuration
    const user = await User.findOne({ companyCode }).select('-proposalTemplates');
    let compName = mailOptions.companyName || (user ? user.companyName : '');

    // API Key Resolution: ONLY use the Database Key. No fallback for security purposes!
    const apiKey = user?.resendApiKey;

    if (!apiKey) {
      throw new Error('Email sending is disabled. Your Admin has not configured the Email Integration settings yet.');
    }

    // Domain Resolution: Use DB first, then fallback to a generic domain if none provided
    const verifiedDomain = user?.resendSenderDomain
      ? user.resendSenderDomain
      : 'support.softrateglobal.com';

    // Instantiate a new Resend client scoped to this specific API key
    const resend = new Resend(apiKey);

    // Format the From address
    // Extract domain part if the env var was accidentally set as an email address (e.g., noreply@...)
    const domainOnly = verifiedDomain.includes('@') ? verifiedDomain.split('@')[1] : verifiedDomain;
    
    // Create a safe alias from the employee's name (e.g., "Leenatha" -> "leenatha")
    const employeeAlias = employee.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const senderEmail = `${employeeAlias}@${domainOnly}`;

    const fromName = compName ? `${employee.name} - ${compName}` : employee.name;
    const fromAddress = `"${fromName}" <${senderEmail}>`;

    // Construct the payload for Resend
    const payload = {
      from: fromAddress,
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html,
    };

    if (mailOptions.cc) {
      payload.cc = mailOptions.cc;
    }

    if (mailOptions.bcc) {
      payload.bcc = mailOptions.bcc;
    }

    if (employee.email) {
      payload.reply_to = employee.email;
    }

    if (mailOptions.attachments && mailOptions.attachments.length > 0) {
      payload.attachments = mailOptions.attachments;
    }

    // Send the email via Resend
    const { data, error } = await resend.emails.send(payload);

    if (error) {
      console.error('[sendEmailFromCRM] Resend Error:', error);
      throw new Error(error.message);
    }

    return data;
  } catch (err) {
    console.error('[sendEmailFromCRM] Error:', err);
    throw err;
  }
}

module.exports = {
  sendEmailFromCRM
};
