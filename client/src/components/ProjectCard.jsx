import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProjectCard = ({ project, onDelete }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Get first 3 members for avatar stack
  const previewMembers = project.members ? project.members.slice(0, 4) : [];
  const extraMembersCount = project.members && project.members.length > 4 ? project.members.length - 4 : 0;

  return (
    <div className="card card-hover h-100">
      <div className="card-body d-flex flex-column p-4">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div className="d-flex align-items-center gap-3">
            <div className="icon-circle icon-circle-indigo" style={{ width: '42px', height: '42px', fontSize: '1.2rem' }}>
              <i className="bi bi-folder2-open"></i>
            </div>
            <div>
              <h5 className="card-title fw-bold text-dark mb-0">{project.name}</h5>
              <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                Owner: <strong>{project.owner?.name || 'Unknown'}</strong>
              </span>
            </div>
          </div>

          {onDelete && (
            <button
              className="btn btn-outline-danger btn-sm p-1 lh-1 rounded-circle"
              style={{ width: '28px', height: '28px' }}
              title="Delete Project"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(project._id);
              }}
            >
              <i className="bi bi-trash" style={{ fontSize: '0.8rem' }}></i>
            </button>
          )}
        </div>

        <p className="card-text text-muted small flex-grow-1 mb-3" style={{ lineHeight: '1.5' }}>
          {project.description || 'Collaborative workspace for task planning and delivery tracking.'}
        </p>

        {/* Member Avatar Stack */}
        <div className="d-flex justify-content-between align-items-center pt-3 border-top border-light-subtle mb-3">
          <div className="d-flex align-items-center">
            <div className="d-flex" style={{ marginLeft: '4px' }}>
              {previewMembers.map((m, idx) => (
                <div
                  key={m._id || idx}
                  className="avatar-circle"
                  style={{
                    marginLeft: idx === 0 ? '0' : '-8px',
                    zIndex: 10 - idx,
                    backgroundColor: idx % 2 === 0 ? '#e0e7ff' : '#f3e8ff',
                    color: idx % 2 === 0 ? '#4338ca' : '#7c3aed',
                  }}
                  title={m.name || 'Member'}
                >
                  {m.name ? m.name.charAt(0).toUpperCase() : 'M'}
                </div>
              ))}
              {extraMembersCount > 0 && (
                <div
                  className="avatar-circle bg-light text-secondary small"
                  style={{ marginLeft: '-8px', zIndex: 1, fontSize: '0.65rem' }}
                >
                  +{extraMembersCount}
                </div>
              )}
            </div>
            <span className="text-muted small ms-2" style={{ fontSize: '0.78rem' }}>
              {project.members?.length || 0} members
            </span>
          </div>
        </div>

        <div className="d-flex gap-2">
          <Link to={`/projects/${project._id}`} className="btn btn-outline-secondary btn-sm flex-fill">
            <i className="bi bi-list-task me-1"></i> Tasks
          </Link>
          <Link to={`/projects/${project._id}/board`} className="btn btn-primary btn-sm flex-fill">
            <i className="bi bi-kanban me-1"></i> Board
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
