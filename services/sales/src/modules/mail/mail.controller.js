const nodemailer = require('nodemailer');

// Set up the transporter using environment variables (to be filled in later)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: process.env.SMTP_PORT || 465,
  secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'your-email@domain.com',
    pass: process.env.SMTP_PASS || 'your-password'
  }
});

exports.sendMail = async (req, res) => {
  try {
    const { to, subject, html } = req.body;
    
    // Multer places uploaded files in req.files
    const attachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype
    })) : [];

    const mailOptions = {
      from: process.env.SMTP_USER || 'your-email@domain.com', // Sender address must match authenticated user
      to,
      subject,
      html,
      attachments
    };

    // If SMTP_USER is just the dummy default, don't actually try to send, just simulate
    if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@domain.com') {
      console.log('--- SIMULATED EMAIL (Credentials missing) ---');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('Attachments:', attachments.length);
      console.log('HTML Body Preview:', html.substring(0, 100) + '...');
      return res.status(200).json({ success: true, message: 'Simulated email sent successfully! (Configure .env to send for real)' });
    }

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    
    res.status(200).json({ success: true, message: 'Email sent successfully!', messageId: info.messageId });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, message: 'Failed to send email.', error: error.message });
  }
};
