const { getMasterConnection, getTenantConnection, waitForConnection } = require('../db');
const { getModelsForConnection } = require('../utilities/modelLoader');
const CompanyModelExport = require('../models/CompanyModel');
const { sendEmail, LOGO_URL } = require("../utilities/sendEmail");
const { getSignature } = require("../utilities/emailSignature");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const PROFILE_PHOTO_SELECT = "+profilePhoto.data";

function profilePhotoToDataUrl(profilePhoto) {
  const rawData = profilePhoto?.data;
  if (!rawData) return null;

  let buffer = null;
  if (Buffer.isBuffer(rawData)) {
    buffer = rawData;
  } else if (rawData.buffer && Buffer.isBuffer(rawData.buffer)) {
    buffer = rawData.buffer;
  } else if (Array.isArray(rawData.data)) {
    buffer = Buffer.from(rawData.data);
  }

  if (!buffer?.length) return null;

  const contentType = profilePhoto.contentType || "image/png";
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

function serializeUser(userDoc) {
  const user = userDoc?.toObject ? userDoc.toObject() : userDoc;
  if (!user) return user;

  const profilePhotoUrl = profilePhotoToDataUrl(user.profilePhoto);
  if (profilePhotoUrl) {
    user.profilePhotoUrl = profilePhotoUrl;
    user.profilePhoto = {
      contentType: user.profilePhoto.contentType,
      size: user.profilePhoto.size,
      updatedAt: user.profilePhoto.updatedAt,
      url: profilePhotoUrl
    };
  } else {
    delete user.profilePhoto;
  }

  if (user.password) delete user.password;
  return user;
}

async function findCurrentUser(req, includePhoto = false) {
  const photoSelect = includePhoto ? PROFILE_PHOTO_SELECT : "";
  const { User, Employee, Intern } = req.models;

  // Use the role encoded in JWT to target the right collection directly.
  // This avoids the 3-collection sequential waterfall.
  const role = req.user?.role || req.user?.roleName?.toLowerCase();

  let Model, resolvedRole;
  if (role === 'hr' || role === 'admin') {
    Model = User;
    resolvedRole = role;
  } else if (role === 'employee' || role === 'manager') {
    Model = Employee;
    resolvedRole = role;
  } else {
    // Default / intern / unknown — check Intern first, fallback to Employee
    Model = Intern;
    resolvedRole = 'intern';
  }

  let query = Model.findById(req.user.id);
  if (photoSelect) query = query.select(photoSelect);
  if (Model === User) {
    query = query.populate('roleId companyId departmentId branchId');
  } else {
    query = query.populate({ path: 'assignedManager', select: 'fullName email phone contact' });
  }

  let user = await query;

  // Fallback: if not found in primary model, try others (handles stale tokens)
  if (!user) {
    const fallbacks = [User, Employee, Intern].filter(m => m !== Model);
    for (const FallbackModel of fallbacks) {
      let fq = FallbackModel.findById(req.user.id);
      if (photoSelect) fq = fq.select(photoSelect);
      if (FallbackModel === User) {
        fq = fq.populate('roleId companyId departmentId branchId');
      } else {
        fq = fq.populate({ path: 'assignedManager', select: 'fullName email phone contact' });
      }
      user = await fq;
      if (user) {
        Model = FallbackModel;
        resolvedRole = FallbackModel === User ? (user.roleId?.name?.toLowerCase() || 'hr')
          : FallbackModel === Employee ? (user.isHr ? 'hr' : user.isManager ? 'manager' : 'employee')
            : (user.isHr ? 'hr' : 'intern');
        break;
      }
    }
  }

  if (!user) return { user: null, role: resolvedRole, Model: null };
  return { user, role: resolvedRole, Model };
}

/**
 * Unified Login for all user types (HR, Employee, Intern, Manager)
 * Accepts: identifier (email/ID) + password + optional companyCode
 */
exports.login = async (req, res) => {
  try {
    const { identifier, password, companyCode } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Identifier and password are required" });
    }

    const id = identifier.trim();

    // ── 1. Resolve Tenant DB ──
    // If companyCode is provided, look up by the original code (can contain dots).
    // The sanitized dbName is stored on the company record itself.
    // If no companyCode, fall back to legacy 'hrdb' for backwards compatibility.
    let dbName = 'hrdb';
    let resolvedCompany = null;

    if (companyCode && companyCode.trim()) {
      const cleanCode = companyCode.trim();
      const masterDb = getMasterConnection();
      await waitForConnection(masterDb);
      const MasterCompany = masterDb.models.Company || masterDb.model('Company', CompanyModelExport.schema);
      // Escape dots for regex, then match case-insensitively
      const escapedCode = cleanCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      resolvedCompany = await MasterCompany.findOne({ companyCode: { $regex: new RegExp(`^${escapedCode}$`, 'i') } });
      if (!resolvedCompany) {
        return res.status(404).json({ success: false, message: "Company not found. Please check your Company Code." });
      }
      // Use the pre-computed dbName stored on the record
      dbName = resolvedCompany.dbName || `hrdb_${cleanCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
    }

    const tenantConn = getTenantConnection(dbName);
    await waitForConnection(tenantConn);
    const { Intern, Employee, User, DeviceChangeRequest } = getModelsForConnection(tenantConn);

    // ── Special Reviewer Bypass Handling ──
    if (id.toLowerCase() === "test@peoplesoft" && password === "123456") {
      let reviewerUser = await Intern.findOne({ email: "demo001@gmail.com" }).select(PROFILE_PHOTO_SELECT);
      let reviewerRole = "intern";

      if (!reviewerUser) {
        reviewerUser = await Employee.findOne({ isManager: false }).select(PROFILE_PHOTO_SELECT);
        reviewerRole = "employee";
      }

      if (reviewerUser) {
        const tokenPayload = {
          user: {
            id: reviewerUser._id,
            companyId: reviewerUser.companyId,
            dbName: dbName,
            role: reviewerRole === 'intern' ? 'employee' : reviewerRole,
            roleName: reviewerRole.toUpperCase()
          }
        };

        const token = jwt.sign(
          tokenPayload,
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        const responseUser = serializeUser(reviewerUser);

        return res.json({
          success: true,
          role: reviewerRole,
          token,
          auth_token: token,
          user: responseUser,
          intern: responseUser,
          employee: responseUser
        });
      }
    }
    // ── 2. Lookup — normalize identifier, use exact match (enables index hit) ──
    // Lowercase the identifier so indexes with collation or lowercase emails match.
    let user = null;
    let role = null;
    const normalizedId = id.toLowerCase();

    // Try Intern (exact match, case-insensitive via lowercased value)
    user = await Intern.findOne({
      $or: [
        { internid: { $regex: new RegExp(`^${normalizedId}$`, "i") } },
        { email: normalizedId }
      ],
      status: { $nin: ['completed', 'drop'] }
    }).select(PROFILE_PHOTO_SELECT);
    if (user) {
      role = user.isHr ? "hr" : "intern";
    }

    // Try Employee / Manager
    if (!user) {
      user = await Employee.findOne({
        $or: [
          { EmployeeId: { $regex: new RegExp(`^${normalizedId}$`, "i") } },
          { email: normalizedId }
        ],
        status: { $nin: ['resigned', 'terminated'] }
      }).select(PROFILE_PHOTO_SELECT);
      if (user) {
        role = user.isHr ? "hr" : (user.isManager ? "manager" : "employee");
      }
    }

    // Try HR (User)
    if (!user) {
      user = await User.findOne({
        $or: [
          { employeeId: { $regex: new RegExp(`^${normalizedId}$`, "i") } },
          { email: normalizedId }
        ]
      }).select(`+password ${PROFILE_PHOTO_SELECT}`).populate('roleId');

      if (user) {
        role = user.roleId?.name?.toLowerCase() || "hr";
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "No account found with that ID or email" });
    }

    if (user.status === 'initial') {
      return res.status(403).json({ success: false, message: "Your application is still pending HR approval. Please wait until your account is approved." });
    }

    // ── 3.1 Get Company Settings for Default Password ──
    if (!resolvedCompany) {
      const masterDb = getMasterConnection();
      await waitForConnection(masterDb);
      const MasterCompany = masterDb.models.Company || masterDb.model('Company', CompanyModelExport.schema);
      resolvedCompany = await MasterCompany.findById(user.companyId);
    }

    let forcePasswordReset = false;
    let isMatch = false;

    // Check if entered password matches the company default password
    if (resolvedCompany && resolvedCompany.settings?.defaultPassword && password === resolvedCompany.settings.defaultPassword) {
      isMatch = true;
      forcePasswordReset = true;
    } else {
      // ── 3. Normal Password Verification ──
      if (!user.password || user.password === "") {
        return res.status(401).json({ success: false, message: "Your account is not fully set up. Please contact HR." });
      }

      const isHashed = user.password.startsWith("$2a$") || user.password.startsWith("$2b$");
      if (isHashed) {
        isMatch = await bcrypt.compare(password, user.password);
      } else {
        isMatch = user.password === password;
        if (isMatch) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(password, salt);
          await user.save();
        }
      }
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Incorrect password" });
    }

    // ── 3.5 Device Binding Check ──
    const incomingDeviceId = req.body.deviceId;
    if (incomingDeviceId) {
      if (!user.deviceId) {
        user.deviceId = incomingDeviceId;
        await user.save();
      } else if (user.deviceId !== incomingDeviceId) {
        // Mismatch! Check if there's a pending request
        const existingRequest = await DeviceChangeRequest.findOne({
          userId: user._id,
          status: "pending"
        });

        return res.status(403).json({
          success: false,
          code: "DEVICE_MISMATCH",
          message: "This account is bound to another device.",
          requestStatus: existingRequest ? (existingRequest.managerApprovalStatus === 'approved' ? 'Pending HR Approval' : 'Pending Manager Approval') : null
        });
      }
    }

    // ── 4. Token Generation ── (include dbName so middleware routes correctly)
    const tokenPayload = {
      user: {
        id: user._id,
        companyId: user.companyId,
        dbName: dbName,
        role: role === 'intern' ? 'employee' : role,
        roleName: role.toUpperCase()
      }
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const response = {
      success: true,
      role,
      token,
      auth_token: token,
      user: serializeUser(user),
      forcePasswordReset
    };

    // Web portal compatibility
    if (role === 'employee' || role === 'manager') {
      response.employee = response.user;
      // Include completeDetails flag so Flutter can show post-login complete-details screen
      response.completeDetails = user.completeDetails === true;
    }

    res.json(response);
  } catch (err) {
    console.error("Unified Login Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Get current user profile
 */
exports.getMe = async (req, res) => {
  try {
    const { user, role } = await findCurrentUser(req, true);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, user: serializeUser(user), role });
  } catch (err) {
    console.error("getMe Error:", err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateProfilePhoto = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "Profile photo is required" });
    }

    if (!file.mimetype?.startsWith("image/")) {
      return res.status(400).json({ success: false, message: "Only image files are allowed" });
    }

    const { user, role, Model } = await findCurrentUser(req);
    if (!user || !Model) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const updatedUser = await Model.findOneAndUpdate(
      { _id: user._id, companyId: req.tenant.companyId },
      {
        $set: {
          profilePhoto: {
            data: file.buffer,
            contentType: file.mimetype,
            size: file.size,
            updatedAt: new Date()
          }
        }
      },
      { new: true }
    ).select(PROFILE_PHOTO_SELECT);

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Profile photo updated",
      user: serializeUser(updatedUser),
      role
    });
  } catch (err) {
    console.error("updateProfilePhoto Error:", err);
    res.status(500).json({ success: false, message: "Unable to update profile photo" });
  }
};

exports.removeProfilePhoto = async (req, res) => {
  try {
    const { user, role, Model } = await findCurrentUser(req);
    if (!user || !Model) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const updatedUser = await Model.findOneAndUpdate(
      { _id: user._id, companyId: req.tenant.companyId },
      { $unset: { profilePhoto: "" } },
      { new: true }
    ).select(PROFILE_PHOTO_SELECT);

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Profile photo removed",
      user: serializeUser(updatedUser),
      role
    });
  } catch (err) {
    console.error("removeProfilePhoto Error:", err);
    res.status(500).json({ success: false, message: "Unable to remove profile photo" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // Search in unified User collection
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user exists with this email address."
      });
    }

    const name = (user.profile.firstName + (user.profile.lastName ? ' ' + user.profile.lastName : ''))
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    // Generate token valid for 5 mins
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Clean up old tokens for this email
    await PasswordReset.deleteMany({ email });

    await PasswordReset.create({
      email,
      userType: 'unified', // Marking as unified for future proofing
      token,
      expiresAt
    });

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const resetLink = `${protocol}://${host}/reset-password.html?token=${token}`;

    await sendEmail({
      to: email,
      subject: "Password Reset Request – Softrate Global",
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <p>Dear ${name},</p>
          <p>We received a request to reset your password for your Softrate Global account.</p>
          <p>Please click the link below to set a new password. This link is valid for 5 minutes only:</p>
          <p><a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #0089d1; color: #fff; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
          <p>Or copy and paste this link into your browser:</p>
          <p>${resetLink}</p>
          <p>If you did not request a password reset, you can safely ignore this email.</p>
          ${getSignature(LOGO_URL)}
        </div>
      `
    });

    res.status(200).json({
      success: true,
      message: "Reset link has been sent to your email."
    });

  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: "Token and new password are required" });
    }

    const resetRequest = await PasswordReset.findOne({ token });
    if (!resetRequest) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset link." });
    }

    if (new Date() > resetRequest.expiresAt) {
      await PasswordReset.deleteOne({ token });
      return res.status(400).json({ success: false, message: "Reset link has expired." });
    }

    const user = await User.findOne({ email: resetRequest.email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    // Invalidate the token
    await PasswordReset.deleteOne({ token });

    res.status(200).json({
      success: true,
      message: "Password reset successful! You can now log in with your new password."
    });

  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Publicly verify a company code and return basic settings
 */
exports.verifyCompany = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ success: false, message: "Company code is required" });
    }

    const Company = await _AuthControllerjs_getMasterCompany();
    const company = await Company.findOne({ companyCode: code.toUpperCase() });

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const companyObj = company.toObject();
    const settings = companyObj.settings || {};
    const employeeRoles = Array.from(new Set([...(settings.employeeRoles || []), 'Other']));
    const internRoles = Array.from(new Set([...(settings.internRoles || []), 'Other']));

    res.json({
      success: true,
      company: {
        id: company._id,
        name: company.name,
        logo: company.logo,
        settings: {
          themeColor: settings.themeColor || '#00657F',
          employeeRoles: employeeRoles,
          internRoles: internRoles
        }
      }
    });
  } catch (err) {
    console.error("Verify Company Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Request Device Change
 */
exports.requestDeviceChange = async (req, res) => {
  try {
    const { id, password, companyCode, newDeviceId, reason } = req.body; // id is the email/employeeId

    if (!id || !password || !newDeviceId || !reason) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    let dbName = 'hrdb';
    if (companyCode && companyCode.trim()) {
      const cleanCode = companyCode.trim();
      const masterDb = getMasterConnection();
      await waitForConnection(masterDb);
      const MasterCompany = masterDb.models.Company || masterDb.model('Company', CompanyModelExport.schema);
      const escapedCode = cleanCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const resolvedCompany = await MasterCompany.findOne({ companyCode: { $regex: new RegExp(`^${escapedCode}$`, 'i') } });
      if (!resolvedCompany) {
        return res.status(404).json({ success: false, message: "Company not found. Please check your Company Code." });
      }
      dbName = resolvedCompany.dbName || `hrdb_${cleanCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
    }

    const tenantConn = getTenantConnection(dbName);
    await waitForConnection(tenantConn);
    const { Intern, Employee, User, DeviceChangeRequest } = getModelsForConnection(tenantConn);

    // Lookup user to get their companyId and oldDeviceId
    let user = null;
    let userModel = "User";

    user = await Intern.findOne({
      $or: [{ internid: { $regex: new RegExp(`^${id}$`, "i") } }, { email: { $regex: new RegExp(`^${id}$`, "i") } }]
    });
    if (user) { userModel = "Intern"; }

    if (!user) {
      user = await Employee.findOne({
        $or: [{ EmployeeId: { $regex: new RegExp(`^${id}$`, "i") } }, { email: { $regex: new RegExp(`^${id}$`, "i") } }]
      });
      if (user) { userModel = "Employee"; }
    }

    if (!user) {
      user = await User.findOne({
        $or: [{ employeeId: { $regex: new RegExp(`^${id}$`, "i") } }, { email: { $regex: new RegExp(`^${id}$`, "i") } }]
      });
      if (user) { userModel = "User"; }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Verify Password
    const bcrypt = require("bcryptjs");
    const isHashed = user.password && (user.password.startsWith("$2a$") || user.password.startsWith("$2b$"));
    let isMatch = false;

    if (isHashed) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = user.password === password;
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Incorrect password" });
    }

    // Check for existing pending request
    const existing = await DeviceChangeRequest.findOne({ userId: user._id, status: "pending" });
    if (existing) {
      return res.status(400).json({ success: false, message: "A request is already pending for this account." });
    }

    const hasManager = !!user.assignedManager;

    // Create the request
    const request = new DeviceChangeRequest({
      companyId: user.companyId,
      userId: user._id,
      userModel: userModel,
      oldDeviceId: user.deviceId || "unknown",
      newDeviceId: newDeviceId,
      reason: reason,
      managerApprovalStatus: hasManager ? "pending" : "approved"
    });

    await request.save();

    res.json({ success: true, message: "Device change request submitted successfully." });
  } catch (err) {
    console.error("Device Change Request Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Force Password Reset (Used after login with default password)
 */
exports.forceResetPassword = async (req, res) => {
  try {
    const userId = req.body.userId || (req.user && (req.user._id || req.user.id));
    const { newPassword } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'New Password is required' });
    }

    // Server-side validation
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long, contain at least 1 uppercase letter, and 1 symbol.'
      });
    }

    const { getModelsForConnection } = require('../utilities/modelLoader');
    const dbName = req.tenant?.dbName || 'hrdb';
    const tenantDb = getTenantConnection(dbName);
    const tenantModels = getModelsForConnection(tenantDb);
    const User = tenantModels.User;
    const Employee = tenantModels.Employee;
    const Intern = tenantModels.Intern;

    // Find the user in any of the collections to get their email/identifier
    let targetUser = await User.findById(userId);
    if (!targetUser) targetUser = await Employee.findById(userId);
    if (!targetUser) targetUser = await Intern.findById(userId);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const email = targetUser.email;
    const phone = targetUser.profile?.phone || targetUser.phone;

    const bcrypt = require("bcryptjs");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    let updatedAny = false;

    // Update in User collection
    if (email || phone) {
      const userDoc = await User.findOne({ $or: [{ email }, { "profile.phone": phone }] });
      if (userDoc) {
        userDoc.password = hashedPassword;
        await userDoc.save();
        updatedAny = true;
      }

      // Update in Employee collection
      const empDoc = await Employee.findOne({ $or: [{ email }, { phone }] });
      if (empDoc) {
        empDoc.password = hashedPassword;
        await empDoc.save();
        updatedAny = true;
      }

      // Update in Intern collection
      const internDoc = await Intern.findOne({ $or: [{ email }, { contact: phone }] });
      if (internDoc) {
        internDoc.password = hashedPassword;
        await internDoc.save();
        updatedAny = true;
      }
    } else {
      // Fallback if no email/phone (shouldn't happen)
      targetUser.password = hashedPassword;
      await targetUser.save();
      updatedAny = true;
    }

    if (!updatedAny) {
      return res.status(500).json({ success: false, message: 'Failed to update password' });
    }

    res.json({ success: true, message: 'Password has been successfully updated.' });
  } catch (err) {
    console.error("Force Reset Password Error:", err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};
