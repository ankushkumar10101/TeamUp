const express = require('express');
const { body } = require('express-validator');
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

const taskUpdateValidation = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  body('status')
    .optional()
    .isIn(['TODO', 'IN_PROGRESS', 'DONE'])
    .withMessage('Status must be TODO, IN_PROGRESS, or DONE'),
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH'])
    .withMessage('Priority must be LOW, MEDIUM, or HIGH'),
  validate,
];

// Dashboard summary of current user's tasks
router.get('/my-tasks', taskController.getMyDashboardTasks);

// Task details, updates, and deletion
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskUpdateValidation, taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
