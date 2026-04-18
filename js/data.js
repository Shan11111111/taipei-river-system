export async function loadRivers() {
  const res = await fetch('data/rivers.geojson');
  return await res.json();
}