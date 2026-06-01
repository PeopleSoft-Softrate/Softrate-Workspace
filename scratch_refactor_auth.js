const fs = require('fs');
const path = require('path');

const authPath = '/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/services/hrms Multi-terent/controllers/AuthController.js';
let content = fs.readFileSync(authPath, 'utf8');

// Replace top imports
content = content.replace(
  /const User = require\("\.\.\/models\/User"\);\s*const Employee = require\("\.\.\/models\/EmployeeModel"\);\s*const Intern = require\("\.\.\/models\/Intern"\);\s*const Role = require\("\.\.\/models\/Role"\);\s*const PasswordReset = require\("\.\.\/models\/PasswordReset"\);\s*const DeviceChangeRequest = require\("\.\.\/models\/DeviceChangeRequest"\);/g,
  `const { getMasterConnection, getTenantConnection } = require('../db');
const { getModelsForConnection } = require('../utilities/modelLoader');
const CompanyModelExport = require('../models/CompanyModel');`
);

// Replace findCurrentUser
content = content.replace(
  /async function findCurrentUser\(req, includePhoto = false\) \{[\s\S]*?return \{ user: null, role, Model: null \};\n\}/,
  `async function findCurrentUser(req, includePhoto = false) {
  const photoSelect = includePhoto ? PROFILE_PHOTO_SELECT : "";
  let role = "employee";
  const { User, Employee, Intern } = req.models; // Use dynamic models

  let query = User.findById(req.user.id).populate("roleId companyId departmentId branchId");
  if (photoSelect) query = query.select(photoSelect);
  let user = await query;
  if (user) {
    role = user.roleId?.name?.toLowerCase() || "hr";
    return { user, role, Model: User };
  }

  query = Employee.findById(req.user.id);
  if (photoSelect) query = query.select(photoSelect);
  user = await query;
  if (user) {
    role = user.isHr ? "hr" : (user.isManager ? "manager" : "employee");
    return { user, role, Model: Employee };
  }

  query = Intern.findById(req.user.id);
  if (photoSelect) query = query.select(photoSelect);
  user = await query;
  if (user) {
    role = user.isHr ? "hr" : "intern";
    return { user, role, Model: Intern };
  }

  return { user: null, role, Model: null };
}`
);

// Replace login function
content = content.replace(
  /exports\.login = async \(req, res\) \{[\s\S]*?^\};\n?/m,
  `exports.login = async (req, res) => {
  try {
    const { identifier, password, companyCode, deviceId } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Identifier and password are required" });
    }

    const id = identifier.trim();

    // 1. Resolve Tenant DB
    let dbName = 'hrdb';
    let companyId = null;

    if (companyCode) {
      const masterDb = getMasterConnection();
      const MasterCompany = masterDb.models.Company || masterDb.model('Company', CompanyModelExport.schema);
      const company = await MasterCompany.findOne({ companyCode: companyCode.toLowerCase() });
      if (!company) {
        return res.status(404).json({ success: false, message: "Company code not found" });
      }
      dbName = \`hrdb_\${company.companyCode}\`;
      companyId = company._id;
    }

    // 2. Connect to Tenant DB and load models
    const tenantDb = getTenantConnection(dbName);
    const { User, Employee, Intern, DeviceChangeRequest } = getModelsForConnection(tenantDb);

    let user = null;
    let role = null;

    // ── 2. Lookup ──
    console.log(\`[LOGIN] Identifier: \${id} in DB: \${dbName}\`);
    
    // Try Intern
    user = await Intern.findOne({
      $or: [
        { internid: { $regex: new RegExp(\`^\${id}$\`, "i") } },
        { email:    { $regex: new RegExp(\`^\${id}$\`, "i") } }
      ],
      status: { $nin: ['completed', 'drop'] }
    }).select(PROFILE_PHOTO_SELECT);
    if (user) {
      role = user.isHr ? "hr" : "intern";
      console.log(\`[LOGIN] Found in Intern collection. Role: \${role}\`);
    }

    // Try Employee / Manager
    if (!user) {
      user = await Employee.findOne({
        $or: [
          { EmployeeId: { $regex: new RegExp(\`^\${id}$\`, "i") } },
          { email:      { $regex: new RegExp(\`^\${id}$\`, "i") } }
        ],
        status: { $nin: ['resigned', 'terminated'] }
      }).select(PROFILE_PHOTO_SELECT);
      if (user) {
        role = user.isHr ? "hr" : (user.isManager ? "manager" : "employee");
        console.log(\`[LOGIN] Found in Employee collection. Role: \${role}\`);
      }
    }

    // Try HR (User)
    if (!user) {
      user = await User.findOne({
        $or: [
          { employeeId: { $regex: new RegExp(\`^\${id}$\`, "i") } },
          { email:      { $regex: new RegExp(\`^\${id}$\`, "i") } }
        ]
      }).select(\`+password \${PROFILE_PHOTO_SELECT}\`).populate('roleId');
      
      if (user) {
        role = user.roleId?.name?.toLowerCase() || "hr";
        console.log(\`[LOGIN] Found in User collection. Role: \${role}\`);
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "No account found with that ID or email" });
    }

    // ── 3. Password Verification ──
    let isMatch = false;
    if (!user.password || user.password === "") {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
      await user.save();
      isMatch = true;
    } else {
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
    const incomingDeviceId = deviceId;
    if (incomingDeviceId) {
      if (!user.deviceId) {
        user.deviceId = incomingDeviceId;
        await user.save();
      } else if (user.deviceId !== incomingDeviceId) {
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

    // ── 4. Token Generation ──
    const tokenPayload = {
      user: {
        id: user._id,
        companyId: companyId || user.companyId,
        dbName: dbName,
        role: role === 'intern' ? 'employee' : role,
        roleName: role.toUpperCase()
      }
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || "fallback_secret_key",
      { expiresIn: "7d" }
    );

    const response = { 
      success: true,
      role, 
      token, 
      auth_token: token, 
      user: serializeUser(user)
    };

    if (role === 'employee' || role === 'manager') {
      response.employee = response.user;
    }

    res.json(response);
  } catch (err) {
    console.error("Unified Login Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
`
);

// We should also replace verifyCompany and forgotPassword and requestDeviceChange,
// but for simplicity and phase boundaries, we'll replace the whole file using a proper approach next if needed.

fs.writeFileSync(authPath, content, 'utf8');
console.log('AuthController.js updated.');
