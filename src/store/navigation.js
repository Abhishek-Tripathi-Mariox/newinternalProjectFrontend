/**
 * Lets store actions change the route (e.g. after login or when previewing a
 * role that cannot open the current page) without depending on React Router.
 *
 * The app shell may call `registerNavigate(useNavigate())`; otherwise we fall
 * back to history.pushState + a popstate event, which BrowserRouter listens to
 * (and which also works before the router has mounted).
 */
let navigateFn = null;

export function registerNavigate(fn) {
  navigateFn = fn;
  return () => { if (navigateFn === fn) navigateFn = null; };
}

export const currentPath = () => (typeof window === 'undefined' ? '/' : window.location.pathname);

export function navigate(path) {
  if (typeof window === 'undefined' || currentPath() === path) return;
  if (navigateFn) return navigateFn(path);
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
}
