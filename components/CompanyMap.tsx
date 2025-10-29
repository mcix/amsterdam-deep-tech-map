import fs from 'fs';
import path from 'path';
import MapClient from './MapClient';

interface HQLocation {
  lat: number;
  lon: number;
  city?: {
    name: string;
  };
  country?: {
    name: string;
  };
}

interface Company {
  name: string;
  hq_locations?: HQLocation[];
  images?: {
    '32x32'?: string;
    '74x74'?: string;
    '100x100'?: string;
  };
  tagline?: string;
  about?: string;
  employees?: string;
  website_url?: string;
}

interface CompanyData {
  items: Company[];
}

/**
 * Creates a deterministic hash from a string
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Applies smart jittering to companies at identical coordinates
 * Spreads them in a circle pattern for visibility while keeping them grouped
 */
function applySmartJittering<T extends { name: string; lat: number; lon: number }>(companies: T[]): T[] {
  // Group companies by exact coordinates
  const locationGroups = new Map<string, typeof companies>();

  companies.forEach(company => {
    const key = `${company.lat},${company.lon}`;
    if (!locationGroups.has(key)) {
      locationGroups.set(key, []);
    }
    locationGroups.get(key)!.push(company);
  });

  // Apply jittering to groups with multiple companies
  const jitteredCompanies = companies.map(company => {
    const key = `${company.lat},${company.lon}`;
    const group = locationGroups.get(key)!;

    // Only jitter if there are multiple companies at this location
    if (group.length <= 1) {
      return company;
    }

    // Find this company's index in the group (deterministic based on name)
    const sortedGroup = [...group].sort((a, b) => a.name.localeCompare(b.name));
    const index = sortedGroup.findIndex(c => c.name === company.name);

    // Calculate offset in a circle pattern
    // Radius: 0.0008 degrees ≈ 80-90 meters (good visibility without too much spread)
    const radius = 0.0008;
    const angle = (2 * Math.PI * index) / group.length;

    // Add deterministic variation based on company name to avoid perfect circles
    const nameHash = hashString(company.name);
    const radiusVariation = 0.3 + (nameHash % 100) / 100 * 0.4; // 0.3 to 0.7
    const actualRadius = radius * radiusVariation;

    const latOffset = actualRadius * Math.cos(angle);
    const lonOffset = actualRadius * Math.sin(angle);

    return {
      ...company,
      lat: company.lat + latOffset,
      lon: company.lon + lonOffset,
    };
  });

  const duplicateCount = Array.from(locationGroups.values()).filter(g => g.length > 1).length;
  const affectedCompanies = Array.from(locationGroups.values()).filter(g => g.length > 1).reduce((sum, g) => sum + g.length, 0);

  console.log(`Applied smart jittering to ${affectedCompanies} companies across ${duplicateCount} locations`);

  return jitteredCompanies;
}

// This is a Server Component - it runs on the server
export default function CompanyMap() {
  // Read the JSON file from the filesystem (server-side only)
  const filePath = path.join(process.cwd(), 'public', 'companies-full.json');
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const data: CompanyData = JSON.parse(fileContents);

  // Transform the data to only what we need for the map
  let companies = data.items
    .filter((company) => {
      // Only include companies with valid headquarters location
      const hq = company.hq_locations?.[0];
      return hq && hq.lat && hq.lon;
    })
    .map((company) => {
      const hq = company.hq_locations![0];
      return {
        name: company.name,
        lat: hq.lat,
        lon: hq.lon,
        image: company.images?.['32x32'], // Use smallest image for markers
        largeImage: company.images?.['100x100'], // Use larger image for popup
        tagline: company.tagline,
        about: company.about,
        employees: company.employees,
        websiteUrl: company.website_url,
        city: hq.city?.name,
        country: hq.country?.name,
      };
    });

  console.log(`Loaded ${companies.length} companies with valid locations`);

  // Apply smart jittering to spread out overlapping markers
  companies = applySmartJittering(companies);

  // Pass the processed data to the client component
  return <MapClient companies={companies} />;
}
