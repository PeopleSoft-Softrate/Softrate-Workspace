const express = require('express');
const router = express.Router();
const templateController = require('./template.controller');

router.post('/', templateController.createTemplate);
router.get('/:companyCode', templateController.getTemplates);
router.delete('/:id', templateController.deleteTemplate);
router.put('/:id', templateController.updateTemplate);

module.exports = router;

