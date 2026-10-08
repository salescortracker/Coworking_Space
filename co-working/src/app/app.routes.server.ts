import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * The mockup keeps its state (mock session, demo data) in the browser, so every route is
 * rendered on the client. Switch public marketing routes back to Prerender/Server once the
 * real API is connected.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
