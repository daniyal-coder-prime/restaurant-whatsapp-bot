const router = require('express').Router();
const restaurantController = require('../controllers/restaurantController');
const { authenticate, authorizeRoles, authorizeRestaurant } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.get('/:id', authenticate, authorizeRestaurant, restaurantController.getRestaurant);
router.put('/:id', authenticate, authorizeRestaurant, authorizeRoles('owner', 'manager'), validate(schemas.updateRestaurant), restaurantController.updateRestaurant);
router.get('/:id/settings', authenticate, authorizeRestaurant, authorizeRoles('owner'), restaurantController.getSettings);
router.post('/:id/bank-details', authenticate, authorizeRestaurant, authorizeRoles('owner', 'manager'), restaurantController.updateBankDetails);

module.exports = router;
