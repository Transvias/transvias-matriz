#!/usr/bin/env bash
# Gera a matriz completa numa máquina Linux qualquer com Docker, Node 20+ e osmium-tool.
# Usado pelo workflow "Gerar matriz (Google Cloud)"; serve também para rodar à mão num servidor.
# Precisa de ~32 GB de memória (ou 16 GB + swap) e ~40 GB de disco em $OSM_DIR.
#
#   OSM_DIR=/mnt/osm SO=osasco-sp,campinas-sp scripts/gerar.sh
#
# Saída: out/matriz.tar.gz (matriz/<slug>.bin + cidades.json).

set -euo pipefail
cd "$(dirname "$0")/.."

OSM_DIR=${OSM_DIR:-/mnt/osm}
OSRM_IMAGE=${OSRM_IMAGE:-ghcr.io/project-osrm/osrm-backend:v5.27.1}
mkdir -p "$OSM_DIR"

echo "== Mapa"
curl -sSfL -o "$OSM_DIR/brasil.osm.pbf" https://download.geofabrik.de/south-america/brazil-latest.osm.pbf
osmium tags-filter "$OSM_DIR/brasil.osm.pbf" \
  w/highway=motorway,motorway_link,trunk,trunk_link,primary,primary_link,secondary,secondary_link,tertiary,tertiary_link,unclassified,residential,road,service \
  w/route=ferry \
  r/type=restriction -o "$OSM_DIR/vias.osm.pbf" --overwrite
rm "$OSM_DIR/brasil.osm.pbf"

echo "== OSRM"
free -h
docker run --rm -v "$OSM_DIR:/data" "$OSRM_IMAGE" osrm-extract -p /opt/car.lua /data/vias.osm.pbf
docker run --rm -v "$OSM_DIR:/data" "$OSRM_IMAGE" osrm-partition /data/vias.osrm
docker run --rm -v "$OSM_DIR:/data" "$OSRM_IMAGE" osrm-customize /data/vias.osrm
rm "$OSM_DIR/vias.osm.pbf"
docker rm -f osrm >/dev/null 2>&1 || true
docker run -d --name osrm -p 5000:5000 -v "$OSM_DIR:/data" "$OSRM_IMAGE" \
  osrm-routed --algorithm mld --max-table-size 10000 /data/vias.osrm
for i in $(seq 1 120); do curl -sf "http://127.0.0.1:5000/route/v1/driving/-46.63,-23.55;-47.06,-22.90" >/dev/null && break; sleep 5; done

echo "== Matriz"
node scripts/cidades.mjs
node scripts/matriz.mjs
node scripts/conferir.mjs
docker rm -f osrm >/dev/null

rm -rf out/pacote && mkdir -p out/pacote/matriz
cp out/matriz/*.bin out/pacote/matriz/
cp data/cidades.json out/pacote/
tar -czf out/matriz.tar.gz -C out/pacote .
ls -lh out/matriz.tar.gz
