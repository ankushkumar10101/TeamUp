const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const User = require('../models/User');
const Project = require('../models/Project');

let ioInstance = null;

const initSocket = (io) => {
  ioInstance = io;

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      // Also check handshake headers or cookies
      if (!token && socket.handshake.headers?.cookie) {
        const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, str) => {
          const [key, val] = str.trim().split('=');
          if (key && val) acc[key] = decodeURIComponent(val);
          return acc;
        }, {});
        token = cookies.token;
      }

      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication error: ' + err.message));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id} (User: ${socket.user.name}, Role: ${socket.user.role})`);

    /**
     * Join Project Room with Backend Authorization Check
     * Prevents arbitrary or unauthorized users from snooping on project events
     */
    socket.on('join-project', async (projectId, callback) => {
      try {
        if (!projectId) {
          if (callback) callback({ success: false, message: 'Project ID is required' });
          return;
        }

        const project = await Project.findById(projectId);
        if (!project) {
          if (callback) callback({ success: false, message: 'Project not found' });
          return;
        }

        // Authorization check: User must be ADMIN, project owner, or listed member
        const isAdmin = socket.user.role === 'ADMIN';
        const isOwner = project.owner.toString() === socket.user._id.toString();
        const isMember = project.members.some((m) => m.toString() === socket.user._id.toString());

        if (!isAdmin && !isOwner && !isMember) {
          console.warn(`[Socket.IO] Unauthorized join attempt by ${socket.user.email} on project ${projectId}`);
          if (callback) callback({ success: false, message: 'Unauthorized project room access' });
          return;
        }

        const roomName = `project:${projectId}`;
        socket.join(roomName);
        console.log(`[Socket.IO] User ${socket.user.email} joined room ${roomName}`);
        if (callback) callback({ success: true, room: roomName });
      } catch (err) {
        console.error(`[Socket.IO] Error in join-project: ${err.message}`);
        if (callback) callback({ success: false, message: 'Internal server error' });
      }
    });

    /**
     * Leave Project Room
     */
    socket.on('leave-project', (projectId) => {
      if (projectId) {
        const roomName = `project:${projectId}`;
        socket.leave(roomName);
        console.log(`[Socket.IO] User ${socket.user.email} left room ${roomName}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
};

/**
 * Real-time event broadcasting helpers
 */
const emitTaskCreated = (projectId, task) => {
  if (ioInstance) {
    const pId = projectId.toString ? projectId.toString() : projectId;
    ioInstance.to(`project:${pId}`).emit('task:created', task);
  }
};

const emitTaskUpdated = (projectId, task) => {
  if (ioInstance) {
    const pId = projectId.toString ? projectId.toString() : projectId;
    ioInstance.to(`project:${pId}`).emit('task:updated', task);
  }
};

const emitTaskDeleted = (projectId, taskId) => {
  if (ioInstance) {
    const pId = projectId.toString ? projectId.toString() : projectId;
    ioInstance.to(`project:${pId}`).emit('task:deleted', { taskId, projectId: pId });
  }
};

const emitProjectUpdated = (projectId, project) => {
  if (ioInstance) {
    const pId = projectId.toString ? projectId.toString() : projectId;
    ioInstance.to(`project:${pId}`).emit('project:updated', project);
  }
};

module.exports = {
  initSocket,
  emitTaskCreated,
  emitTaskUpdated,
  emitTaskDeleted,
  emitProjectUpdated,
};
