const Task = require('../models/Task');
const Project = require('../models/Project');

/**
 * Fetch paginated tasks for a project with filtering
 */
const getProjectTasks = async (projectId, query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

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

  return {
    success: true,
    data: tasks,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
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
 * Automatically synchronize project members from assigned tasks:
 * - Members = Project Owner + Any user currently assigned to at least 1 task in the project.
 * - If a user has no assigned tasks (and is not the owner), they are removed from project.members.
 */
const syncProjectMembers = async (projectId) => {
  const project = await Project.findById(projectId);
  if (!project) return;

  // Find all users who are currently assigned to at least 1 task in this project
  const assignedUsers = await Task.distinct('assignedTo', {
    project: projectId,
    assignedTo: { $ne: null },
  });

  const memberSet = new Set(assignedUsers.map((id) => id.toString()));
  // The owner is always a member
  if (project.owner) {
    memberSet.add((project.owner._id || project.owner).toString());
  }

  const newMemberList = Array.from(memberSet);

  project.members = newMemberList;
  await project.save();
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

  // Automatically synchronize project members from task assignments
  await syncProjectMembers(projectId);

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

  // Assignment update
  const assignmentChanged = updateData.assignedTo !== undefined;
  if (assignmentChanged) {
    existingTask.assignedTo = updateData.assignedTo || null;
  }

  // Increment version on successful update
  existingTask.version += 1;

  await existingTask.save();

  // If task assignment was changed, sync project members
  if (assignmentChanged) {
    await syncProjectMembers(existingTask.project);
  }

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

  await Task.findByIdAndDelete(taskId);

  // Synchronize project members (removes members if they have no remaining tasks)
  await syncProjectMembers(projectId);

  return { message: 'Task successfully deleted.' };
};

module.exports = {
  getProjectTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
};
