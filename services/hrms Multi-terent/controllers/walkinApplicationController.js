const path = require('path');
const fs = require('fs');
const Intern = require('../models/Intern');
const WalkinDrive = require('../models/WalkinDrive');
const { sendEmail } = require('../utilities/sendEmail');

/**
 * POST /api/public/walkin-apply
 * Handles a candidate's application to a Walk-in Drive.
 * - Saves application to Intern collection (with isWalkinDrive: true)
 * - Sends JD PDF to candidate's email
 * - Returns the WhatsApp group link for the mobile app to open
 */
exports.applyToWalkinDrive = async (req, res) => {
  try {
    const {
      walkinDriveId,
      fullName,
      email,
      college,
      year,
      department,
      role,
      contact,
      emergencyContact,
      linkedin,
      applicationType,
      resume,
      projectLinks: projectLinksRaw
    } = req.body;

    if (!walkinDriveId) {
      return res.status(400).json({ message: 'walkinDriveId is required.' });
    }
    if (!fullName || !email) {
      return res.status(400).json({ message: 'Full name and email are required.' });
    }

    // 1. Fetch the walkin drive to get JD PDF URL and WhatsApp link
    const drive = await WalkinDrive.findById(walkinDriveId);
    if (!drive) {
      return res.status(404).json({ message: 'Walk-in Drive not found.' });
    }

    // 2. Check for duplicate application
    const InternModel = req.models && req.models.Intern ? req.models.Intern : Intern;
    const existing = await InternModel.findOne({
      walkinDriveId,
      email,
      companyId: req.tenant.companyId,
      isWalkinDrive: true
    });
    if (existing) {
      return res.status(400).json({ message: 'You have already applied to this Walk-in Drive.' });
    }

    // 3. Parse project links
    let projectLinks = [];
    try {
      if (projectLinksRaw) {
        const parsed = JSON.parse(projectLinksRaw);
        if (Array.isArray(parsed)) {
          projectLinks = parsed.filter(l => l && l.trim()).slice(0, 5);
        }
      }
    } catch (_) { projectLinks = []; }

    // 4. Save the application
    const application = new InternModel({
      walkinDriveId,
      isWalkinDrive: true,
      companyId: req.tenant.companyId,
      fullName,
      email,
      college,
      year,
      department,
      role,
      contact,
      emergencyContact,
      linkedin,
      applicationType: applicationType || 'Walk-in Drive',
      // DO NOT SAVE RESUME IN DATABASE
      projectLinks,
      status: 'initial'
    });
    await application.save();

    // 5. Send Resume to HR Email (Same as Intern logic)
    if (resume) {
      try {
        const resumeBuffer = Buffer.from(resume, 'base64');
        await sendEmail({
          to: req.tenant.receivingEmail,
          subject: `New Walk-in Application - ${fullName}`,
          html: `
            <p>Hi Admin,</p>
            <p>A new candidate has applied for a Walk-in Drive.</p>
            <p><b>Candidate Name:</b> ${fullName}</p>
            <p><b>Email:</b> ${email}</p>
            <p><b>Role:</b> ${role}</p>
            <p>Please find their resume attached.</p>
          `,
          attachments: [{
            filename: `${fullName.replace(/\s+/g, '_')}_Resume.pdf`,
            content: resumeBuffer,
            contentType: 'application/pdf'
          }]
        });
      } catch (err) {
        console.error('[WalkinApply] Failed to send resume to HR:', err);
      }
    }

    // Return success with the WhatsApp link and JD PDF link
    res.status(200).json({
      message: 'Application submitted successfully!',
      whatsappGroupLink: drive.whatsappGroupLink,
      jdPdfUrl: drive.jdPdfUrl
    });

  } catch (error) {
    console.error('[WalkinApply] Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/walkin-drives/applications
 * Fetches Walk-in Applications for the tenant.
 */
exports.getWalkinApplications = async (req, res) => {
  try {
    const InternModel = req.models && req.models.Intern ? req.models.Intern : Intern;
    const query = { isWalkinDrive: true };
    if (req.tenant && req.tenant.companyId) {
      query.companyId = req.tenant.companyId;
    }
    const applications = await InternModel.find(query)
      .populate('walkinDriveId', 'startDate startTime role')
      .sort({ createdAt: -1 });
    res.status(200).json(applications);
  } catch (error) {
    console.error('Error fetching walkin applications:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * PATCH /api/walkin-drives/applications/:id/status
 * Updates the status of a walk-in application
 */
exports.updateWalkinApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const InternModel = req.models && req.models.Intern ? req.models.Intern : Intern;
    
    const application = await InternModel.findOneAndUpdate(
      { _id: req.params.id, companyId: req.tenant.companyId, isWalkinDrive: true },
      { status },
      { new: true }
    );
    
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    
    res.status(200).json({ message: 'Status updated successfully', application });
  } catch (error) {
    console.error('Error updating walkin application status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
