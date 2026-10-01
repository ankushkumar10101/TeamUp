export const formatDate = (dateString) => {
  if (!dateString) return 'No due date';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const getPriorityBadge = (priority) => {
  switch (priority) {
    case 'HIGH':
      return { label: 'High', className: 'bg-danger' };
    case 'MEDIUM':
      return { label: 'Medium', className: 'bg-warning text-dark' };
    case 'LOW':
      return { label: 'Low', className: 'bg-info text-dark' };
    default:
      return { label: priority || 'Medium', className: 'bg-secondary' };
  }
};

export const getStatusBadge = (status) => {
  switch (status) {
    case 'TODO':
      return { label: 'To Do', className: 'bg-secondary' };
    case 'IN_PROGRESS':
      return { label: 'In Progress', className: 'bg-primary' };
    case 'DONE':
      return { label: 'Done', className: 'bg-success' };
    default:
      return { label: status || 'Unknown', className: 'bg-secondary' };
  }
};

export const getRoleBadge = (role) => {
  switch (role) {
    case 'ADMIN':
      return { label: 'Admin', className: 'bg-dark text-white' };
    case 'MANAGER':
      return { label: 'Manager', className: 'bg-primary text-white' };
    case 'MEMBER':
      return { label: 'Member', className: 'bg-secondary text-white' };
    default:
      return { label: role || 'User', className: 'bg-secondary text-white' };
  }
};
