import React from 'react';

const ErrorMessage = ({ message, onDismiss, onRetry }) => {
  if (!message) return null;

  return (
    <div className="alert alert-danger d-flex align-items-center justify-content-between my-3" role="alert">
      <div className="d-flex align-items-center">
        <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
        <div>{message}</div>
      </div>
      <div>
        {onRetry && (
          <button className="btn btn-outline-danger btn-sm me-2" onClick={onRetry}>
            Retry
          </button>
        )}
        {onDismiss && (
          <button type="button" className="btn-close" aria-label="Close" onClick={onDismiss}></button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
