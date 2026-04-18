export function initMap() {
  const map = L.map('map').setView([25.05, 121.5], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  return map;
}