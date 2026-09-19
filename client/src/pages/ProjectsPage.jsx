import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import projectService from '../services/projectService';
import ProjectCard from '../components/ProjectCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

const ProjectsPage = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New Project Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectData, setNewProjectData] = useState({
    name: '',
    description: '',
    members: [],
  });
  const [modalErrors, setModalErrors] = useState({});
  const [isCreating, setIsCreating] = useState(false);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await projectService.getProjects();
      if (res.success) {
        setProjects(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch projects.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await projectService.getUsers();
      if (res.success) {
        setAvailableUsers(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch user list for picker:', err.message);
    }
  };

  useEffect(() => {
    fetchProjects();
    if (canCreate) {
      fetchUsers();
    }
  }, [canCreate]);

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project? All associated tasks will be permanently removed.')) {
      return;
    }

    try {
      await projectService.deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete project');
    }
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!newProjectData.name.trim()) {
      errors.name = 'Project name is required';
    }
    if (Object.keys(errors).length > 0) {
      setModalErrors(errors);
      return;
    }

    try {
      setIsCreating(true);
      const res = await projectService.createProject(newProjectData);
      if (res.success) {
        setProjects((prev) => [res.data, ...prev]);
        setIsModalOpen(false);
        setNewProjectData({ name: '', description: '', members: [] });
        setModalErrors({});
      }
    } catch (err) {
      setModalErrors({ submit: err.response?.data?.message || 'Failed to create project' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleMemberToggle = (userId) => {
    setNewProjectData((prev) => {
      const exists = prev.members.includes(userId);
      return {
        ...prev,
        members: exists ? prev.members.filter((id) => id !== userId) : [...prev.members, userId],
      };
    });
  };

  if (loading) {
    return <LoadingSpinner message="Loading projects..." />;
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4 pb-2 border-bottom">
        <div>
          <h3 className="fw-bold mb-1">Projects</h3>
          <p className="text-muted small mb-0">Collaborative workspaces and task boards</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => setIsModalOpen(true)}>
            <i className="bi bi-plus-lg"></i>
            <span>New Project</span>
          </button>
        )}
      </div>

      <ErrorMessage message={error} onDismiss={() => setError(null)} onRetry={fetchProjects} />

      {projects.length === 0 ? (
        <div className="card border-dashed p-4 p-sm-5 text-center bg-white my-4">
          <i className="bi bi-folder2-open display-4 text-muted mb-3"></i>
          <h5>No projects found</h5>
          <p className="text-muted small">
            {canCreate
              ? 'Click "New Project" above to create your first collaborative project workspace.'
              : 'You are currently not assigned to any projects. Contact a Manager or Admin.'}
          </p>
        </div>
      ) : (
        <div className="row g-3 g-sm-4">
          {projects.map((project) => (
            <div key={project._id} className="col-12 col-md-6 col-lg-4">
              <ProjectCard project={project} onDelete={handleDeleteProject} />
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-semibold">Create New Project</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setIsModalOpen(false)}
                ></button>
              </div>

              <form onSubmit={handleModalSubmit}>
                <div className="modal-body">
                  {modalErrors.submit && (
                    <div className="alert alert-danger small p-2 mb-3">{modalErrors.submit}</div>
                  )}

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      Project Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-control ${modalErrors.name ? 'is-invalid' : ''}`}
                      value={newProjectData.name}
                      onChange={(e) =>
                        setNewProjectData({ ...newProjectData, name: e.target.value })
                      }
                      placeholder="e.g. Website Redesign"
                      autoFocus
                    />
                    {modalErrors.name && <div className="invalid-feedback">{modalErrors.name}</div>}
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Description</label>
                    <textarea
                      rows="3"
                      className="form-control"
                      value={newProjectData.description}
                      onChange={(e) =>
                        setNewProjectData({ ...newProjectData, description: e.target.value })
                      }
                      placeholder="Objectives and scope..."
                    ></textarea>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Project Members</label>
                    <div className="border rounded p-2" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {availableUsers.map((u) => (
                        <div key={u._id} className="form-check small py-1">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`user-${u._id}`}
                            checked={newProjectData.members.includes(u._id)}
                            onChange={() => handleMemberToggle(u._id)}
                          />
                          <label className="form-check-label" htmlFor={`user-${u._id}`}>
                            {u.name} <span className="text-muted">({u.role})</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={isCreating}>
                    {isCreating ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
