const taskService = require('../services/taskService');
const Task = require('../models/Task');
const Project = require('../models/Project');
const {
  emitTaskCreated,
  emitTaskUpdated,
  emitTaskDeleted,
} = require('../sockets/socketHandler');

const getProjectTasks = async (req, res, next) => {
  try {
    const result = await taskService.getProjectTasks(req.params.projectId, req.query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getAllProjectTasks = async (req, res, next) => {
  try {
    const result = await taskService.getAllProjectTasks(req.params.projectId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getTaskById = async (req, res, next) => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (err) {
    next(err);
  }
};

const createTask = async (req, res, next) => {
  try {
    const task = await taskService.createTask(req.params.projectId, req.body, req.user);

    // Emit real-time Socket event to all project members
    emitTaskCreated(req.params.projectId, task);

    res.status(201).json({
      success: true,
      message: 'Task created successfully.',
      data: task,
    });
  } catch (err) {
    next(err);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const task = await taskService.updateTask(req.params.id, req.body, req.user);

    // Emit real-time Socket event to all project members
    emitTaskUpdated(task.project._id || task.project, task);

    res.status(200).json({
      success: true,
      message: 'Task updated successfully.',
      data: task,
    });
  } catch (err) {
    next(err);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const existing = await Task.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const projectId = existing.project;
    const project = await Project.findById(projectId);

    // Permission check: ADMIN, MANAGER, or the project owner can delete tasks
    const isOwner = project && (project.owner?._id || project.owner)?.toString() === req.user._id.toString();
    const canDelete = req.user.role === 'ADMIN' || req.user.role === 'MANAGER' || isOwner;

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only an Admin, Manager, or the project owner can delete tasks.',
      });
    }

    const result = await taskService.deleteTask(req.params.id);

    // Emit real-time Socket event to all project members
    emitTaskDeleted(projectId, req.params.id);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller for Dashboard stats: My Tasks, In Progress, Completed
 */
const getMyDashboardTasks = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [myTasks, inProgressCount, completedCount, todoCount] = await Promise.all([
      Task.find({ assignedTo: userId })
        .populate('project', 'name')
        .sort({ updatedAt: -1 })
        .limit(10),
      Task.countDocuments({ assignedTo: userId, status: 'IN_PROGRESS' }),
      Task.countDocuments({ assignedTo: userId, status: 'DONE' }),
      Task.countDocuments({ assignedTo: userId, status: 'TODO' }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        tasks: myTasks,
        stats: {
          totalMyTasks: todoCount + inProgressCount + completedCount,
          todoCount,
          inProgressCount,
          completedCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProjectTasks,
  getAllProjectTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getMyDashboardTasks,
};
