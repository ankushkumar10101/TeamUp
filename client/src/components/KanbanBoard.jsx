import React, { useState } from 'react';
import KanbanColumn from './KanbanColumn';

const KanbanBoard = ({
  tasks = [],
  project = null,
  onEditTask,
  onDeleteTask,
  onDropTask,
}) => {
  const [activeMobileTab, setActiveMobileTab] = useState('ALL');

  const todoTasks = tasks.filter((t) => t.status === 'TODO');
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS');
  const doneTasks = tasks.filter((t) => t.status === 'DONE');

  return (
    <div className="kanban-wrapper">
      {/* Mobile Column Quick Filter / Navigation Tabs */}
      <div className="d-flex d-md-none gap-2 mb-3 overflow-x-auto pb-1 kanban-mobile-tabs">
        <button
          type="button"
          className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold text-nowrap ${
            activeMobileTab === 'ALL' ? 'btn-primary shadow-sm' : 'btn-outline-secondary'
          }`}
          onClick={() => setActiveMobileTab('ALL')}
        >
          All Columns ({tasks.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold text-nowrap ${
            activeMobileTab === 'TODO' ? 'btn-secondary shadow-sm text-white' : 'btn-outline-secondary'
          }`}
          onClick={() => setActiveMobileTab('TODO')}
        >
          <i className="bi bi-circle me-1"></i> To Do ({todoTasks.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold text-nowrap ${
            activeMobileTab === 'IN_PROGRESS' ? 'btn-primary shadow-sm' : 'btn-outline-secondary'
          }`}
          onClick={() => setActiveMobileTab('IN_PROGRESS')}
        >
          <i className="bi bi-arrow-repeat me-1"></i> In Progress ({inProgressTasks.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold text-nowrap ${
            activeMobileTab === 'DONE' ? 'btn-success shadow-sm text-white' : 'btn-outline-secondary'
          }`}
          onClick={() => setActiveMobileTab('DONE')}
        >
          <i className="bi bi-check-circle-fill me-1"></i> Done ({doneTasks.length})
        </button>
      </div>

      {/* Kanban Columns Grid / Snap Container */}
      <div className="kanban-board">
        {(activeMobileTab === 'ALL' || activeMobileTab === 'TODO') && (
          <KanbanColumn
            status="TODO"
            title="To Do"
            tasks={todoTasks}
            project={project}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
            onDropTask={onDropTask}
            onMoveTask={onDropTask}
          />
        )}
        {(activeMobileTab === 'ALL' || activeMobileTab === 'IN_PROGRESS') && (
          <KanbanColumn
            status="IN_PROGRESS"
            title="In Progress"
            tasks={inProgressTasks}
            project={project}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
            onDropTask={onDropTask}
            onMoveTask={onDropTask}
          />
        )}
        {(activeMobileTab === 'ALL' || activeMobileTab === 'DONE') && (
          <KanbanColumn
            status="DONE"
            title="Done"
            tasks={doneTasks}
            project={project}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
            onDropTask={onDropTask}
            onMoveTask={onDropTask}
          />
        )}
      </div>
    </div>
  );
};

export default KanbanBoard;
