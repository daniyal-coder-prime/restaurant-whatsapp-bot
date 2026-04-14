const router = require('express').Router();
const authController = require('../controllers/authController');
const { validate, schemas } = require('../middleware/validate');

router.post('/register-restaurant', validate(schemas.registerRestaurant), authController.registerRestaurant);
router.post('/login', validate(schemas.login), authController.login);
router.post('/refresh-token', validate(schemas.refreshToken), authController.refreshToken);
router.post('/logout', authController.logout);

module.exports = router;
