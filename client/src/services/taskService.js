import api from './api';

export const taskService = {
  getProjectTasks: async (projectId, params = {}) => {
    const res = await api.get(`/projects/${projectId}/tasks`, { params });
    return res.data;
  },

  getTask: async (id) => {
    const res = await api.get(`/tasks/${id}`);
    return res.data;
  },

  createTask: async (projectId, taskData) => {
    const res = await api.post(`/projects/${projectId}/tasks`, taskData);
    return res.data;
  },

  updateTask: async (id, taskData) => {
    const res = await api.put(`/tasks/${id}`, taskData);
    return res.data;
  },

  deleteTask: async (id) => {
    const res = await api.delete(`/tasks/${id}`);
    return res.data;
  },

  getMyDashboardTasks: async () => {
    const res = await api.get('/tasks/my-tasks');
    return res.data;
  },
};

export default taskService;
