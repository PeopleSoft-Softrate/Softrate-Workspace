const express = require("express");
const router = express.Router();
const authController = require("../controllers/AuthController");
const verifyTenant = require("../middleware/tenant.middleware");
const multer = require("multer");
const rateLimit = require("express-rate-limit");

// ── Rate Limiting ──────────────────────────────────────────────────────────
// Brute-force protection: max 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes."
  }
});
// ──────────────────────────────────────────────────────────────────────────

const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
}).single("profilePhoto");

const handleProfilePhotoUpload = (req, res, next) => {
  profilePhotoUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.code === "LIMIT_FILE_SIZE"
          ? "Profile photo must be 2 MB or smaller"
          : "Unable to upload profile photo"
      });
    }

    next();
  });
};

router.post("/login", loginLimiter, authController.login);
router.post("/unified-login", loginLimiter, authController.login);
router.get("/me", verifyTenant, authController.getMe);
router.patch("/me/profile-photo", verifyTenant, handleProfilePhotoUpload, authController.updateProfilePhoto);
router.delete("/me/profile-photo", verifyTenant, authController.removeProfilePhoto);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/force-reset-password", verifyTenant, authController.forceResetPassword);
router.get("/verify-company/:code", authController.verifyCompany);
router.post("/device-change-request", authController.requestDeviceChange);

// MFA Routes
router.post("/mfa/verify-login", authController.verifyMfaLogin);
router.post("/mfa/setup", verifyTenant, authController.setupMfa);
router.post("/mfa/enable", verifyTenant, authController.enableMfa);
router.post("/mfa/disable", verifyTenant, authController.disableMfa);

module.exports = router;

