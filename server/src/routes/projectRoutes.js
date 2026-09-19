const express = require('express');
const { body } = require('express-validator');
const projectController = require('../controllers/projectController');
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');
const {
  authorizeRoles,
  checkProjectAccess,
  checkTaskAssignmentPermission,
} = require('../middleware/rbac');
const { idempotency } = require('../middleware/idempotency');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Apply auth to all project routes
router.use(authenticate);

// Validation rules
const projectValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Project name is required')
    .isLength({ max: 120 })
    .withMessage('Project name cannot exceed 120 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('members')
    .optional()
    .isArray()
    .withMessage('Members must be an array of user IDs'),
  validate,
];

const projectUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Project name cannot be empty')
    .isLength({ max: 120 })
    .withMessage('Project name cannot exceed 120 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('members')
    .optional()
    .isArray()
    .withMessage('Members must be an array of user IDs'),
  validate,
];

const taskCreateValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Task title is required')
    .isLength({ max: 200 })
    .withMessage('Task title cannot exceed 200 characters'),
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

// User listing for member pickers
router.get('/users', projectController.getAllUsers);

// Reset demo data with relatable projects
router.post('/reset-demo-data', projectController.resetDemoData);

// Project CRUD
router.get('/', projectController.getProjects);
router.post('/', authorizeRoles('ADMIN', 'MANAGER'), projectValidation, projectController.createProject);
router.get('/:id', checkProjectAccess, projectController.getProjectById);
router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), checkProjectAccess, projectUpdateValidation, projectController.updateProject);
router.delete('/:id', checkProjectAccess, projectController.deleteProject);

// Nested Project Tasks Endpoints
router.get('/:projectId/tasks', checkProjectAccess, taskController.getProjectTasks);
router.get('/:projectId/tasks/board', checkProjectAccess, taskController.getAllProjectTasks);
router.post(
  '/:projectId/tasks',
  checkProjectAccess,
  checkTaskAssignmentPermission,
  idempotency,
  taskCreateValidation,
  taskController.createTask
);

module.exports = router;
