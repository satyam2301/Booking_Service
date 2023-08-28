const express = require('express');
const { InfoController } = require('../../controllers');
const bookingRoutes = require('./booking-routes');
const router = express.Router();

router.get('/info', InfoController.info);
router.use('/booking', bookingRoutes);
module.exports = router;
