import React from 'react';
import { useAuth } from '../context/AuthContext';
import { formatDate, getPriorityBadge, getStatusBadge } from '../utils/formatters';

const TaskCard = ({
  task,
  project = null,
  onEdit,
  onDelete,
  onMove,
  isDraggable = false,
  onDragStart,
  onDragEnd,
}) => {
  const { user } = useAuth();
  const isOwner = Boolean(project && (project.owner?._id || project.owner)?.toString() === user?._id?.toString());
  const isCreator = (task.createdBy?._id || task.createdBy)?.toString() === user?._id?.toString();
  const isAssignee = (task.assignedTo?._id || task.assignedTo)?.toString() === user?._id?.toString();

  const canDelete = user?.role === 'ADMIN' || user?.role === 'MANAGER' || isOwner;
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER' || isOwner || isCreator || isAssignee;
  const canMove = user?.role === 'ADMIN' || user?.role === 'MANAGER' || isOwner || isCreator || isAssignee;

  const priorityInfo = getPriorityBadge(task.priority);
  const statusInfo = getStatusBadge(task.status);
  const assigneeInitial = task.assignedTo?.name ? task.assignedTo.name.charAt(0).toUpperCase() : '?';

  return (
    <div
      className="kanban-card"
      draggable={isDraggable && canMove}
      onDragStart={(e) => onDragStart && onDragStart(e, task)}
      onDragEnd={onDragEnd}
    >
      <div className="d-flex justify-content-between align-items-start gap-1 mb-2">
        <span className={`badge badge-pill-soft ${
          task.priority === 'HIGH' ? 'badge-high' : task.priority === 'MEDIUM' ? 'badge-medium' : 'badge-low'
        }`}>
          {priorityInfo.label}
        </span>
        <span className="occ-badge" title="Optimistic Concurrency Version">
          v{task.version}
        </span>
      </div>

      <h6 className="fw-bold text-dark mb-1 fs-6" style={{ lineHeight: '1.3' }}>
        {task.title}
      </h6>

      {task.description && (
        <p className="text-muted small mb-2 text-truncate" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
          {task.description}
        </p>
      )}

      {/* Quick Move Action Buttons (Crucial for Mobile & Touch Screen Accessibility) */}
      {canMove && onMove && (
        <div className="d-flex align-items-center justify-content-between pt-2 pb-1 border-top border-light-subtle my-2">
          <span className="text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.02em' }}>
            Move:
          </span>
          <div className="btn-group btn-group-sm">
            {task.status !== 'TODO' && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm py-0 px-2"
                style={{ fontSize: '0.72rem' }}
                title="Move to To Do"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(task._id, 'TODO', task.version);
                }}
              >
                <i className="bi bi-arrow-left me-1"></i>To Do
              </button>
            )}
            {task.status === 'TODO' && (
              <button
                type="button"
                className="btn btn-outline-primary btn-sm py-0 px-2 fw-semibold"
                style={{ fontSize: '0.72rem' }}
                title="Start working on task"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(task._id, 'IN_PROGRESS', task.version);
                }}
              >
                In Progress <i className="bi bi-arrow-right ms-1"></i>
              </button>
            )}
            {task.status === 'IN_PROGRESS' && (
              <button
                type="button"
                className="btn btn-outline-success btn-sm py-0 px-2 fw-semibold"
                style={{ fontSize: '0.72rem' }}
                title="Mark as Done"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(task._id, 'DONE', task.version);
                }}
              >
                Done <i className="bi bi-check2 ms-1"></i>
              </button>
            )}
            {task.status === 'DONE' && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm py-0 px-2"
                style={{ fontSize: '0.72rem' }}
                title="Reopen task"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(task._id, 'IN_PROGRESS', task.version);
                }}
              >
                <i className="bi bi-arrow-counterclockwise me-1"></i>Reopen
              </button>
            )}
          </div>
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center pt-2 border-top border-light-subtle">
        <div className="d-flex align-items-center gap-1">
          {task.assignedTo ? (
            <div className="d-flex align-items-center gap-1">
              <div
                className="avatar-circle"
                style={{ width: '24px', height: '24px', fontSize: '0.65rem' }}
                title={task.assignedTo.name}
              >
                {assigneeInitial}
              </div>
              <span className="text-muted text-truncate" style={{ fontSize: '0.78rem', maxWidth: '90px' }}>
                {task.assignedTo.name}
              </span>
            </div>
          ) : (
            <span className="text-muted small fst-italic" style={{ fontSize: '0.75rem' }}>
              <i className="bi bi-dash-circle me-1"></i> Unassigned
            </span>
          )}
        </div>

        <div className="d-flex align-items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          {canEdit && onEdit && (
            <button
              type="button"
              className="btn btn-sm text-secondary p-1 lh-1 hover-primary"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEdit && onEdit(task);
              }}
              title="Edit Task"
            >
              <i className="bi bi-pencil" style={{ fontSize: '0.82rem' }}></i>
            </button>
          )}
          {canDelete && onDelete && (
            <button
              type="button"
              className="btn btn-sm text-danger p-1 lh-1"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task._id);
              }}
              title="Delete Task"
            >
              <i className="bi bi-trash" style={{ fontSize: '0.82rem' }}></i>
            </button>
          )}
        </div>
      </div>

      {task.dueDate && (
        <div className="mt-2 text-muted" style={{ fontSize: '0.72rem' }}>
          <i className="bi bi-calendar3 me-1 text-primary"></i>
          {formatDate(task.dueDate)}
        </div>
      )}
    </div>
  );
};

export default TaskCard;
