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

// This is a Server Component - it runs on the server
export default function CompanyMap() {
  // Read the JSON file from the filesystem (server-side only)
  const filePath = path.join(process.cwd(), 'public', 'companies-full.json');
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const data: CompanyData = JSON.parse(fileContents);

  // Transform the data to only what we need for the map
  const companies = data.items
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
        tagline: company.tagline,
        about: company.about,
        employees: company.employees,
        websiteUrl: company.website_url,
        city: hq.city?.name,
        country: hq.country?.name,
      };
    });

  console.log(`Loaded ${companies.length} companies with valid locations`);

  // Pass the processed data to the client component
  return <MapClient companies={companies} />;
}
