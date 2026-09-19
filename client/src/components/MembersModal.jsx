import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import projectService from '../services/projectService';

const MembersModal = ({ isOpen, onClose, project, onProjectUpdated }) => {
  const { user } = useAuth();
  const [workspaceUsers, setWorkspaceUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingMemberId, setConfirmingMemberId] = useState(null);

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setConfirmingMemberId(null);
      if (canManage) {
        projectService
          .getUsers()
          .then((res) => {
            if (res?.success && Array.isArray(res.data)) {
              setWorkspaceUsers(res.data);
            }
          })
          .catch((err) => console.warn('Failed to load users:', err.message));
      }
    }
  }, [isOpen, canManage]);

  if (!isOpen || !project) return null;

  const currentMembers = project.members || [];
  const currentMemberIds = new Set(currentMembers.map((m) => (m._id || m).toString()));

  // Users who are registered but not yet members of this project
  const nonMembers = workspaceUsers.filter((u) => !currentMemberIds.has(u._id.toString()));

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;

    try {
      setLoading(true);
      setError(null);
      const updatedMemberIds = [...Array.from(currentMemberIds), selectedUserId];
      const res = await projectService.updateProject(project._id, {
        name: project.name,
        members: updatedMemberIds,
      });

      if (res.success) {
        setSelectedUserId('');
        if (onProjectUpdated) onProjectUpdated(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to add member.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    const ownerId = (project.owner?._id || project.owner)?.toString();
    if (memberId.toString() === ownerId) {
      setError('Cannot remove the project owner.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const updatedMemberIds = Array.from(currentMemberIds).filter((id) => id !== memberId.toString());
      const res = await projectService.updateProject(project._id, {
        name: project.name,
        members: updatedMemberIds,
      });

      if (res.success) {
        setConfirmingMemberId(null);
        if (onProjectUpdated) onProjectUpdated(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to remove member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow">
          <div className="modal-header bg-light">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-people-fill text-primary"></i>
              <h5 className="modal-title fw-semibold mb-0">Project Members ({currentMembers.length})</h5>
            </div>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="alert alert-danger alert-dismissible fade show py-2 px-3 small mb-3 d-flex align-items-center justify-content-between" role="alert">
                <div className="d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill me-2 text-danger"></i>
                  <span>{error}</span>
                </div>
                <button type="button" className="btn-close py-2" aria-label="Close" onClick={() => setError(null)}></button>
              </div>
            )}

            {/* Add Member Bar (for Admin / Manager) */}
            {canManage && (
              <form onSubmit={handleAddMember} className="mb-3 pb-3 border-bottom">
                <label className="form-label small fw-semibold text-muted mb-1">Add Teammate to Project:</label>
                <div className="input-group input-group-sm">
                  <select
                    className="form-select"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    disabled={loading || nonMembers.length === 0}
                  >
                    <option value="">
                      {nonMembers.length === 0
                        ? 'All registered users are already members'
                        : 'Select a user to add...'}
                    </option>
                    {nonMembers.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.email}) — {u.role || 'Member'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="btn btn-primary d-flex align-items-center gap-1"
                    disabled={!selectedUserId || loading}
                  >
                    <i className="bi bi-person-plus-fill"></i>
                    <span>Add</span>
                  </button>
                </div>
              </form>
            )}

            {/* Current Members List */}
            <div className="list-group list-group-flush">
              {currentMembers.map((m) => {
                const memberId = (m._id || m).toString();
                const isOwner = memberId === (project.owner?._id || project.owner)?.toString();

                return (
                  <div
                    key={memberId}
                    className="list-group-item d-flex align-items-center justify-content-between px-2 py-2 border-light-subtle"
                  >
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className="rounded-circle bg-primary-subtle text-primary fw-bold d-flex align-items-center justify-content-center"
                        style={{ width: '34px', height: '34px', fontSize: '0.85rem' }}
                      >
                        {m.name ? m.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div>
                        <div className="fw-semibold text-dark small mb-0 d-flex align-items-center gap-1">
                          <span>{m.name || 'User'}</span>
                          {isOwner && (
                            <span className="badge bg-warning-subtle text-warning border border-warning-subtle py-0" style={{ fontSize: '0.65rem' }}>
                              Owner
                            </span>
                          )}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {m.email} {m.role ? `• ${m.role}` : ''}
                        </div>
                      </div>
                    </div>

                    {canManage && !isOwner && (
                      confirmingMemberId === memberId ? (
                        <div className="d-flex align-items-center gap-1">
                          <span className="text-danger small fw-semibold" style={{ fontSize: '0.72rem' }}>Remove?</span>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm py-0 px-2 fw-semibold d-flex align-items-center gap-1"
                            style={{ fontSize: '0.72rem' }}
                            onClick={() => handleRemoveMember(memberId)}
                            disabled={loading}
                          >
                            {loading ? (
                              <span className="spinner-border spinner-border-sm" style={{ width: '0.65rem', height: '0.65rem' }}></span>
                            ) : (
                              'Yes'
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm py-0 px-1"
                            style={{ fontSize: '0.72rem' }}
                            onClick={() => setConfirmingMemberId(null)}
                            disabled={loading}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm py-0 px-2"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => {
                            setError(null);
                            setConfirmingMemberId(memberId);
                          }}
                          disabled={loading}
                          title="Remove member from project"
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="modal-footer bg-light py-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MembersModal;
