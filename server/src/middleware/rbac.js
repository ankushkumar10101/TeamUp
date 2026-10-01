const Project = require('../models/Project');

/**
 * Restrict endpoint to users with specific system-level roles
 * @param  {...string} roles Allowed roles (e.g. 'ADMIN', 'MANAGER')
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: User role '${req.user ? req.user.role : 'UNKNOWN'}' does not have permission for this action.`,
      });
    }
    next();
  };
};

/**
 * Check if the user is authorized to view or access a project.
 * ADMIN has global view access. MANAGER and MEMBER must be owner or in members array.
 */
const checkProjectAccess = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'Project ID is required.' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // ADMIN has full access across all projects
    if (req.user.role === 'ADMIN') {
      req.project = project;
      return next();
    }

    // Owner or assigned member check
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some((m) => m.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this project.',
      });
    }

    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  authorizeRoles,
  checkProjectAccess,
};
