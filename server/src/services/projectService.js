const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');

/**
 * Fetch projects accessible to the user
 */
const getProjects = async (user) => {
  let query = {};
  if (user.role !== 'ADMIN') {
    query = {
      $or: [{ owner: user._id }, { members: user._id }],
    };
  }

  const projects = await Project.find(query)
    .populate('owner', 'name email role')
    .populate('members', 'name email role')
    .sort({ createdAt: -1 });

  return projects;
};

/**
 * Fetch single project by ID with populated references
 */
const getProjectById = async (projectId) => {
  const project = await Project.findById(projectId)
    .populate('owner', 'name email role')
    .populate('members', 'name email role');

  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }

  return project;
};

/**
 * Create a new project
 */
const createProject = async (data, user) => {
  const members = Array.isArray(data.members) ? [...data.members] : [];

  // Ensure the creator/owner is included in members
  if (!members.some((m) => m.toString() === user._id.toString())) {
    members.push(user._id);
  }

  const project = await Project.create({
    name: data.name,
    description: data.description || '',
    owner: user._id,
    members,
  });

  return getProjectById(project._id);
};

/**
 * Update an existing project
 */
const updateProject = async (projectId, data, user) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }

  // Only ADMIN or the project owner can update project settings
  if (user.role !== 'ADMIN' && project.owner.toString() !== user._id.toString()) {
    const error = new Error('Forbidden: Only the project owner or an admin can edit project details.');
    error.statusCode = 403;
    throw error;
  }

  if (data.name) project.name = data.name;
  if (data.description !== undefined) project.description = data.description;
  let removedMemberIds = [];
  if (data.members) {
    const members = Array.isArray(data.members) ? [...data.members] : [];
    // Ensure owner stays in members
    if (!members.some((m) => m.toString() === project.owner.toString())) {
      members.push(project.owner);
    }

    // Identify removed members
    const oldMemberIds = project.members.map((m) => m.toString());
    const newMemberIdSet = new Set(members.map((m) => m.toString()));
    removedMemberIds = oldMemberIds.filter((id) => !newMemberIdSet.has(id));

    // If members were removed, unassign their tasks in this project
    if (removedMemberIds.length > 0) {
      await Task.updateMany(
        { project: projectId, assignedTo: { $in: removedMemberIds } },
        { $set: { assignedTo: null } }
      );
    }

    project.members = members;
  }

  await project.save();
  const updatedProject = await getProjectById(projectId);
  return { project: updatedProject, removedMemberIds };
};

/**
 * Delete a project and cascade delete all associated tasks
 */
const deleteProject = async (projectId, user) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }

  // RBAC: Only project creator or ADMIN can delete projects
  const isOwner = project.owner && project.owner.toString() === user._id.toString();
  const isAdmin = user && user.role === 'ADMIN';
  if (!isOwner && !isAdmin) {
    const error = new Error('Forbidden: Only the project creator or an administrator can delete this project.');
    error.statusCode = 403;
    throw error;
  }

  // Delete project
  await Project.findByIdAndDelete(projectId);

  // Cascade delete all tasks belonging to this project
  await Task.deleteMany({ project: projectId });

  return { message: 'Project and all associated tasks successfully deleted.' };
};

/**
 * List all users (useful for member assignment selectors in UI)
 */
const getAllUsers = async () => {
  return User.find().select('name email role').sort({ name: 1 });
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getAllUsers,
};
