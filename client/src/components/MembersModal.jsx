import React from 'react';

const MembersModal = ({ isOpen, onClose, project }) => {
  if (!isOpen || !project) return null;

  const currentMembers = project.members || [];
  const ownerId = (project.owner?._id || project.owner)?.toString();

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow">
          <div className="modal-header bg-light">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-people-fill text-primary"></i>
              <h5 className="modal-title fw-semibold mb-0">Project Members ({currentMembers.length})</h5>
            </div>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            {/* Informational notice */}
            <div className="alert alert-light border small text-muted d-flex align-items-center mb-3 py-2 px-3">
              <i className="bi bi-info-circle-fill text-primary me-2 fs-6 flex-shrink-0"></i>
              <span>Project members are managed automatically based on task assignments.</span>
            </div>

            {/* Current Members List */}
            {currentMembers.length === 0 ? (
              <div className="text-center text-muted small py-4">No members in this project.</div>
            ) : (
              <div className="list-group list-group-flush">
                {currentMembers.map((m) => {
                  const memberId = (m._id || m).toString();
                  const isOwner = memberId === ownerId;

                  return (
                    <div
                      key={memberId}
                      className="list-group-item d-flex align-items-center justify-content-between px-2 py-2 border-light-subtle"
                    >
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle bg-primary-subtle text-primary fw-bold d-flex align-items-center justify-content-center"
                          style={{ width: '36px', height: '36px', fontSize: '0.85rem' }}
                        >
                          {m.name ? m.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                          <div className="fw-semibold text-dark small mb-0 d-flex align-items-center gap-1">
                            <span>{m.name || 'User'}</span>
                            {isOwner && (
                              <span
                                className="badge bg-warning-subtle text-warning border border-warning-subtle py-0"
                                style={{ fontSize: '0.65rem' }}
                              >
                                Owner
                              </span>
                            )}
                          </div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {m.email} {m.role ? `• ${m.role}` : ''}
                          </div>
                        </div>
                      </div>

                      <div>
                        {isOwner ? (
                          <span className="badge rounded-pill bg-light text-secondary border small">
                            Project Lead
                          </span>
                        ) : (
                          <span className="badge rounded-pill bg-light text-muted border small">
                            Assigned Member
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="modal-footer bg-light py-2">
            <button type="button" className="btn btn-secondary btn-sm px-3" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MembersModal;
