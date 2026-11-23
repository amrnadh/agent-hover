'use client';

import dynamic from 'next/dynamic';

// The Vite demo's app, unchanged. It reads the saved theme from the browser while rendering, so it renders in the
// browser only (no server render), as it does under Vite.
const App = dynamic(() => import('../src/App'), { ssr: false });

export default function Page() {
  return <App />;
}
