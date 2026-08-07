const { sendEmailFromCRM } = require('../service/email-sender.service');
const User = require('../../../../models/User');

/**
 * Controller to handle email sending logic.
 */
async function sendEmailFromCRMController(req, res) {
  try {
    const { to, cc, bcc, subject, html, authCompanyName, contactNumber, contactName, companyName } = req.body;
    
    if (!to || !subject || !html) {
      return res.status(400).json({ success: false, message: 'Missing required email fields.' });
    }
    
    // Format attachments for Resend
    const attachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      content: file.buffer, // Resend accepts buffers
    })) : [];

    const mailOptions = {
      to,
      cc,
      bcc,
      subject,
      html,
      attachments,
      companyName: authCompanyName
    };

    // Send email using Resend
    const info = await sendEmailFromCRM(req.companyCode, req.userId, mailOptions);
    
    // Log history if lead details are provided
    if (contactNumber && req.models && req.models.History) {
      try {
        await req.models.History.create({
          companyCode: req.companyCode,
          contactNumber: contactNumber,
          contactName: contactName || '',
          companyName: companyName || '',
          action: 'Email Sent',
          details: `Email sent to ${to}. Subject: ${subject}`,
          changedBy: (req.userId && req.userId !== 'admin') ? req.userId : null
        });
      } catch (historyErr) {
        console.error('[sendEmailFromCRMController] History Log Error:', historyErr.message);
      }
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully via Resend!', 
      info 
    });

  } catch (error) {
    console.error('[sendEmailFromCRMController] Error:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to send email.', 
      error: error.message 
    });
  }
}

async function getEmailStatus(req, res) {
  try {
    const user = await User.findOne({ companyCode: req.companyCode });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    const connected = !!user.resendApiKey;
    let domain = user.resendSenderDomain || 'support.softrateglobal.com';
    if (domain.includes('@')) domain = domain.split('@')[1];

    return res.status(200).json({
      success: true,
      connected,
      provider: 'resend',
      email: domain
    });
  } catch (error) {
    console.error('[getEmailStatus] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch email status' });
  }
}

module.exports = {
  sendEmailFromCRMController,
  getEmailStatus
};
