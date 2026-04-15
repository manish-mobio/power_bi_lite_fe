const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  /** First 3xx — use `status < REDIRECTION` to test 2xx success. */
  REDIRECTION: 300,
  INTERNAL_SERVER_ERROR: 500,
};

/** True for status codes 200–299 (inclusive). */
export function isHttpSuccessStatus(status) {
  return status >= HTTP_STATUS.OK && status < HTTP_STATUS.REDIRECTION;
}

export default HTTP_STATUS;
