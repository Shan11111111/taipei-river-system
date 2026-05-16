import { initMap } from './map.js';
import { loadRivers } from './data.js';
import { renderRiverList } from './ui.js';

async function init() {
  const map = initMap();

  const rivers = await loadRivers();

  renderRiverList(rivers, map);
}

init();