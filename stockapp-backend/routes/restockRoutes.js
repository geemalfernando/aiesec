// routes/restockRoutes.js
const express = require('express');
const { recordRestock, getRestocks } = require('../controllers/restockController');

const router = express.Router();

router.post('/', recordRestock);
router.get('/', getRestocks);

module.exports = router;
