'use client';

import dynamic from 'next/dynamic';

// Client-only loader so the server detail page can embed the Leaflet map
// (react-leaflet needs `window`; ssr:false is only allowed from a Client Component).
const Inner = dynamic(() => import('./MiniPositionMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />,
});

export default function MiniPositionMapLoader(props: { lat: number; lng: number; label?: string }) {
  return <Inner {...props} />;
}
