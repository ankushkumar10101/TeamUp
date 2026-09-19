import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import projectService from '../services/projectService';
import taskService from '../services/taskService';
import { useSocket } from '../context/SocketContext';
import KanbanBoard from '../components/KanbanBoard';
import TaskModal from '../components/TaskModal';
import MembersModal from '../components/MembersModal';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

const ProjectBoardPage = () => {
  const { id: projectId } = useParams();
  const { socket, isConnected, joinProject, leaveProject } = useSocket();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Modal and Concurrency States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [conflictError, setConflictError] = useState(null);

  const fetchBoardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [projRes, tasksRes] = await Promise.all([
        projectService.getProject(projectId),
        taskService.getAllProjectTasks(projectId),
      ]);

      if (projRes.success) setProject(projRes.data);
      if (tasksRes.success) setTasks(tasksRes.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load Kanban board data.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  // Join Socket.IO Project Room & Setup Real-time Event Listeners
  useEffect(() => {
    if (!socket || !isConnected || !projectId) return;

    joinProject(projectId, (res) => {
      if (res?.success) {
        console.log(`[Board] Successfully joined real-time room: ${res.room}`);
      } else {
        console.warn(`[Board] Room authorization note:`, res?.message);
      }
    });

    const handleTaskCreated = (newTask) => {
      setTasks((prev) => {
        if (prev.some((t) => t._id === newTask._id)) return prev;
        return [newTask, ...prev];
      });
      showToast(`Task added: "${newTask.title}"`);
    };

    const handleTaskUpdated = (updatedTask) => {
      setTasks((prev) =>
        prev.map((t) => (t._id === updatedTask._id ? updatedTask : t))
      );
      showToast(`Task updated: "${updatedTask.title}" (v${updatedTask.version})`);
    };

    const handleTaskDeleted = ({ taskId }) => {
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
      showToast('A task was deleted.');
    };

    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:deleted', handleTaskDeleted);

    return () => {
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:deleted', handleTaskDeleted);
      leaveProject(projectId);
    };
  }, [socket, isConnected, projectId, joinProject, leaveProject]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDropTask = async (taskId, newStatus, currentVersion) => {
    const existingTask = tasks.find((t) => t._id === taskId);
    if (!existingTask || existingTask.status === newStatus) return;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      const res = await taskService.updateTask(taskId, {
        status: newStatus,
        version: currentVersion !== null ? currentVersion : existingTask.version,
      });

      if (res.success) {
        setTasks((prev) =>
          prev.map((t) => (t._id === taskId ? res.data : t))
        );
      }
    } catch (err) {
      if (err.response && err.response.status === 409) {
        const conflictData = err.response.data;
        const currentTask = conflictData.data?.currentTask;

        showToast('Conflict detected! Task was modified concurrently by another user.');

        if (currentTask) {
          setTasks((prev) =>
            prev.map((t) => (t._id === taskId ? currentTask : t))
          );
        } else {
          fetchBoardData();
        }
      } else {
        fetchBoardData();
        alert(err.response?.data?.message || err.message || 'Failed to update task status.');
      }
    }
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
          setTasks((prev) =>
            prev.map((t) => (t._id === res.data._id ? res.data : t))
          );
          projectService.getProject(projectId).then((pRes) => {
            if (pRes.success) setProject(pRes.data);
          });
        }
      } else {
        const res = await taskService.createTask(projectId, taskData, idempotencyKey);
        if (res.success) {
          setIsModalOpen(false);
          setTasks((prev) => [res.data, ...prev]);
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
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
      projectService.getProject(projectId).then((pRes) => {
        if (pRes.success) setProject(pRes.data);
      });
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete task.');
    }
  };

  if (loading && !project) {
    return <LoadingSpinner message="Loading Kanban board..." />;
  }

  return (
    <div>
      {/* Board Header Bar */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-2">
        <div className="d-flex align-items-center gap-3">
          <div className="icon-circle icon-circle-indigo" style={{ width: '48px', height: '48px', fontSize: '1.4rem' }}>
            <i className="bi bi-kanban-fill"></i>
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <h3 className="fw-bold mb-0 text-dark">{project?.name}</h3>
              <span className="badge badge-pill-soft badge-inprogress">Kanban</span>
            </div>
            <p className="text-muted small mb-0">
              Drag cards across columns to update task statuses instantly in real-time.
            </p>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <Link to={`/projects/${projectId}`} className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
            <i className="bi bi-list-task"></i>
            <span>List View</span>
          </Link>

          <button
            type="button"
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
            onClick={() => setIsMembersModalOpen(true)}
            title="Manage project members"
          >
            <i className="bi bi-people-fill text-primary"></i>
            <span>Members ({project?.members?.length || 0})</span>
          </button>

          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={handleOpenCreateModal}>
            <i className="bi bi-plus-lg"></i>
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Real-time Toast Notice */}
      {toastMessage && (
        <div className="alert alert-primary alert-dismissible fade show py-2 px-3 mb-3 small d-flex align-items-center justify-content-between shadow-sm border-primary-subtle" style={{ borderRadius: '10px' }}>
          <div>
            <i className="bi bi-bell-fill me-2 text-primary"></i>
            {toastMessage}
          </div>
          <button type="button" className="btn-close py-2" onClick={() => setToastMessage(null)}></button>
        </div>
      )}

      <ErrorMessage message={error} onDismiss={() => setError(null)} onRetry={fetchBoardData} />

      {/* Kanban Board Container */}
      <KanbanBoard
        tasks={tasks}
        project={project}
        onEditTask={handleOpenEditModal}
        onDeleteTask={handleDeleteTask}
        onDropTask={handleDropTask}
      />

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
          fetchBoardData();
        }}
      />
    </div>
  );
};

export default ProjectBoardPage;
