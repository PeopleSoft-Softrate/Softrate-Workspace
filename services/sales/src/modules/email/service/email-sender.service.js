const nodemailer = require('nodemailer');
const { getConnection, decrypt } = require('./email.service');

/**
 * Sends an email using the connected Google Workspace account for the given employee.
 * @param {string} companyCode 
 * @param {string} userId
 * @param {object} mailOptions { to, subject, html, attachments }
 */
async function sendEmailFromCRM(companyCode, userId, mailOptions) {
  // 1. Check if employee has a Google Workspace connection
  const connection = await getConnection(companyCode, userId);
  if (!connection || !connection.connected || !connection.refreshToken) {
    throw new Error('Email sending failed: Google Workspace is not connected for this company.');
  }

  // 2. Decrypt the refresh token securely
  let refreshToken;
  try {
    refreshToken = decrypt(connection.refreshToken);
  } catch (err) {
    throw new Error('Email sending failed: Unable to decrypt Google credentials.');
  }

  // 3. Configure Nodemailer with OAuth2
  // Nodemailer automatically handles fetching a fresh Access Token using the Refresh Token!
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: connection.email,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: refreshToken
    }
  });

  // 4. Force the 'from' address to match the authenticated Google account
  // (Gmail API will reject the email if 'from' doesn't match the authenticated user)
  const finalMailOptions = {
    ...mailOptions,
    from: connection.email
  };

  // 5. Send the email
  const info = await transporter.sendMail(finalMailOptions);
  return info;
}

module.exports = {
  sendEmailFromCRM
};
