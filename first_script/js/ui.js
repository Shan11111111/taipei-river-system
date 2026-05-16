export function renderRiverList(geojson, map) {
  const container = document.getElementById('river-list');

  const layers = {};

  L.geoJSON(geojson, {
    style: defaultStyle,
    onEachFeature: (feature, layer) => {

      const name = feature.properties.name;

      layers[name] = layer;

      layer.on({
        mouseover: () => highlight(layer),
        mouseout: () => reset(layer),
        click: () => zoomToRiver(map, layer)
      });

    }
  }).addTo(map);

  // 產生 checkbox
  Object.keys(layers).forEach(name => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;

    checkbox.onchange = () => {
      if (checkbox.checked) {
        layers[name].addTo(map);
      } else {
        map.removeLayer(layers[name]);
      }
    };

    container.appendChild(checkbox);
    container.appendChild(document.createTextNode(name));
    container.appendChild(document.createElement('br'));
  });
}

function defaultStyle() {
  return {
    color: 'blue',
    weight: 3
  };
}

function highlight(layer) {
  layer.setStyle({
    color: 'red',
    weight: 5
  });
}

function reset(layer) {
  layer.setStyle({
    color: 'blue',
    weight: 3
  });
}

function zoomToRiver(map, layer) {
  map.fitBounds(layer.getBounds());
}