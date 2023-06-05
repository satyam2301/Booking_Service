const express = require('express');
const { InfoController } = require('../../controllers');
const router = express.Router();

router.get('/infosec', InfoController.info);

module.exports = router;
