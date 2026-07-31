const express = require('express');
const router = express.Router();
const activitiesController = require('./activities.controller');

// Create a new activity
router.post('/', activitiesController.createActivity);

// Get activities for an employee
router.get('/employee/:employeeId', activitiesController.getEmployeeActivities);

module.exports = router;
