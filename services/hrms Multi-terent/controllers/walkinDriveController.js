const WalkinDrive = require('../models/WalkinDrive');
const fs = require('fs');
const path = require('path');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

exports.createWalkinDrive = async (req, res) => {
  try {
    const { startDate, startTime, endDate, endTime, whatsappGroupLink } = req.body;
    let jdPdfUrl = '';

    if (req.file) {
      // Create a unique filename
      const fileName = `jd_${Date.now()}_${req.file.originalname}`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, req.file.buffer);
      jdPdfUrl = `/uploads/${fileName}`;
    } else {
      return res.status(400).json({ message: 'JD PDF is required.' });
    }

    // Use req.models (set by verifyTenant) to ensure correct tenant DB
    const WalkinDriveModel = req.models && req.models.WalkinDrive ? req.models.WalkinDrive : WalkinDrive;

    const newDrive = new WalkinDriveModel({
      startDate: new Date(startDate),
      startTime,
      endDate: new Date(endDate),
      endTime,
      jdPdfUrl,
      whatsappGroupLink,
      companyId: req.tenant ? req.tenant.companyId : null,
      createdBy: req.user ? req.user._id : null
    });

    await newDrive.save();
    res.status(201).json({ message: 'Walkin Drive created successfully', drive: newDrive });
  } catch (error) {
    console.error('Error creating walkin drive:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getWalkinDrives = async (req, res) => {
  try {
    const query = {};
    if (req.tenant && req.tenant.companyId) {
      query.companyId = req.tenant.companyId;
    }

    // Use req.models (set by verifyTenant/verifyPublicTenant) to ensure correct tenant DB
    const WalkinDriveModel = req.models && req.models.WalkinDrive ? req.models.WalkinDrive : WalkinDrive;

    const drives = await WalkinDriveModel.find(query).sort({ startDate: -1 });

    let result = drives;
    const isPublicRoute = req.originalUrl && req.originalUrl.includes('/public/walkin-drives');
    console.log('[Walkin Controller] req.query:', req.query, 'Original URL:', req.originalUrl, 'isPublic:', isPublicRoute);
    
    if (req.query.activeOnly === 'true' || isPublicRoute) {
      const now = new Date();
      result = drives.filter(drive => {
        if (!drive.endDate || !drive.endTime) return true;
        // Construct the end datetime
        const dateStr = drive.endDate.toISOString().split('T')[0]; // "YYYY-MM-DD"
        // Ensure time is zero-padded if necessary, endTime is expected like "14:30"
        const timeStr = drive.endTime;
        const endDateTime = new Date(`${dateStr}T${timeStr}:00`);
        console.log(`[Walkin Filter] Drive ID: ${drive._id} | EndDateTime: ${endDateTime} | Now: ${now} | Active: ${endDateTime > now}`);
        // If endDateTime is invalid (e.g. bad format), fallback to keeping it
        if (isNaN(endDateTime.getTime())) {
          return true;
        }
        return endDateTime > now;
      });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching walkin drives:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
