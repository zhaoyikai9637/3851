export function signInUrl(returnTo = '/applicant/jobs', register = false) {
  const safe = /^\/applicant\/(?:jobs(?:\/[A-Za-z0-9_-]+)?|apply\/[A-Za-z0-9_-]+|resume(?:\/upload)?|status)$/.test(returnTo) ? returnTo : '/applicant/jobs';
  const query = new URLSearchParams({returnTo:safe});
  if (register) query.set('mode','register');
  return '/pages/login/login.html?' + query.toString();
}
