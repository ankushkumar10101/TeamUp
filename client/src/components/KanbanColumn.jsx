import React, { useState } from 'react';
import TaskCard from './TaskCard';

const KanbanColumn = ({
  status,
  title,
  tasks = [],
  project = null,
  onEditTask,
  onDeleteTask,
  onDropTask,
  onMoveTask,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    const versionStr = e.dataTransfer.getData('application/teamup-version');
    const version = versionStr ? Number(versionStr) : null;
    if (taskId) {
      onDropTask(taskId, status, version);
    }
  };

  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('text/plain', task._id);
    e.dataTransfer.setData('application/teamup-version', String(task.version));
    e.target.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'TODO':
        return 'bi-circle';
      case 'IN_PROGRESS':
        return 'bi-arrow-repeat';
      case 'DONE':
        return 'bi-check-circle-fill';
      default:
        return 'bi-circle';
    }
  };

  const getPillClass = () => {
    switch (status) {
      case 'TODO':
        return 'bg-secondary bg-opacity-10 text-secondary border border-secondary-subtle';
      case 'IN_PROGRESS':
        return 'bg-primary bg-opacity-10 text-primary border border-primary-subtle';
      case 'DONE':
        return 'bg-success bg-opacity-10 text-success border border-success-subtle';
      default:
        return 'bg-secondary';
    }
  };

  return (
    <div className="kanban-column">
      <div className="kanban-column-header">
        <div className="d-flex align-items-center gap-2">
          <i className={`bi ${getStatusIcon()} fs-6`}></i>
          <span>{title}</span>
        </div>
        <span className={`badge rounded-pill ${getPillClass()} px-2 py-1`} style={{ fontSize: '0.75rem' }}>
          {tasks.length}
        </span>
      </div>

      <div
        className={`kanban-column-body ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {tasks.length === 0 ? (
          <div className="text-center text-muted small p-4 border border-dashed rounded-3 h-100 d-flex flex-column align-items-center justify-content-center bg-white bg-opacity-50">
            <i className="bi bi-inbox text-muted fs-4 mb-1"></i>
            <span>No tasks in this column</span>
            <span className="text-muted" style={{ fontSize: '0.72rem' }}>Drag a card here</span>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              project={project}
              isDraggable={true}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onMove={onMoveTask}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
