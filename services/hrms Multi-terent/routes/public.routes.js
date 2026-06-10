const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const verifyPublicTenant = require('../middleware/publicTenant.middleware');

// We use the tenant context to fetch from the correct DB
router.get("/id-card/:id", verifyPublicTenant, async (req, res) => {
  try {
    const { id } = req.params;
    let person = null;
    let type = null;
    let user = null;

    // We can get the models from req.models which was set by verifyPublicTenant
    const { Intern, Employee, User } = req.models;

    // Check Intern
    if (Intern) {
      person = await Intern.findOne({ internid: { $regex: new RegExp(`^${id}$`, 'i') }, companyId: req.tenant.companyId }).select('+profilePhoto.data');
      if (!person && mongoose.Types.ObjectId.isValid(id)) {
        person = await Intern.findOne({ _id: id, companyId: req.tenant.companyId }).select('+profilePhoto.data');
      }
    }
    
    if (person) {
       type = 'intern';
    } else if (Employee) {
       // Check Employee
       person = await Employee.findOne({ EmployeeId: { $regex: new RegExp(`^${id}$`, 'i') }, companyId: req.tenant.companyId }).select('+profilePhoto.data');
       if (!person && mongoose.Types.ObjectId.isValid(id)) {
         person = await Employee.findOne({ _id: id, companyId: req.tenant.companyId }).select('+profilePhoto.data');
       }
       if (person) type = 'employee';
    }

    if (!person) {
      return res.status(404).json({ success: false, message: "ID Card not found" });
    }

    if (User) {
       user = await User.findOne({ email: { $regex: new RegExp(`^${person.email.trim()}$`, 'i') }, companyId: req.tenant.companyId }).select('+profilePhoto.data');
    }

    // Build public profile
    let profilePhotoDataUrl = null;
    let photoData = user?.profilePhoto?.data || person.profilePhoto?.data;
    let contentType = user?.profilePhoto?.contentType || person.profilePhoto?.contentType || 'image/jpeg';
    
    if (photoData) {
      let buffer = null;
      if (Buffer.isBuffer(photoData)) buffer = photoData;
      else if (photoData.buffer && Buffer.isBuffer(photoData.buffer)) buffer = photoData.buffer;
      else if (Array.isArray(photoData.data)) buffer = Buffer.from(photoData.data);
      
      if (buffer && buffer.length) {
        profilePhotoDataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
      }
    }

    // Fetch master company to get the logo
    const { getMasterConnection } = require('../db');
    const masterDb = getMasterConnection();
    const CompanyModelExport = require('../models/CompanyModel');
    const MasterCompany = masterDb.models.Company || masterDb.model('Company', CompanyModelExport.schema);
    const company = await MasterCompany.findById(req.tenant.companyId);

    res.json({
      success: true,
      data: {
        fullName: person.fullName,
        id: type === 'intern' ? person.internid : person.EmployeeId,
        role: person.role || person.designation,
        type: type,
        profilePhoto: profilePhotoDataUrl,
        companyCode: req.tenant.companyCode,
        companyName: company?.settings?.offerLetterSettings?.companyName || 'Softrate Global',
        companyLogo: company?.settings?.communication?.emailLogoUrl || null,
        virtualIdTemplate: company?.settings?.offerLetterSettings?.documentTemplates?.virtualIdCard || null
      }
    });

  } catch (err) {
    console.error("Public ID Card Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
