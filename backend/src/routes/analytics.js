const router = require('express').Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate, authorizeRestaurant } = require('../middleware/auth');

router.get('/restaurants/:id/today', authenticate, authorizeRestaurant, analyticsController.getToday);
router.get('/restaurants/:id/week', authenticate, authorizeRestaurant, analyticsController.getWeek);
router.get('/restaurants/:id/month', authenticate, authorizeRestaurant, analyticsController.getMonth);
router.get('/restaurants/:id/popular-items', authenticate, authorizeRestaurant, analyticsController.getPopularItems);

module.exports = router;
