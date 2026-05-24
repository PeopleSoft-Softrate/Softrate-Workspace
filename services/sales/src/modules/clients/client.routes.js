const express = require('express');
const {
  createManualClient,
  listClients,
  mapClient,
} = require('../../../services/clientService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const payload = await listClients(req.query);
    return res.json(payload);
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to load clients.',
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await createManualClient(req.body || {});
    return res.status(result.created ? 201 : 200).json({
      success: true,
      client: mapClient(result.client),
      duplicate: result.duplicate,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to onboard client.',
      client: err.client,
    });
  }
});

module.exports = router;
