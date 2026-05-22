const express = require("express");
const router = express.Router();
const authController = require("../controllers/AuthController");
const verifyTenant = require("../middleware/tenant.middleware");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const Intern = require("../models/Intern");
const Employee = require("../models/EmployeeModel");
const User = require("../models/User");

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

router.post("/login", authController.login);
router.post("/unified-login", authController.login);
router.get("/me", verifyTenant, authController.getMe);
router.patch("/me/profile-photo", verifyTenant, handleProfilePhotoUpload, authController.updateProfilePhoto);
router.delete("/me/profile-photo", verifyTenant, authController.removeProfilePhoto);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/verify-company/:code", authController.verifyCompany);

module.exports = router;
