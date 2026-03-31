// routes/transferRoutes.js — Express router for /api/v1/transfers

const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
// const { authenticate } = require('../middleware/auth');

router.get('/',               transferController.getAllTransfers);
router.get('/roi/:clubId',    transferController.getClubTransferROI);
router.get('/:id',            transferController.getTransferById);
router.post('/',   /* authenticate, */ transferController.createTransfer);
router.put('/:id', /* authenticate, */ transferController.updateTransfer);
router.delete('/:id', /* authenticate, */ transferController.deleteTransfer);

module.exports = router;
