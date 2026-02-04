export function googleMapsPlaceUrl(placeId: string): string {
  const trimmed = placeId.trim();
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(trimmed)}`;
}
