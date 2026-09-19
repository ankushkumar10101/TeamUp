const Task = require('../models/Task');
const Project = require('../models/Project');
const {
  buildTaskCacheKey,
  getCachedData,
  setCachedData,
  invalidateProjectTasks,
} = require('./cacheService');

/**
 * Fetch paginated tasks for a project with caching and filtering
 */
const getProjectTasks = async (projectId, query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  // Build cache key based on query filters
  const cacheKey = buildTaskCacheKey(projectId, query);

  // 1. Try Redis cache first (Cache-Aside Pattern)
  const cached = await getCachedData(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  // 2. Cache Miss: Query MongoDB
  const filter = { project: projectId };

  if (query.status && ['TODO', 'IN_PROGRESS', 'DONE'].includes(query.status)) {
    filter.status = query.status;
  }
  if (query.priority && ['LOW', 'MEDIUM', 'HIGH'].includes(query.priority)) {
    filter.priority = query.priority;
  }
  if (query.assignedTo) {
    filter.assignedTo = query.assignedTo;
  }

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Task.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  const result = {
    success: true,
    data: tasks,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    cached: false,
  };

  // 3. Store result in Redis cache with TTL (120s)
  await setCachedData(cacheKey, result);

  return result;
};

/**
 * Fetch all tasks for a project (useful for Kanban board view)
 */
const getAllProjectTasks = async (projectId) => {
  const cacheKey = `project:${projectId}:tasks:board`;
  const cached = await getCachedData(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const tasks = await Task.find({ project: projectId })
    .populate('assignedTo', 'name email role')
    .populate('createdBy', 'name email role')
    .sort({ createdAt: -1 });

  const result = {
    success: true,
    data: tasks,
    cached: false,
  };

  await setCachedData(cacheKey, result, 60);
  return result;
};

/**
 * Retrieve a single task by ID
 */
const getTaskById = async (taskId) => {
  const task = await Task.findById(taskId)
    .populate('assignedTo', 'name email role')
    .populate('createdBy', 'name email role');

  if (!task) {
    const error = new Error('Task not found.');
    error.statusCode = 404;
    throw error;
  }

  return task;
};

/**
 * Create a new task within a project
 */
const createTask = async (projectId, data, user) => {
  const task = await Task.create({
    title: data.title,
    description: data.description || '',
    project: projectId,
    assignedTo: data.assignedTo || null,
    createdBy: user._id,
    status: data.status || 'TODO',
    priority: data.priority || 'MEDIUM',
    dueDate: data.dueDate || null,
    version: 1,
  });

  // If task is assigned, ensure the assignee is included in the project's members
  if (data.assignedTo) {
    await Project.findByIdAndUpdate(projectId, {
      $addToSet: { members: data.assignedTo },
    });
  }

  // Invalidate Redis task cache for this project
  await invalidateProjectTasks(projectId);

  return getTaskById(task._id);
};

/**
 * Update task with Optimistic Concurrency Control (OCC)
 */
const updateTask = async (taskId, updateData, user) => {
  const existingTask = await Task.findById(taskId);
  if (!existingTask) {
    const error = new Error('Task not found.');
    error.statusCode = 404;
    throw error;
  }

  const project = await Project.findById(existingTask.project);
  const isOwner = project && (project.owner?._id || project.owner)?.toString() === user._id.toString();
  const isAdminOrManager = user.role === 'ADMIN' || user.role === 'MANAGER';
  const isCreator = existingTask.createdBy && existingTask.createdBy.toString() === user._id.toString();
  const isAssignee = existingTask.assignedTo && existingTask.assignedTo.toString() === user._id.toString();

  // If user is regular MEMBER
  if (!isAdminOrManager && !isOwner) {
    // If not creator and not assignee -> no permission to update
    if (!isCreator && !isAssignee) {
      const error = new Error('Forbidden: You do not have permission to update this task.');
      error.statusCode = 403;
      throw error;
    }

    // If assignee but not creator -> only allowed to update status
    if (isAssignee && !isCreator) {
      const nonStatusFields = ['title', 'description', 'priority', 'dueDate', 'assignedTo'];
      const hasRestrictedChanges = nonStatusFields.some((field) => updateData[field] !== undefined);
      if (hasRestrictedChanges) {
        const error = new Error('Forbidden: Members can only update the status of tasks assigned to them.');
        error.statusCode = 403;
        throw error;
      }
    }
  }

  // OCC Check: if client supplied a version, enforce it matches the stored version
  if (updateData.version !== undefined && updateData.version !== null) {
    const expectedVersion = Number(updateData.version);
    if (existingTask.version !== expectedVersion) {
      const conflictError = new Error(
        'Task update conflict: This task was modified by another user. Please refresh to load the latest version.'
      );
      conflictError.statusCode = 409;
      conflictError.data = {
        currentVersion: existingTask.version,
        currentTask: existingTask,
      };
      throw conflictError;
    }
  }

  // Apply updates
  if (updateData.title !== undefined) existingTask.title = updateData.title;
  if (updateData.description !== undefined) existingTask.description = updateData.description;
  if (updateData.status !== undefined) existingTask.status = updateData.status;
  if (updateData.priority !== undefined) existingTask.priority = updateData.priority;
  if (updateData.dueDate !== undefined) existingTask.dueDate = updateData.dueDate;

  // Assignment update (RBAC is checked by middleware, but also verified here)
  if (updateData.assignedTo !== undefined) {
    const oldAssignee = existingTask.assignedTo ? existingTask.assignedTo.toString() : null;
    const newAssignee = updateData.assignedTo ? updateData.assignedTo.toString() : null;

    existingTask.assignedTo = updateData.assignedTo || null;

    if (newAssignee) {
      await Project.findByIdAndUpdate(existingTask.project, {
        $addToSet: { members: updateData.assignedTo },
      });
    }

    // If an assignee was removed or changed, check if oldAssignee should be removed from project members
    if (oldAssignee && oldAssignee !== newAssignee) {
      const project = await Project.findById(existingTask.project);
      const isOwner = project && (project.owner?._id || project.owner)?.toString() === oldAssignee;
      if (!isOwner) {
        const remainingTasks = await Task.countDocuments({
          project: existingTask.project,
          assignedTo: oldAssignee,
          _id: { $ne: existingTask._id },
        });
        if (remainingTasks === 0) {
          await Project.findByIdAndUpdate(existingTask.project, {
            $pull: { members: oldAssignee },
          });
        }
      }
    }
  }

  // Increment version on successful update
  existingTask.version += 1;

  await existingTask.save();

  // Invalidate cache for the project
  await invalidateProjectTasks(existingTask.project);

  return getTaskById(taskId);
};

/**
 * Delete a task
 */
const deleteTask = async (taskId) => {
  const task = await Task.findById(taskId);
  if (!task) {
    const error = new Error('Task not found.');
    error.statusCode = 404;
    throw error;
  }

  const projectId = task.project;
  const assignedTo = task.assignedTo ? task.assignedTo.toString() : null;

  await Task.findByIdAndDelete(taskId);

  // If the deleted task was assigned, check if assignee should be removed from project members
  if (assignedTo) {
    const project = await Project.findById(projectId);
    const isOwner = project && (project.owner?._id || project.owner)?.toString() === assignedTo;
    if (!isOwner) {
      const remainingTasks = await Task.countDocuments({
        project: projectId,
        assignedTo,
      });
      if (remainingTasks === 0) {
        await Project.findByIdAndUpdate(projectId, {
          $pull: { members: assignedTo },
        });
      }
    }
  }

  // Invalidate cache for the project
  await invalidateProjectTasks(projectId);

  return { message: 'Task successfully deleted.' };
};

module.exports = {
  getProjectTasks,
  getAllProjectTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
};
