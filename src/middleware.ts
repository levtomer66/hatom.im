// PR 1 of the SSO rollout: middleware is wired in but lets every request
// through. Future PRs flip on per-route gating here. Keeping the file
// in place so PR diffs that add gates only touch the matcher / branching,
// not the bootstrap.
export { auth as middleware } from '@/auth';

export const config = {
  // Empty matcher means the middleware runs on no requests — useful while
  // we wire up the OAuth client without disrupting any existing routes.
  matcher: [],
};
