const projectService = require('../services/projectService');

const getProjects = async (req, res, next) => {
  try {
    const projects = await projectService.getProjects(req.user);
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects,
    });
  } catch (err) {
    next(err);
  }
};

const getProjectById = async (req, res, next) => {
  try {
    const project = await projectService.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }
    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (err) {
    next(err);
  }
};

const createProject = async (req, res, next) => {
  try {
    const project = await projectService.createProject(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Project created successfully.',
      data: project,
    });
  } catch (err) {
    next(err);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const result = await projectService.updateProject(req.params.id, req.body, req.user);
    const project = result.project || result;

    res.status(200).json({
      success: true,
      message: 'Project updated successfully.',
      data: project,
    });
  } catch (err) {
    next(err);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const result = await projectService.deleteProject(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const users = await projectService.getAllUsers();
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getAllUsers,
};
