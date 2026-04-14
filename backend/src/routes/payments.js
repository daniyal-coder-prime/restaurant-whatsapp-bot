const router = require('express').Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// Upload screenshot (from N8N webhook)
router.post('/:orderId/screenshot', paymentController.uploadScreenshot);

// Manual verification (admin)
router.post('/:orderId/verify', authenticate, validate(schemas.verifyPayment), paymentController.verifyPayment);

// Get pending verifications
router.get('/pending', authenticate, paymentController.getPendingVerifications);

module.exports = router;
