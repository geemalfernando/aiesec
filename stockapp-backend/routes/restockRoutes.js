// routes/restockRoutes.js
const express = require('express');
const { recordRestock, getRestocks, saveRestockImage } = require('../controllers/restockController');

const router = express.Router();

router.post('/', recordRestock);
router.get('/', getRestocks);
router.post('/:restockId/image', express.raw({ type: 'image/*', limit: '25mb' }), saveRestockImage);

module.exports = router;
