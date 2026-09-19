const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const { invalidateProjectTasks } = require('./cacheService');

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
  if (data.members) {
    const members = Array.isArray(data.members) ? [...data.members] : [];
    // Ensure owner stays in members
    if (!members.some((m) => m.toString() === project.owner.toString())) {
      members.push(project.owner);
    }

    // Identify removed members
    const oldMemberIds = project.members.map((m) => m.toString());
    const newMemberIdSet = new Set(members.map((m) => m.toString()));
    const removedMemberIds = oldMemberIds.filter((id) => !newMemberIdSet.has(id));

    // If members were removed, unassign their tasks in this project
    if (removedMemberIds.length > 0) {
      await Task.updateMany(
        { project: projectId, assignedTo: { $in: removedMemberIds } },
        { $set: { assignedTo: null } }
      );
      await invalidateProjectTasks(projectId);
    }

    project.members = members;
  }

  await project.save();
  return getProjectById(projectId);
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

  // RBAC: ADMIN, MANAGER, or Project Owner can delete projects
  const isOwner = project.owner && project.owner.toString() === user._id.toString();
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && !isOwner) {
    const error = new Error('Forbidden: Only an Admin, Manager, or the project owner can delete this project.');
    error.statusCode = 403;
    throw error;
  }

  // Delete project
  await Project.findByIdAndDelete(projectId);

  // Cascade delete all tasks belonging to this project
  await Task.deleteMany({ project: projectId });

  // Invalidate Redis task cache
  await invalidateProjectTasks(projectId);

  return { message: 'Project and all associated tasks successfully deleted.' };
};

/**
 * List all users (useful for member assignment selectors in UI)
 */
const getAllUsers = async () => {
  return User.find().select('name email role').sort({ name: 1 });
};

/**
 * Reset all projects and tasks with relatable, real-world demo data
 */
const resetDemoData = async () => {
  const { seedProjects, getSeedTasks, seedUsers } = require('../utils/seedData');

  let users = await User.find();
  if (users.length === 0) {
    users = await User.create(seedUsers);
  }

  const userMap = {};
  users.forEach((u) => {
    userMap[u.email] = u._id;
  });

  await Task.deleteMany({});
  await Project.deleteMany({});

  const allMembers = Object.values(userMap);

  const project1 = await Project.create({
    ...seedProjects[0],
    owner: userMap['manager@teamup.dev'] || users[0]._id,
    members: allMembers,
  });

  const project2 = await Project.create({
    ...seedProjects[1],
    owner: userMap['admin@teamup.dev'] || users[0]._id,
    members: allMembers,
  });

  const project3 = await Project.create({
    ...seedProjects[2],
    owner: userMap['manager@teamup.dev'] || users[0]._id,
    members: allMembers,
  });

  const project4 = await Project.create({
    ...seedProjects[3],
    owner: userMap['admin@teamup.dev'] || users[0]._id,
    members: allMembers,
  });

  const tasksData = getSeedTasks(project1._id, project2._id, project3._id, project4._id, userMap);
  await Task.create(tasksData);

  return {
    projectCount: 4,
    taskCount: tasksData.length,
  };
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getAllUsers,
  resetDemoData,
};
