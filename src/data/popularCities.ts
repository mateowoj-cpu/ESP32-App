/** Popular weather city presets — labels resolved via i18n (`integ.city.*`). */
export const POPULAR_CITIES: Record<
  string,
  { lat: number; lon: number; country: string; labelKey: string }
> = {
  Dortmund: { lat: 51.5136, lon: 7.4653, country: 'DE', labelKey: 'integ.city.dortmund' },
  Warszawa: { lat: 52.2297, lon: 21.0122, country: 'PL', labelKey: 'integ.city.warszawa' },
  Kraków: { lat: 50.0647, lon: 19.945, country: 'PL', labelKey: 'integ.city.krakow' },
  Wrocław: { lat: 51.1079, lon: 17.0385, country: 'PL', labelKey: 'integ.city.wroclaw' },
  Gdańsk: { lat: 54.352, lon: 18.6466, country: 'PL', labelKey: 'integ.city.gdansk' },
  Poznań: { lat: 52.4064, lon: 16.9252, country: 'PL', labelKey: 'integ.city.poznan' },
  Katowice: { lat: 50.2649, lon: 19.0238, country: 'PL', labelKey: 'integ.city.katowice' },
  Berlin: { lat: 52.52, lon: 13.405, country: 'DE', labelKey: 'integ.city.berlin' },
  Monachium: { lat: 48.1351, lon: 11.582, country: 'DE', labelKey: 'integ.city.munich' },
  Kolonia: { lat: 50.9375, lon: 6.9603, country: 'DE', labelKey: 'integ.city.cologne' },
  Frankfurt: { lat: 50.1109, lon: 8.6821, country: 'DE', labelKey: 'integ.city.frankfurt' },
  Hamburg: { lat: 53.5511, lon: 9.9937, country: 'DE', labelKey: 'integ.city.hamburg' },
  Londyn: { lat: 51.5074, lon: -0.1278, country: 'GB', labelKey: 'integ.city.london' },
  Paryż: { lat: 48.8566, lon: 2.3522, country: 'FR', labelKey: 'integ.city.paris' },
  Wiedeń: { lat: 48.2082, lon: 16.3738, country: 'AT', labelKey: 'integ.city.vienna' },
  Praga: { lat: 50.0755, lon: 14.4378, country: 'CZ', labelKey: 'integ.city.prague' },
  'Nowy Jork': { lat: 40.7128, lon: -74.006, country: 'US', labelKey: 'integ.city.newyork' },
  Tokio: { lat: 35.6762, lon: 139.6503, country: 'JP', labelKey: 'integ.city.tokyo' },
};
