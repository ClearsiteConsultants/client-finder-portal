/**
 * Google Places types used in discovery and exclusion workflows.
 * Source: Google Places supported place types (legacy/new overlap).
 */

export const GOOGLE_PLACES_BUSINESS_TYPES: string[] = [
  'accounting',
  'airport',
  'amusement_park',
  'aquarium',
  'art_gallery',
  'atm',
  'bakery',
  'bank',
  'bar',
  'beauty_salon',
  'bicycle_store',
  'book_store',
  'bowling_alley',
  'bus_station',
  'cafe',
  'campground',
  'car_dealer',
  'car_rental',
  'car_repair',
  'car_wash',
  'casino',
  'cemetery',
  'church',
  'city_hall',
  'clothing_store',
  'convenience_store',
  'courthouse',
  'dentist',
  'department_store',
  'doctor',
  'drugstore',
  'electrician',
  'electronics_store',
  'embassy',
  'fire_station',
  'florist',
  'funeral_home',
  'furniture_store',
  'gas_station',
  'gym',
  'hair_care',
  'hardware_store',
  'hindu_temple',
  'home_goods_store',
  'hospital',
  'insurance_agency',
  'jewelry_store',
  'laundry',
  'lawyer',
  'library',
  'light_rail_station',
  'liquor_store',
  'local_government_office',
  'locksmith',
  'lodging',
  'meal_delivery',
  'meal_takeaway',
  'mosque',
  'movie_rental',
  'movie_theater',
  'moving_company',
  'museum',
  'night_club',
  'painter',
  'park',
  'parking',
  'pet_store',
  'pharmacy',
  'physiotherapist',
  'plumber',
  'police',
  'post_office',
  'primary_school',
  'real_estate_agency',
  'restaurant',
  'roofing_contractor',
  'rv_park',
  'school',
  'secondary_school',
  'shoe_store',
  'shopping_mall',
  'spa',
  'stadium',
  'storage',
  'store',
  'subway_station',
  'supermarket',
  'synagogue',
  'taxi_stand',
  'tourist_attraction',
  'train_station',
  'transit_station',
  'travel_agency',
  'university',
  'veterinary_care',
  'zoo',
  'establishment',
  'point_of_interest',
  'food',
  'finance',
  'health',
].sort();

export function formatGooglePlaceTypeLabel(type: string): string {
  return type
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function mergeBusinessTypes(additionalTypes: string[] = []): string[] {
  const uniqueTypes = new Set(
    [...GOOGLE_PLACES_BUSINESS_TYPES, ...additionalTypes]
      .map((type) => type.trim())
      .filter((type) => type.length > 0)
  );

  return Array.from(uniqueTypes).sort();
}
