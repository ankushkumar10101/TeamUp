import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import projectService from '../services/projectService';
import taskService from '../services/taskService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { getStatusBadge, getPriorityBadge } from '../utils/formatters';

const DashboardPage = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [myTasksData, setMyTasksData] = useState({ tasks: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [projectsRes, tasksRes] = await Promise.all([
        projectService.getProjects(),
        taskService.getMyDashboardTasks(),
      ]);

      if (projectsRes.success) {
        setProjects(projectsRes.data);
      }
      if (tasksRes.success) {
        setMyTasksData(tasksRes.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Loading your dashboard..." />;
  }

  const { stats, tasks: myTasks } = myTasksData;

  return (
    <div>
      {/* Top Welcome Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-2">
        <div>
          <h2 className="fw-bold text-dark mb-1">Welcome back, {user?.name}! 👋</h2>
          <p className="text-muted small mb-0">
            Track real-time progress, manage collaborative task flow, and eliminate concurrency conflicts.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/projects" className="btn btn-primary d-flex align-items-center gap-2">
            <i className="bi bi-folder2-open"></i>
            <span>View All Projects</span>
          </Link>
        </div>
      </div>

      <ErrorMessage message={error} onDismiss={() => setError(null)} onRetry={fetchDashboardData} />

      {/* 4 Engaging KPI Cards (ExpenseFlow Style) */}
      <div className="row g-3 mb-4">
        {/* Total Projects Card */}
        <div className="col-sm-6 col-xl-3">
          <div className="kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="kpi-label">Workspaces</div>
                <div className="kpi-value">{projects.length}</div>
                <div className="kpi-subtext">
                  <i className="bi bi-layers text-primary"></i> Active Projects
                </div>
              </div>
              <div className="icon-circle icon-circle-indigo">
                <i className="bi bi-folder-fill"></i>
              </div>
            </div>
          </div>
        </div>

        {/* My Tasks Card */}
        <div className="col-sm-6 col-xl-3">
          <div className="kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="kpi-label">My Assigned</div>
                <div className="kpi-value">{stats?.totalMyTasks || 0}</div>
                <div className="kpi-subtext">
                  <i className="bi bi-person-check-fill text-purple"></i> Assigned to you
                </div>
              </div>
              <div className="icon-circle icon-circle-purple">
                <i className="bi bi-list-task"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks In Progress Card */}
        <div className="col-sm-6 col-xl-3">
          <div className="kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="kpi-label">In Progress</div>
                <div className="kpi-value text-primary">{stats?.inProgressCount || 0}</div>
                <div className="kpi-subtext">
                  <i className="bi bi-arrow-repeat text-amber"></i> Active Sprint Tasks
                </div>
              </div>
              <div className="icon-circle icon-circle-amber">
                <i className="bi bi-hourglass-split"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Completed Tasks Card */}
        <div className="col-sm-6 col-xl-3">
          <div className="kpi-card h-100">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="kpi-label">Completed</div>
                <div className="kpi-value text-success">{stats?.completedCount || 0}</div>
                <div className="kpi-subtext">
                  <i className="bi bi-check-circle-fill text-success"></i> Tasks Delivered
                </div>
              </div>
              <div className="icon-circle icon-circle-emerald">
                <i className="bi bi-check2-circle"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Sections: Recent Projects & My Tasks */}
      <div className="row g-4">
        {/* Projects List Card */}
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-2">
                <div className="p-1 rounded bg-primary-subtle text-primary">
                  <i className="bi bi-folder2-open small"></i>
                </div>
                <h6 className="fw-bold mb-0 text-dark">Active Workspaces</h6>
              </div>
              <Link to="/projects" className="small text-decoration-none fw-semibold text-primary">
                View all ({projects.length})
              </Link>
            </div>

            <div className="card-body p-0">
              {projects.length === 0 ? (
                <div className="p-4 text-center text-muted small">No projects accessible.</div>
              ) : (
                <div className="list-group list-group-flush">
                  {projects.slice(0, 4).map((project) => (
                    <div
                      key={project._id}
                      className="list-group-item d-flex justify-content-between align-items-center py-3 px-3 border-light-subtle"
                    >
                      <div className="me-2 text-truncate" style={{ minWidth: 0 }}>
                        <div className="fw-semibold text-dark mb-1 text-truncate">{project.name}</div>
                        <p className="text-muted small mb-0 text-truncate">
                          {project.description || 'No description provided.'}
                        </p>
                        <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                          <span className="badge bg-light text-secondary border small" style={{ fontSize: '0.7rem' }}>
                            <i className="bi bi-people me-1"></i>
                            {project.members?.length || 0} members
                          </span>
                          <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                            Lead: <strong>{project.owner?.name}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="d-flex gap-1 gap-sm-2 flex-shrink-0">
                        <Link
                          to={`/projects/${project._id}`}
                          className="btn btn-primary btn-sm d-flex align-items-center gap-1 p-1 px-2"
                          title="View Project Tasks"
                        >
                          <i className="bi bi-list-task"></i>
                          <span className="d-none d-sm-inline">View Tasks</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* My Tasks Table Card */}
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-2">
                <div className="p-1 rounded bg-success-subtle text-success">
                  <i className="bi bi-check2-square small"></i>
                </div>
                <h6 className="fw-bold mb-0 text-dark">My Assigned Tasks</h6>
              </div>
              <span className="badge rounded-pill bg-light text-secondary border">{myTasks.length} tasks</span>
            </div>

            <div className="card-body p-0">
              {myTasks.length === 0 ? (
                <div className="p-4 text-center text-muted small">You currently have no tasks assigned.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light small text-muted">
                      <tr>
                        <th className="ps-3">Task</th>
                        <th>Project</th>
                        <th>Status</th>
                        <th className="pe-3">Priority</th>
                      </tr>
                    </thead>
                    <tbody className="small">
                      {myTasks.map((t) => {
                        const statusBadge = getStatusBadge(t.status);
                        const priorityBadge = getPriorityBadge(t.priority);
                        return (
                          <tr key={t._id}>
                            <td className="ps-3 fw-semibold text-dark text-truncate" style={{ maxWidth: '170px' }}>
                              {t.title}
                            </td>
                            <td className="text-muted text-truncate" style={{ maxWidth: '120px' }}>
                              {t.project?.name || 'Project'}
                            </td>
                            <td>
                              <span className={`badge badge-pill-soft ${
                                t.status === 'DONE' ? 'badge-done' : t.status === 'IN_PROGRESS' ? 'badge-inprogress' : 'badge-todo'
                              }`}>
                                {statusBadge.label}
                              </span>
                            </td>
                            <td className="pe-3">
                              <span className={`badge badge-pill-soft ${
                                t.priority === 'HIGH' ? 'badge-high' : t.priority === 'MEDIUM' ? 'badge-medium' : 'badge-low'
                              }`}>
                                {priorityBadge.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
