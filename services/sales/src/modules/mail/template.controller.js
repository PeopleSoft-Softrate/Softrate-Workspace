const EmailTemplate = require('../../../models/EmailTemplate');

exports.createTemplate = async (req, res) => {
  try {
    const { companyCode, name, subject, description } = req.body;
    if (!companyCode || !name || !subject || !description) {
      return res.status(400).json({ success: false, message: 'Missing required fields: companyCode, name, subject, description' });
    }
    const template = new EmailTemplate({
      companyCode,
      name,
      subject,
      description,
      createdBy: req.user ? req.user._id : 'admin'
    });
    await template.save();
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getTemplates = async (req, res) => {
  try {
    const { companyCode } = req.params;
    const templates = await EmailTemplate.find({ companyCode }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: templates });
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    await EmailTemplate.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Template deleted' });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject, description } = req.body;
    
    if (!name || !subject || !description) {
      return res.status(400).json({ success: false, message: 'Missing required fields: name, subject, description' });
    }

    const template = await EmailTemplate.findByIdAndUpdate(
      id,
      { name, subject, description },
      { new: true }
    );

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    res.status(200).json({ success: true, data: template });
  } catch (err) {
    console.error('Error updating template:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
