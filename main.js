import './style.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import { ScaleLine, defaults as defaultControls } from 'ol/control.js';
import XYZ from 'ol/source/XYZ.js';
import { Image as ImageLayer } from 'ol/layer.js';
import ImageWMS from 'ol/source/ImageWMS.js';
import VectorLayer from 'ol/layer/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Vector as VectorSource } from 'ol/source.js';
import Overlay from 'ol/Overlay.js';
import { Icon, Style } from 'ol/style.js';
import { Circle as CircleStyle, Fill, Stroke, Text } from 'ol/style.js';
import { fromLonLat } from 'ol/proj.js';
import { Cluster } from 'ol/source.js';
import TileWMS from 'ol/source/TileWMS.js';

const textFill = new Fill({
	color: '#fff',
});
const textStroke = new Stroke({
	color: 'rgba(255, 255, 255, 1)',
	width: .5,
});

const veloIcon = new Icon({
	src: 'img/velo.png',
	scale: 0.22
});

function clusterMemberStyle(clusterMember) {
	return new Style({
		geometry: clusterMember.getGeometry(),
		image: veloIcon,
	});
}

let clickFeature, clickResolution;

function clusterCircleStyle(cluster, resolution) {
	if (cluster !== clickFeature || resolution !== clickResolution) {
		return null;
	}
	const clusterMembers = cluster.get('features');
	const centerCoordinates = cluster.getGeometry().getCoordinates();
	return generatePointsCircle(
		clusterMembers.length,
		cluster.getGeometry().getCoordinates(),
		resolution
	).reduce((styles, coordinates, i) => {
		const point = new Point(coordinates);
		const line = new LineString([centerCoordinates, coordinates]);
		styles.unshift(
			new Style({
				geometry: line,
				stroke: convexHullStroke,
			})
		);
		styles.push(
			clusterMemberStyle(
				new Feature({
					...clusterMembers[i].getProperties(),
					geometry: point,
				})
			)
		);
		return styles;
	}, []);
}

function generatePointsCircle(count, clusterCenter, resolution) {
	const circumference =
		circleDistanceMultiplier * circleFootSeparation * (2 + count);
	let legLength = circumference / (Math.PI * 2);
	const angleStep = (Math.PI * 2) / count;
	const res = [];
	let angle;

	legLength = Math.max(legLength, 35) * resolution;

	for (let i = 0; i < count; ++i) {
		// Clockwise, like spiral.
		angle = circleStartAngle + i * angleStep;
		res.push([
			clusterCenter[0] + legLength * Math.cos(angle),
			clusterCenter[1] + legLength * Math.sin(angle),
		]);
	}

	return res;
}

let hoverFeature;
/**
 * @param {Feature} cluster 
 * @return {Style|null} 
 */

function clusterStyle(feature) {
	const size = feature.get('features').length;
	if (size > 1) {
		if (size < 20) {
			var rad = 20
			var fillColor = "blue" 
		}
		else if (size < 50) {
			rad = 30
		}
		else if (size < 100) {
			rad = 40
		}
		else {
			rad = 50
		}
		return [
			new Style({
				image: new CircleStyle({
					radius: rad +1.5,
					fill: new Fill({
						color: 'rgba(255,255,255,1)',
					}),
				}),
			}),
			new Style({
				image: new CircleStyle({
					radius: rad,
					fill: new Fill({
						color: 'rgba(40, 133, 111, 1)',
					}),
				}),
				text: new Text({
					text: size.toString(),
					fill: textFill,
					stroke: textStroke,
				}),
			}),
		];
	}
	const originalFeature = feature.get('features')[0];
	return clusterMemberStyle(originalFeature);
}

let myChart;
const container = document.getElementById('popup');
const content = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');
container.style.position = 'absolute'

const overlay = new Overlay({
	element: container,
	autoPan: {
		animation: {
			duration: 250,
		},
	},
});

/**
 * Add a click handler to hide the popup.
 * @return {boolean} Don't follow the href.
 */
closer.onclick = function () {
	overlay.setPosition(undefined);
	closer.blur();
	return false;
};
const map = new Map({
	overlays: [overlay],
	target: 'map',

	layers: [
		new TileLayer({
			preload: Infinity,

			source: new XYZ({
				attributions: [
					'<a href="https://jawg.io?utm_medium=map&utm_source=attribution" title="Tiles Courtesy of Jawg Maps" target="_blank" class="jawg-attrib" >&copy; <b>Jawg</b>Maps</a> | <a href="https://www.openstreetmap.org/copyright" title="OpenStreetMap is open data licensed under ODbL" target="_blank" class="osm-attrib">&copy; OSM contributors</a> | <a href="https://opendata.paris.fr/explore/dataset/velib-disponibilite-en-temps-reel/information/?disjunctive.name&disjunctive.is_installed&disjunctive.is_renting&disjunctive.is_returning&disjunctive.nom_arrondissement_communes" target="_blank">OpenData Paris</a> | Airparif',
				],
				url: 'https://tile.jawg.io/2dcec727-580f-4915-a903-5373db4d0b40/{z}/{x}/{y}.png?access-token=cHwHz2jFd1k6blmFA6wnYur05s8mCVw6336l2GHmEEAWqvCNZ0dfQMazW83EJUHw',
			}),
		}),
	],
	view: new View({
		center: [261338, 6250619],
		projection: 'EPSG:3857',
		zoom: 12,
	}),
});

let scaleLineControl = new ScaleLine({
	units: 'metric',
	minWidth: 65,
});

map.addControl(scaleLineControl);

let url = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/geojson?lang=fr&timezone=Europe%2FBerlin";
fetch(url)
	.then(response => {
		return response.json()
	})
	.then(data => {
		let jsonData = JSON.stringify(data);
		localStorage.setItem('station_velo', jsonData)
	})

let jsonData = localStorage.getItem('station_velo');
let data = JSON.parse(jsonData);

let vectorSource = new VectorSource({
	format: new GeoJSON(),
	features: (new GeoJSON({
		dataProjection: 'EPSG:4326',
		featureProjection: 'EPSG:3857'
	})).readFeatures(data)
})

const clusterSource = new Cluster({
	distance: 100,
	source: vectorSource,
});

// Layer displaying the clusters and individual features.
const clusters = new VectorLayer({
	source: clusterSource,
	style: clusterStyle,
});

// Layer displaying the expanded view of overlapping cluster members.
const clusterCircles = new VectorLayer({
	source: clusterSource,
	style: clusterCircleStyle,
});

const piste_cyclable = new ImageLayer({
	source: new ImageWMS({
		url: 'http://localhost:8080/geoserver/OL/wms?service=WMS&version=1.1.0&request=GetMap',
		params: {
			'LAYERS': 'OL:reseau-cyclable'
		},
		ratio: 1,
		serverType: 'geoserver',
	}),
});

const gare = new VectorLayer({
	source: new VectorSource({
		url: 'json/gare.geojson',
		format: new GeoJSON()
	}),
});

const bus = new VectorLayer({
	source: new VectorSource({
		url: 'json/arret_bus.geojson',
		format: new GeoJSON()
	}),
});

const gareStyle = new Style({
	image: new Icon({
		src: 'img/tram.png',
		scale: .15
	}),
});
const busStyle = new Style({
	image: new Icon({
		src: 'img/bus.png',
		scale: .15
	}),
});
bus.setStyle(busStyle)
gare.setStyle(gareStyle);

let wmsPollution =
	new TileLayer({
		source: new TileWMS({
			url: 'https://magellan.airparif.asso.fr/geoserver/apisHorAir/wms',
			params: { "request": "GetMap", 'LAYERS': 'apisHorAir:indice_api', "styles": "", "authkey": "c719086c-94d2-f6e0-2fff-94db463fba2d" },
			serverType: 'geoserver',
			transition: 0,
		}),
		opacity: 1
	});

piste_cyclable.setZIndex(0)
gare.setZIndex(1)
clusters.setZIndex(2)
bus.setZIndex(0)

let layers = {
	"geoserver-Pistes_cyclables": piste_cyclable,
	"geojson-gare": gare,
	"geojson-bus": bus,
	"api-velo": clusters,
	"wms-pollution": wmsPollution
}

document.querySelector('#selection_layer').onclick = function (ev) {
	if (ev.target.checked == true) {
		map.addLayer(layers[ev.target.id])
	} else if (ev.target.checked == false) {
		if (ev.target.id == "api-velo") {
			overlay.setPosition(undefined);
		}
		map.removeLayer(layers[ev.target.id])
	}
}

document.getElementById("recherche").onclick = function geocode() {
	let dest = document.getElementById('geocode').value
	let url_geocode = `https://nominatim.openstreetmap.org/search?q=${dest}&format=json&limit=1`
	console.log(encodeURI(url_geocode))
	fetch(encodeURI(url_geocode)).then(response => {
		return response.json()
	})
		.then(data => {
			let lat = data[0].lat
			let lon = data[0].lon
			map.getView().setCenter(fromLonLat([lon, lat]));
			map.getView().setZoom(17);
		})
}

map.on('click', function (event) {
	let feature = map.forEachFeatureAtPixel(event.pixel, function (feature) {
		if (feature.get('features')) {
			let ctx = document.getElementById('chart').getContext("2d");
			let clusterFeatures = feature.get('features');
			if (clusterFeatures && clusterFeatures.length == 1) {
				if (myChart != null) {
					myChart.destroy();
				}
				container.style.display = 'inline'

				let nomStation = clusterFeatures[0]["values_"]["name"]
				let dateStation = clusterFeatures[0]["values_"]["duedate"]
				let veloRestant = clusterFeatures[0]["values_"]["numbikesavailable"]
				let placeRestant = clusterFeatures[0]["values_"]["numdocksavailable"]
				let coordinates = feature.getGeometry().getCoordinates();
				content.innerHTML =
					`<div id="popup-text"><span><b>Vélib </b>${nomStation}</span> ` + '<br>' + '<span><b>Dernière mise à jour</b> </span>' + dateStation.slice(0, 19).replaceAll("-", "/").replace("T", " - ")
				overlay.setPosition(coordinates);

				let ctx = document.getElementById('chart');
				let data = {
					labels: [`${veloRestant} vélos disponibles`, `${placeRestant} places disponibles`],
					datasets: [{
						data: [veloRestant, placeRestant],
						backgroundColor: ['#28856F', '#85283E']
					}]
				};
				myChart = new Chart(ctx, {
					type: 'pie',
					data: data,

				});
			}
		}
		return feature;
	});
	if (!feature) {
		overlay.setPosition(undefined);
	}
});

const opacityInput = document.getElementById('opacity-input');
function update() {
	const opacity = parseFloat(opacityInput.value);
	wmsPollution.setOpacity(opacity);
}
opacityInput.addEventListener('input', update);
update();