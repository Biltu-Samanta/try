// Realistic orbital ground tracks for Earth observation and radar satellites
export interface SatelliteOrbit {
  id: string;
  name: string;
  type: string;
  inclination: string;
  altitude: string;
  color: string;
  coordinates: [number, number][]; // [lng, lat]
}

// Generate smooth sinusoidal ground track for an orbit
function generateGroundTrack(
  inclinationDeg: number,
  ascNodeDeg: number,
  cycles: number = 2.5,
  pointsPerCycle: number = 72
): [number, number][] {
  const coords: [number, number][] = [];
  const totalPoints = cycles * pointsPerCycle;
  
  for (let i = 0; i <= totalPoints; i++) {
    const fraction = i / pointsPerCycle;
    const lat = inclinationDeg * Math.sin(fraction * 2 * Math.PI);
    // Earth rotates under the satellite (approx 22.5 deg per cycle)
    const lng = ((ascNodeDeg + fraction * 360 - fraction * 25) % 360 + 540) % 360 - 180;
    coords.push([Number(lng.toFixed(4)), Number(lat.toFixed(4))]);
  }
  return coords;
}

export const ORBITAL_SATELLITES: SatelliteOrbit[] = [
  {
    id: 'eos-04',
    name: 'EOS-04 / RISAT-1A SAR (ISRO)',
    type: 'C-Band Radar Observation',
    inclination: '97.5° (Polar Sun-Synch)',
    altitude: '529 km',
    color: '#1fea00',
    coordinates: generateGroundTrack(82, 78, 3),
  },
  {
    id: 'sentinel-1a',
    name: 'Sentinel-1A SAR',
    type: 'C-Band Radar Constellation',
    inclination: '98.18° (Sun-Synch)',
    altitude: '693 km',
    color: '#34d399',
    coordinates: generateGroundTrack(82, 45, 3),
  },
  {
    id: 'terrasar-x',
    name: 'TerraSAR-X InSAR',
    type: 'X-Band High-Res Radar',
    inclination: '97.44°',
    altitude: '514 km',
    color: '#6ee7b7',
    coordinates: generateGroundTrack(80, 85, 3),
  },
];
