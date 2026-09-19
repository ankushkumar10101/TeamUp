import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import projectService from '../services/projectService';
import taskService from '../services/taskService';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import TaskModal from '../components/TaskModal';
import MembersModal from '../components/MembersModal';
import { getPriorityBadge, getStatusBadge, formatDate } from '../utils/formatters';

const ProjectDetailPage = () => {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ status: '', priority: '' });
  const [isCached, setIsCached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal and Concurrency States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [conflictError, setConflictError] = useState(null);

  const isOwner = Boolean(project && (project.owner?._id || project.owner)?.toString() === user?._id?.toString());
  const canDelete = user?.role === 'ADMIN' || user?.role === 'MANAGER' || isOwner;
  const canDeleteProject = user?.role === 'ADMIN' || isOwner;

  const fetchProjectDetails = useCallback(async () => {
    try {
      const res = await projectService.getProject(projectId);
      if (res.success) {
        setProject(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load project details.');
    }
  }, [projectId]);

  const fetchTasks = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page,
        limit: pagination.limit,
      };
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;

      const res = await taskService.getProjectTasks(projectId, params);
      if (res.success) {
        setTasks(res.data);
        setPagination(res.pagination);
        setIsCached(Boolean(res.cached));
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load project tasks.');
    } finally {
      setLoading(false);
    }
  }, [projectId, pagination.limit, filters]);

  useEffect(() => {
    fetchProjectDetails();
  }, [fetchProjectDetails]);

  useEffect(() => {
    fetchTasks(1);
  }, [fetchTasks]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleOpenCreateModal = () => {
    setEditingTask(null);
    setConflictError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (task) => {
    setEditingTask(task);
    setConflictError(null);
    setIsModalOpen(true);
  };

  const handleReloadTask = async (taskId) => {
    try {
      const res = await taskService.getTask(taskId);
      if (res.success) {
        setEditingTask(res.data);
        setConflictError(null);
      }
    } catch (err) {
      alert('Failed to reload task: ' + err.message);
    }
  };

  const handleModalSubmit = async (taskData, idempotencyKey) => {
    try {
      if (editingTask) {
        const res = await taskService.updateTask(editingTask._id, taskData);
        if (res.success) {
          setIsModalOpen(false);
          setEditingTask(null);
          setConflictError(null);
          fetchTasks(pagination.page);
          projectService.getProject(projectId).then((pRes) => {
            if (pRes.success) setProject(pRes.data);
          });
        }
      } else {
        const res = await taskService.createTask(projectId, taskData, idempotencyKey);
        if (res.success) {
          setIsModalOpen(false);
          fetchTasks(1);
          projectService.getProject(projectId).then((pRes) => {
            if (pRes.success) setProject(pRes.data);
          });
        }
      }
    } catch (err) {
      if (err.response && err.response.status === 409) {
        setConflictError(err.response.data);
      } else {
        alert(err.response?.data?.message || err.message || 'Action failed.');
      }
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await taskService.deleteTask(taskId);
      fetchTasks(pagination.page);
      projectService.getProject(projectId).then((pRes) => {
        if (pRes.success) setProject(pRes.data);
      });
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete task');
    }
  };

  const handleDeleteCurrentProject = async () => {
    if (!window.confirm('Are you sure you want to delete this project? All associated tasks will be permanently removed.')) {
      return;
    }
    try {
      await projectService.deleteProject(projectId);
      navigate('/projects');
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete project');
    }
  };

  if (!project && loading) {
    return <LoadingSpinner message="Loading project workspace..." />;
  }

  return (
    <div>
      {/* Project Overview Header */}
      <div className="card mb-4">
        <div className="card-body p-4">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div className="d-flex align-items-center gap-3">
              <div className="icon-circle icon-circle-indigo" style={{ width: '52px', height: '52px', fontSize: '1.5rem' }}>
                <i className="bi bi-kanban"></i>
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <h3 className="fw-bold mb-0 text-dark">{project?.name}</h3>
                  <span className="badge rounded-pill bg-light text-secondary border small">
                    {project?.members?.length || 0} members
                  </span>
                </div>
                <p className="text-muted small mb-0">{project?.description || 'Collaborative workspace'}</p>
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                onClick={() => setIsMembersModalOpen(true)}
                title="Manage project members"
              >
                <i className="bi bi-people-fill text-primary"></i>
                <span>Members ({project?.members?.length || 0})</span>
              </button>

              <Link to={`/projects/${projectId}/board`} className="btn btn-primary btn-sm d-flex align-items-center gap-2">
                <i className="bi bi-kanban"></i>
                <span>Open Kanban Board</span>
              </Link>
              {canDeleteProject && (
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
                  onClick={handleDeleteCurrentProject}
                  title="Delete this project"
                >
                  <i className="bi bi-trash"></i>
                  <span>Delete Project</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ErrorMessage message={error} onDismiss={() => setError(null)} onRetry={() => fetchTasks(pagination.page)} />

      {/* Task Filters & Cache Status */}
      <div className="card mb-4">
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-sm-auto">
              <button className="btn btn-primary btn-sm w-100 d-flex align-items-center justify-content-center gap-1" onClick={handleOpenCreateModal}>
                <i className="bi bi-plus-lg"></i>
                <span>Add Task</span>
              </button>
            </div>

            <div className="col-6 col-sm-auto">
              <select
                name="status"
                className="form-select form-select-sm"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="">All Statuses</option>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            <div className="col-6 col-sm-auto">
              <select
                name="priority"
                className="form-select form-select-sm"
                value={filters.priority}
                onChange={handleFilterChange}
              >
                <option value="">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>

            <div className="col-12 col-sm-auto ms-sm-auto d-flex align-items-center justify-content-end gap-2 mt-1 mt-sm-0">
              <button
                className="btn btn-outline-secondary btn-sm rounded-circle p-1"
                style={{ width: '32px', height: '32px' }}
                title="Refresh Tasks"
                onClick={() => fetchTasks(pagination.page)}
              >
                <i className="bi bi-arrow-clockwise"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Paginated Tasks Table */}
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h6 className="fw-bold mb-0 text-dark">
            <i className="bi bi-list-task me-2 text-primary"></i> Tasks List
          </h6>
          <span className="small text-muted">
            Showing {(pagination.page - 1) * pagination.limit + (tasks.length > 0 ? 1 : 0)} -{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} tasks
          </span>
        </div>

        <div className="card-body p-0">
          {loading ? (
            <LoadingSpinner message="Fetching task records..." />
          ) : tasks.length === 0 ? (
            <div className="text-center p-5 text-muted small">
              No tasks match the selected filters.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small text-muted">
                  <tr>
                    <th className="ps-4">Title</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Assignee</th>
                    <th>Due Date</th>
                    <th>OCC Ver</th>
                    <th className="text-end pe-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="small">
                  {tasks.map((task) => {
                    const statusBadge = getStatusBadge(task.status);
                    const priorityBadge = getPriorityBadge(task.priority);
                    const assigneeInitial = task.assignedTo?.name ? task.assignedTo.name.charAt(0).toUpperCase() : '?';
                    const isCreator = (task.createdBy?._id || task.createdBy)?.toString() === user?._id?.toString();
                    const isAssignee = (task.assignedTo?._id || task.assignedTo)?.toString() === user?._id?.toString();
                    const canEditTask = user?.role === 'ADMIN' || user?.role === 'MANAGER' || isOwner || isCreator || isAssignee;

                    return (
                      <tr key={task._id}>
                        <td className="ps-4 fw-semibold text-dark">
                          <div>{task.title}</div>
                          {task.description && (
                            <div className="text-muted text-truncate small" style={{ maxWidth: '280px', fontSize: '0.78rem' }}>
                              {task.description}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-pill-soft ${
                            task.status === 'DONE' ? 'badge-done' : task.status === 'IN_PROGRESS' ? 'badge-inprogress' : 'badge-todo'
                          }`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-pill-soft ${
                            task.priority === 'HIGH' ? 'badge-high' : task.priority === 'MEDIUM' ? 'badge-medium' : 'badge-low'
                          }`}>
                            {priorityBadge.label}
                          </span>
                        </td>
                        <td>
                          {task.assignedTo ? (
                            <div className="d-flex align-items-center gap-2">
                              <div className="avatar-circle" style={{ width: '26px', height: '26px', fontSize: '0.7rem' }}>
                                {assigneeInitial}
                              </div>
                              <span className="text-dark">{task.assignedTo.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted small fst-italic">Unassigned</span>
                          )}
                        </td>
                        <td>
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                            {formatDate(task.dueDate)}
                          </span>
                        </td>
                        <td>
                          <span className="occ-badge">v{task.version}</span>
                        </td>
                        <td className="text-end pe-4">
                          <div className="btn-group btn-group-sm">
                            {canEditTask && (
                              <button
                                type="button"
                                className="btn btn-outline-secondary"
                                title="Edit Task"
                                onClick={() => handleOpenEditModal(task)}
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                className="btn btn-outline-danger"
                                title="Delete Task"
                                onClick={() => handleDeleteTask(task._id)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Server-Side Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="card-footer bg-transparent d-flex justify-content-between align-items-center py-3 px-4 border-top border-light-subtle">
            <button
              className="btn btn-outline-secondary btn-sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchTasks(pagination.page - 1)}
            >
              <i className="bi bi-chevron-left me-1"></i> Previous
            </button>
            <span className="small text-muted fw-semibold">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              className="btn btn-outline-secondary btn-sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchTasks(pagination.page + 1)}
            >
              Next <i className="bi bi-chevron-right ms-1"></i>
            </button>
          </div>
        )}
      </div>

      {/* Task Create / Edit Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        initialData={editingTask}
        members={project?.members || []}
        conflictError={conflictError}
        onReloadTask={handleReloadTask}
      />

      {/* Project Members Modal */}
      <MembersModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        project={project}
        onProjectUpdated={(updatedProject) => {
          setProject(updatedProject);
          fetchTasks(pagination.page);
        }}
      />
    </div>
  );
};

export default ProjectDetailPage;
