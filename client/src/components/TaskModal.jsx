import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import projectService from '../services/projectService';

const TaskModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  members = [],
  conflictError = null,
  onReloadTask = null,
  isOwner = false,
}) => {
  const { user } = useAuth();
  const isEditing = Boolean(initialData?._id);
  const canAssign = user?.role === 'ADMIN' || user?.role === 'MANAGER' || isOwner;
  const isCreator = !isEditing || (initialData?.createdBy?._id || initialData?.createdBy)?.toString() === user?._id?.toString();
  const canEditDetails = user?.role === 'ADMIN' || user?.role === 'MANAGER' || isCreator;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    assignedTo: '',
    dueDate: '',
  });

  const [formErrors, setFormErrors] = useState({});
  const [workspaceUsers, setWorkspaceUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && canAssign && workspaceUsers.length === 0) {
      projectService
        .getUsers()
        .then((res) => {
          if (res?.success && Array.isArray(res.data)) {
            setWorkspaceUsers(res.data);
          }
        })
        .catch((err) => {
          console.warn('Failed to load workspace users:', err.message);
        });
    }
  }, [isOpen, canAssign, workspaceUsers.length]);

  // Combine project members and all workspace users without duplicates
  const userMap = new Map();
  members.forEach((m) => {
    if (m && m._id) userMap.set(m._id.toString(), m);
  });
  workspaceUsers.forEach((u) => {
    if (u && u._id) userMap.set(u._id.toString(), u);
  });
  const assignableUsers = Array.from(userMap.values());

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        status: initialData.status || 'TODO',
        priority: initialData.priority || 'MEDIUM',
        assignedTo: initialData.assignedTo?._id || initialData.assignedTo || '',
        dueDate: initialData.dueDate ? new Date(initialData.dueDate).toISOString().split('T')[0] : '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        assignedTo: '',
        dueDate: '',
      });
    }
    setFormErrors({});
    setSubmitting(false);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const errors = {};
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.length > 200) {
      errors.title = 'Title cannot exceed 200 characters';
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    let payload = {};
    if (isEditing && !canEditDetails) {
      payload = {
        status: formData.status,
        version: initialData.version,
      };
    } else {
      payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        status: formData.status,
        priority: formData.priority,
        dueDate: formData.dueDate || null,
      };

      // Only include assignedTo if user has permission
      if (canAssign) {
        payload.assignedTo = formData.assignedTo || null;
      }

      // Attach version for OCC when editing
      if (isEditing) {
        payload.version = initialData.version;
      }
    }

    try {
      setSubmitting(true);
      await onSubmit(payload);
    } catch (err) {
      // Re-enable button on error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow">
          <div className="modal-header bg-light">
            <h5 className="modal-title fw-semibold">
              {isEditing ? `Edit Task (v${initialData.version})` : 'Create New Task'}
            </h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={submitting}></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {/* Concurrency Conflict Alert */}
              {conflictError && (
                <div className="alert alert-warning d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3" role="alert">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-exclamation-octagon-fill me-2 fs-5 text-warning flex-shrink-0"></i>
                    <span><strong>Conflict Detected:</strong> Another user updated this task.</span>
                  </div>
                  {onReloadTask && (
                    <button
                      type="button"
                      className="btn btn-warning btn-sm fw-semibold ms-auto"
                      onClick={() => onReloadTask(initialData._id)}
                    >
                      Load Latest
                    </button>
                  )}
                </div>
              )}

              <div className="mb-3">
                <label className="form-label fw-semibold small">
                  Title <span className="text-danger">*</span>
                  {!canEditDetails && (
                    <span className="text-muted fw-normal ms-1">(Read-only)</span>
                  )}
                </label>
                <input
                  type="text"
                  name="title"
                  className={`form-control ${formErrors.title ? 'is-invalid' : ''}`}
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Enter task title"
                  disabled={!canEditDetails}
                  autoFocus
                />
                {formErrors.title && <div className="invalid-feedback">{formErrors.title}</div>}
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold small">Description</label>
                <textarea
                  name="description"
                  rows="3"
                  className="form-control"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Task details and deliverables..."
                  disabled={!canEditDetails}
                ></textarea>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Status</label>
                  <select name="status" className="form-select" value={formData.status} onChange={handleChange}>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Priority</label>
                  <select
                    name="priority"
                    className="form-select"
                    value={formData.priority}
                    onChange={handleChange}
                    disabled={!canEditDetails}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">
                    Assignee {canAssign ? '' : <span className="text-muted fw-normal">(Manager/Admin only)</span>}
                  </label>
                  <select
                    name="assignedTo"
                    className="form-select"
                    value={formData.assignedTo}
                    onChange={handleChange}
                    disabled={!canAssign}
                  >
                    <option value="">Unassigned</option>
                    {assignableUsers.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name} ({m.email}) — {m.role || 'Member'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Due Date</label>
                  <input
                    type="date"
                    name="dueDate"
                    className="form-control"
                    value={formData.dueDate}
                    onChange={handleChange}
                    disabled={!canEditDetails}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer bg-light">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                disabled={submitting}
              >
                {submitting && (
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                )}
                <span>
                  {isEditing
                    ? (submitting ? 'Saving...' : 'Save Changes')
                    : (submitting ? 'Creating Task...' : 'Create Task')}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
