'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import Image from 'next/image';

interface CompanyMarker {
  name: string;
  lat: number;
  lon: number;
  image?: string;
  largeImage?: string;
  tagline?: string;
  about?: string;
  employees?: string;
  websiteUrl?: string;
  city?: string;
  country?: string;
}

const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);

const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

// Custom MarkerClusterGroup component for React-Leaflet v5
function MarkerClusterGroup({ children }: { children: React.ReactNode }) {
  const { useMap } = require('react-leaflet');
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const L = require('leaflet');
    require('leaflet.markercluster');

    // Create marker cluster group with custom settings
    const clusterGroup = L.markerClusterGroup({
      // Show markers when zoomed in enough
      disableClusteringAtZoom: 15,
      // Animate cluster splitting
      animate: true,
      // Spider out markers on click (mobile) and hover (desktop)
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      // Maximum radius for clustering
      maxClusterRadius: 80,
      // Spiderfy on hover for desktop
      spiderfyOnEveryZoom: false,
      // Custom cluster icon
      iconCreateFunction: function(cluster: any) {
        const count = cluster.getChildCount();
        let size = 'small';
        if (count > 10) size = 'medium';
        if (count > 20) size = 'large';

        return L.divIcon({
          html: `<div><span>${count}</span></div>`,
          className: `marker-cluster marker-cluster-${size}`,
          iconSize: L.point(40, 40)
        });
      }
    });

    // Add spiderfy on hover for desktop
    clusterGroup.on('clustermouseover', function(this: any, a: any) {
      if (window.innerWidth >= 768) { // Desktop only
        this.spiderfy();
      }
    });

    clusterGroup.on('clustermouseout', function(this: any, a: any) {
      if (window.innerWidth >= 768) {
        this.unspiderfy();
      }
    });

    map.addLayer(clusterGroup);

    // Store cluster group on map for children to access
    (map as any)._clusterGroup = clusterGroup;

    return () => {
      if (clusterGroup) {
        map.removeLayer(clusterGroup);
      }
    };
  }, [map]);

  return <>{children}</>;
}

// Wrapper component to add markers to cluster group
function ClusteredMarker({ company, icon }: { company: CompanyMarker; icon: any }) {
  const { useMap } = require('react-leaflet');
  const map = useMap();

  useEffect(() => {
    if (!map || !(map as any)._clusterGroup) return;

    const L = require('leaflet');
    const clusterGroup = (map as any)._clusterGroup;

    // Create marker
    const marker = L.marker([company.lat, company.lon], { icon });

    // Create popup content
    const popupContent = document.createElement('div');
    popupContent.className = 'p-3 bg-white dark:bg-gray-800';
    popupContent.innerHTML = `
      ${company.largeImage ? `<img src="${company.largeImage}" alt="${company.name}" class="w-full max-w-[200px] h-auto object-contain mb-3 mx-auto" />` : ''}
      <h3 class="font-bold text-lg mb-2 text-gray-900 dark:text-white">${company.name}</h3>
      ${company.tagline ? `<p class="text-sm text-gray-600 dark:text-gray-400 mb-2 italic">${company.tagline}</p>` : ''}
      ${company.about ? `<p class="text-xs text-gray-700 dark:text-gray-300 mb-3 line-clamp-3">${company.about}</p>` : ''}
      <div class="text-xs space-y-1 border-t border-gray-200 dark:border-gray-600 pt-2">
        ${company.city ? `<p class="text-gray-700 dark:text-gray-300"><strong class="text-gray-900 dark:text-white">Location:</strong> ${company.city}, ${company.country}</p>` : ''}
        ${company.employees ? `<p class="text-gray-700 dark:text-gray-300"><strong class="text-gray-900 dark:text-white">Employees:</strong> ${company.employees}</p>` : ''}
        ${company.websiteUrl ? `<a href="${company.websiteUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline block mt-2">Visit Website →</a>` : ''}
      </div>
    `;

    marker.bindPopup(popupContent, { maxWidth: 400 });

    // Add marker to cluster group
    clusterGroup.addLayer(marker);

    return () => {
      clusterGroup.removeLayer(marker);
    };
  }, [map, company, icon]);

  return null;
}

interface MapClientProps {
  companies: CompanyMarker[];
}

export default function MapClient({ companies }: MapClientProps) {
  useEffect(() => {
    // Leaflet setup runs client-side only
    const L = require('leaflet');
  }, []);

  // Function to create custom icon from company image
  const createCustomIcon = (imageUrl?: string) => {
    if (typeof window === 'undefined') return undefined;
    
    const L = require('leaflet');
    
    if (imageUrl) {
      return L.icon({
        iconUrl: imageUrl,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
        className: 'custom-marker-icon dark:bg-gray-800 dark:text-white',
      });
    }
    
    // Fallback to default marker if no image
    return L.icon({
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      shadowSize: [41, 41],
    });
  };

  // Center on Amsterdam
  const center: [number, number] = [52.370216, 4.895168];

  return (
    <div className="h-screen w-full">
      <MapContainer
        center={center}
        zoom={12}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        {/* PDOK Base Map */}
        <TileLayer
          attribution='&copy; <a href="https://www.pdok.nl">PDOK</a>'
          url="https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/pastel/EPSG:3857/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Company Markers with Clustering */}
        <MarkerClusterGroup>
          {companies.map((company, index) => (
            <ClusteredMarker
              key={index}
              company={company}
              icon={createCustomIcon(company.image)}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Info Bar */}
      <div className="absolute top-4 right-4 p-4 rounded-lg shadow-lg z-[1000] bg-white dark:bg-gray-800" >
        <h2 className="text-xl font-bold mb-1 text-gray-800 dark:text-white">Amsterdam Deep Tech Map</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {companies.length} companies with locations
        </p>
        
        {/* iAmsterdam Link */}
        <a 
          href="https://startupmap.iamsterdam.com/lists/54856/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="block mt-3 p-2 rounded hover:opacity-90 transition-opacity"
          style={{ background: "hsl(0, 85%, 53%)" }}
        >
          <Image 
            src="/iamsterdam-logo.png" 
            alt="iAmsterdam Deep Tech Map" 
            width={120} 
            height={40}
            className="object-contain"
          />
        </a>

        {/* Credits */}
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
          <p>Map created by{' '}
            <a 
              href="https://github.com/mcix" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Arnoud
            </a>
            {' '}@{' '}
            <a 
              href="https://deltaproto.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              DeltaProto
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

