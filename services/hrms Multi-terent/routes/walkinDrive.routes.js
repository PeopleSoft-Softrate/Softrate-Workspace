const express = require('express');
const router = express.Router();
const multer = require('multer');
const walkinDriveController = require('../controllers/walkinDriveController');
const walkinApplicationController = require('../controllers/walkinApplicationController');
const verifyTenant = require('../middleware/tenant.middleware');

// Use memory storage for multer and let the controller handle saving to disk
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', verifyTenant, upload.single('jdPdf'), walkinDriveController.createWalkinDrive);
router.get('/', verifyTenant, walkinDriveController.getWalkinDrives);

// Applications routes
router.get('/applications', verifyTenant, walkinApplicationController.getWalkinApplications);
router.patch('/applications/:id/status', verifyTenant, walkinApplicationController.updateWalkinApplicationStatus);

module.exports = router;
