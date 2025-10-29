'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import Image from 'next/image';
import type L from 'leaflet';

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

// Import useMapEvents dynamically
const MapEventsComponent = dynamic(
  () => import('react-leaflet').then((mod) => {
    const { useMapEvents } = mod;
    return {
      default: function MapInit({ onMapReady }: { onMapReady: (map: any) => void }) {
        const map = useMapEvents({});
        useEffect(() => {
          if (map) {
            onMapReady(map);
          }
        }, [map, onMapReady]);
        return null;
      }
    };
  }),
  { ssr: false }
);

// Mobile drawer component for company info
function MobileDrawer({
  company,
  isOpen,
  onClose
}: {
  company: CompanyMarker | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
    setTouchEnd(e.targetTouches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    const swipeDistance = touchStart - touchEnd;

    // Swipe up to close (negative value means swiping up)
    if (swipeDistance > 50) {
      onClose();
    }

    setIsDragging(false);
    setTouchStart(0);
    setTouchEnd(0);
  };

  if (!company) return null;

  return (
    <>
      {/* Backdrop - clickable map area at bottom */}
      <div
        className={`fixed inset-0 z-[9998] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      >
        <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-auto" />
      </div>

      {/* Drawer */}
      <div
        className={`fixed left-0 right-0 bg-white dark:bg-gray-800 shadow-2xl z-[9999] rounded-b-3xl transition-all duration-300 ease-out ${
          isOpen ? 'top-0' : '-top-full'
        }`}
        style={{ maxHeight: 'calc(100vh - 120px)' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe indicator at top */}
        <div className="pt-2 pb-1 flex items-center justify-center">
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <div className="p-6 pb-16">
            {company.largeImage && (
              <img
                src={company.largeImage}
                alt={company.name}
                className="w-full max-w-[150px] h-auto object-contain mb-4 mx-auto"
              />
            )}
            <h3 className="font-bold text-2xl mb-3 text-gray-900 dark:text-white">
              {company.name}
            </h3>
            {company.tagline && (
              <p className="text-base text-gray-600 dark:text-gray-400 mb-3 italic">
                {company.tagline}
              </p>
            )}
            {company.about && (
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">
                {company.about}
              </div>
            )}
            <div className="text-sm space-y-2 border-t border-gray-200 dark:border-gray-600 pt-3">
              {company.city && (
                <p className="text-gray-700 dark:text-gray-300">
                  <strong className="text-gray-900 dark:text-white">Location:</strong>{' '}
                  {company.city}, {company.country}
                </p>
              )}
              {company.employees && (
                <p className="text-gray-700 dark:text-gray-300">
                  <strong className="text-gray-900 dark:text-white">Employees:</strong>{' '}
                  {company.employees}
                </p>
              )}
              {company.websiteUrl && (
                <a
                  href={company.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline block mt-3 text-base font-medium"
                >
                  Visit Website →
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Swipe handle at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-16 flex items-center justify-center cursor-pointer bg-gradient-to-t from-white dark:from-gray-800 to-transparent pointer-events-none">
          <div className="w-16 h-1 bg-gray-400 dark:bg-gray-500 rounded-full shadow-sm" />
        </div>
      </div>
    </>
  );
}

// Clustering component that manages all markers
function MarkerClusterManager({
  companies,
  createCustomIcon,
  onMarkerClick
}: {
  companies: CompanyMarker[];
  createCustomIcon: (imageUrl?: string) => any;
  onMarkerClick: (company: CompanyMarker) => void;
}) {
  const clusterGroupRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const handleMapReady = (map: any) => {
    if (!map || clusterGroupRef.current) return;

    const L = require('leaflet');
    require('leaflet.markercluster');

    // Create marker cluster group with custom settings
    const clusterGroup = L.markerClusterGroup({
      // Only cluster when markers actually overlap (very small radius)
      maxClusterRadius: 40,
      // Disable clustering at higher zoom for better visibility
      disableClusteringAtZoom: 18,
      // Always spiderfy instead of zooming in
      spiderfyOnMaxZoom: true,
      // Animation settings
      animate: true,
      animateAddingMarkers: false,
      // Show coverage on hover to indicate clustered area
      showCoverageOnHover: true,
      // Spiderfy settings for nice spreading
      spiderfyDistanceMultiplier: 1.5,
      spiderLegPolylineOptions: {
        weight: 2,
        color: '#4A90E2',
        opacity: 0.7
      },
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
      },
      // Custom click handler to always spiderfy instead of zoom
      zoomToBoundsOnClick: false
    });

    // Spiderfy on hover for desktop
    clusterGroup.on('clustermouseover', function(a: any) {
      if (window.innerWidth >= 768 && a.layer.getAllChildMarkers) {
        a.layer.spiderfy();
      }
    });

    clusterGroup.on('clustermouseout', function(a: any) {
      if (window.innerWidth >= 768 && a.layer.unspiderfy) {
        a.layer.unspiderfy();
      }
    });

    // Spiderfy on click for all devices (especially mobile)
    clusterGroup.on('clusterclick', function(a: any) {
      const cluster = a.layer;
      // Toggle spiderfy state
      if (cluster._group._spiderfied) {
        cluster.unspiderfy();
      } else {
        cluster.spiderfy();
      }
    });

    // Add all markers to cluster group
    companies.forEach((company) => {
      const icon = createCustomIcon(company.image);
      const marker = L.marker([company.lat, company.lon], { icon });

      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

      if (isMobile) {
        // On mobile, use custom drawer instead of popup
        marker.on('click', () => {
          onMarkerClick(company);
        });
      } else {
        // On desktop, use Leaflet popup
        const popupContent = document.createElement('div');
        popupContent.className = 'p-4 bg-white dark:bg-gray-800';
        popupContent.innerHTML = `
          ${company.largeImage ? `<img src="${company.largeImage}" alt="${company.name}" class="w-full max-w-[150px] h-auto object-contain mb-3 mx-auto" />` : ''}
          <h3 class="font-bold text-xl mb-2 text-gray-900 dark:text-white">${company.name}</h3>
          ${company.tagline ? `<p class="text-sm text-gray-600 dark:text-gray-400 mb-3 italic">${company.tagline}</p>` : ''}
          ${company.about ? `<div class="text-sm text-gray-700 dark:text-gray-300 mb-3 max-h-32 overflow-y-auto pr-2 popup-scrollable">${company.about}</div>` : ''}
          <div class="text-sm space-y-1 border-t border-gray-200 dark:border-gray-600 pt-2">
            ${company.city ? `<p class="text-gray-700 dark:text-gray-300"><strong class="text-gray-900 dark:text-white">Location:</strong> ${company.city}, ${company.country}</p>` : ''}
            ${company.employees ? `<p class="text-gray-700 dark:text-gray-300"><strong class="text-gray-900 dark:text-white">Employees:</strong> ${company.employees}</p>` : ''}
            ${company.websiteUrl ? `<a href="${company.websiteUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline block mt-2">Visit Website →</a>` : ''}
          </div>
        `;

        marker.bindPopup(popupContent, {
          maxWidth: 500,
          minWidth: 300,
          maxHeight: 400,
          autoPan: true,
          keepInView: true,
          closeOnClick: false,
          autoClose: false,
          closeButton: true
        });
      }

      clusterGroup.addLayer(marker);
      markersRef.current.push(marker);
    });

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;
  };

  return <MapEventsComponent onMapReady={handleMapReady} />;
}

interface MapClientProps {
  companies: CompanyMarker[];
}

export default function MapClient({ companies }: MapClientProps) {
  const [selectedCompany, setSelectedCompany] = useState<CompanyMarker | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    // Leaflet setup runs client-side only
    const L = require('leaflet');
  }, []);

  const handleMarkerClick = (company: CompanyMarker) => {
    setSelectedCompany(company);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedCompany(null), 300);
  };

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
        <MarkerClusterManager
          companies={companies}
          createCustomIcon={createCustomIcon}
          onMarkerClick={handleMarkerClick}
        />
      </MapContainer>

      {/* Mobile Drawer for company info */}
      <MobileDrawer
        company={selectedCompany}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
      />

      {/* Info Bar */}
      <div className="absolute top-4 right-4 p-4 rounded-lg shadow-lg z-[1000] bg-white dark:bg-gray-800 md:block hidden" >
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

