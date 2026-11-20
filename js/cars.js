// The lot: seven cars, in bay order. Prices are in US dollars; naira is shown at the dealer's rate.
export const RATE = 1540; // ₦ per $1, the rate on the lot's price board

export const CARS = [
  {
    id: 'g63', file: '2025_mercedes-benz_g-class_amg_g_63', credit: 'Ddiaz Design, CC BY-NC-SA 4.0', make: 'Mercedes-AMG', model: 'G 63', year: 2025, type: 'SUV', km: 450,
    paint: { name: 'Opalite White', hex: '#E6E3DC', metal: 0.55, rough: 0.28 },
    usd: 345000, hp: '585 hp', sprint: '4.3 s', top: '220 km/h', engine: '4.0 twin-turbo V8, mild hybrid',
    parts: {
      tyres: ['Tyres', 'Pirelli P Zero, 295/40 R22 all round. Fitted new at delivery, 450 km on them.'],
      wheels: ['Wheels', '22-inch AMG forged cross-spoke, gloss black. No kerb marks.'],
      brakes: ['Brakes', '400 mm front discs, six-piston AMG calipers in red.'],
      lights: ['Headlights', 'Multibeam LED with Ultra Range high beam, about 600 m of reach.'],
      taillights: ['Tail lights', 'Smoked LED clusters, the 2025 facelift pattern.'],
      glass: ['Glass', 'Acoustic laminated side glass, privacy tint on the rear.'],
      interior: ['Cabin', 'Black Nappa with red stitching, AMG Performance seats, Burmester 3D sound.'],
      paint: ['Paint', 'Opalite White, a pearl that turns warm under the bay lights.'],
      aero: ['Trim', 'Night Package II: black badges, black mirrors, dark-tinted lamps.'],
      grille: ['Grille', 'AMG Panamericana grille, vertical chrome slats.'],
    },
  },
  {
    id: 'gt3rs', file: '2019_porsche_911_991.2_gt3_rs', credit: 'Ddiaz Design, CC BY-NC-SA 4.0', make: 'Porsche', model: '911 GT3 RS', year: 2019, type: 'Supercar', km: 8700,
    paint: { name: 'Lizard Green', hex: '#6DBE45', metal: 0.2, rough: 0.32 },
    usd: 295000, hp: '520 PS', sprint: '3.2 s', top: '312 km/h', engine: '4.0 naturally aspirated flat-six',
    parts: {
      tyres: ['Tyres', 'Michelin Pilot Sport Cup 2, 265/35 ZR20 front and 325/30 ZR21 rear.'],
      wheels: ['Wheels', 'Forged magnesium centre-lock wheels from the Weissach Package.'],
      brakes: ['Brakes', 'Porsche Ceramic Composite Brakes, 410 mm front, yellow six-piston calipers.'],
      lights: ['Headlights', 'LED with Porsche Dynamic Light System Plus.'],
      taillights: ['Tail lights', 'Full-width LED light bar across the engine lid.'],
      glass: ['Glass', 'Lightweight polycarbonate rear and rear-side windows.'],
      interior: ['Cabin', 'Full bucket seats in Race-Tex, Clubsport roll cage, six-point harness ready.'],
      paint: ['Paint', 'Lizard Green, a Paint to Sample colour. Paint-protection film on the whole front.'],
      aero: ['Aero', 'Fixed carbon rear wing and NACA ducts in the bonnet. Weissach carbon roof.'],
      grille: ['Intakes', 'Wheel-arch louvres that vent pressure from the front arches.'],
    },
  },
  {
    id: '720s', file: '2019_mclaren_720s_spider', credit: 'Ddiaz Design, CC BY 4.0', make: 'McLaren', model: '720S Spider', year: 2019, type: 'Supercar', km: 11200,
    paint: { name: 'Aurora Blue', hex: '#2F6EA3', metal: 0.85, rough: 0.3 },
    usd: 310000, hp: '720 PS', sprint: '2.9 s', top: '341 km/h', engine: '4.0 twin-turbo V8',
    parts: {
      tyres: ['Tyres', 'Pirelli P Zero, 245/35 R19 front and 305/30 R20 rear. About 70% tread left.'],
      wheels: ['Wheels', '10-spoke Super-Lightweight forged wheels in stealth finish.'],
      brakes: ['Brakes', 'Carbon ceramic, 390 mm front and 380 mm rear. Calipers in McLaren orange.'],
      lights: ['Headlights', 'The "eye socket" LED headlights that hide the radiator intakes.'],
      taillights: ['Tail lights', 'Thin LED blades floating over the rear mesh.'],
      glass: ['Roof', 'Electrochromic glass hardtop. Opens or closes in 11 seconds, up to 50 km/h.'],
      interior: ['Cabin', 'Alcantara and Nappa, folding driver display for Track mode.'],
      paint: ['Paint', 'Aurora Blue metallic with a ceramic coating applied in Lagos.'],
      aero: ['Aero', 'Active rear airbrake that stands up under hard braking.'],
      grille: ['Intakes', 'Dihedral doors with built-in air channels feeding the radiators.'],
    },
  },
  {
    // the model ships with a magenta cabin; this is the car on the lot
    recolour: { rrghost_leatherblue: '#CDBDA4', rrghost_leatherlight: '#BBA88C', rrghost_leatherdark: '#3B2F27', rrghost_carpet1: '#2B2520', 'amdb11_caliper.002': '#2A2A2C' },
    id: 'ghost', file: 'rolls-royce_ghost', credit: 'Black Snow, CC BY 4.0', make: 'Rolls-Royce', model: 'Ghost', year: 2023, type: 'Luxury', km: 3900,
    paint: { name: 'Midnight Sapphire', hex: '#1C2747', metal: 0.9, rough: 0.22 },
    usd: 420000, hp: '571 PS', sprint: '4.8 s', top: '250 km/h', engine: '6.75 twin-turbo V12',
    parts: {
      tyres: ['Tyres', 'Pirelli P Zero with acoustic foam, 255/40 R21 front and 285/35 R21 rear.'],
      wheels: ['Wheels', '21-inch part-polished wheels. The RR centres stay upright as they turn.'],
      brakes: ['Brakes', '410 mm discs, tuned for silence over bite.'],
      lights: ['Headlights', 'Laser high beam, reaching about 600 m.'],
      taillights: ['Tail lights', 'Vertical LED clusters with a hidden coach line.'],
      glass: ['Glass', 'Double-glazed, laminated all round. The cabin reads about 30 dB at cruise.'],
      interior: ['Cabin', 'Starlight headliner, lambswool rugs, rear picnic tables in open-pore walnut.'],
      paint: ['Paint', 'Midnight Sapphire with a hand-painted Arctic White coachline.'],
      aero: ['Trim', 'Illuminated Pantheon grille and the Spirit of Ecstasy, which retracts at a touch.'],
      grille: ['Grille', 'The Pantheon grille, lit by 20 hidden LEDs.'],
    },
  },
  {
    id: 'sf90', file: '2020_ferrari_sf90_stradale', credit: 'Ddiaz Design, CC BY-NC-SA 4.0', make: 'Ferrari', model: 'SF90 Stradale', year: 2020, type: 'Supercar', km: 6400,
    paint: { name: 'Rosso Corsa', hex: '#B5121B', metal: 0.6, rough: 0.26 },
    usd: 540000, hp: '1,000 cv', sprint: '2.5 s', top: '340 km/h', engine: '4.0 twin-turbo V8 with three electric motors',
    parts: {
      tyres: ['Tyres', 'Michelin Pilot Sport 4S, 255/35 ZR20 front and 315/30 ZR20 rear.'],
      wheels: ['Wheels', '20-inch forged wheels with carbon-fibre inserts.'],
      brakes: ['Brakes', 'Carbon ceramic, 398 mm front and 360 mm rear, with brake-by-wire.'],
      lights: ['Headlights', 'Slim LED units with a C-shaped signature.'],
      taillights: ['Tail lights', 'Square LED tail lights, a first for a Ferrari V8.'],
      glass: ['Glass', 'Engine-bay glass shows the V8 sitting low behind you.'],
      interior: ['Cabin', 'A 16-inch curved driver display. Steering wheel with touch controls and the eManettino.'],
      paint: ['Paint', 'Rosso Corsa, the classic Ferrari red, over an Assetto Fiorano pack.'],
      aero: ['Aero', 'The shut-off Gurney flap at the rear raises downforce by up to 390 kg at 250 km/h.'],
      grille: ['Intakes', 'Vortex generators under the nose to manage front downforce.'],
    },
  },
  {
    id: 'revuelto', file: '2024_lamborghini_revuelto', credit: 'Ddiaz Design, CC BY-NC-SA 4.0', make: 'Lamborghini', model: 'Revuelto', year: 2024, type: 'Supercar', km: 1200,
    paint: { name: 'Arancio Apodis', hex: '#EA6413', metal: 0.7, rough: 0.24 },
    usd: 650000, hp: '1,015 CV', sprint: '2.5 s', top: '350 km/h', engine: '6.5 V12 with three electric motors',
    parts: {
      tyres: ['Tyres', 'Bridgestone Potenza Sport, 265/35 R20 front and 345/30 R21 rear.'],
      wheels: ['Wheels', '21-inch Dione forged wheels in matt titanium.'],
      brakes: ['Brakes', 'CCM-R Plus carbon ceramic, 410 mm front, ten-piston calipers.'],
      lights: ['Headlights', 'Y-shaped LED signature that frames the front intakes.'],
      taillights: ['Tail lights', 'Hexagonal LED clusters around the high-mounted exhaust.'],
      glass: ['Glass', 'Carbon roof with glass panels, so the V12 can be seen from outside.'],
      interior: ['Cabin', 'Three screens and a passenger display. Aircraft-style switch guards.'],
      paint: ['Paint', 'Arancio Apodis, launch-edition orange, with Glossy Carbon details.'],
      aero: ['Aero', 'Active rear wing with three positions, and carbon front splitter.'],
      grille: ['Intakes', 'Side intakes that feed the V12 and cool the battery.'],
    },
  },
  {
    id: 'chiron', file: '2022_bugatti_chiron_super_sport', credit: 'Ddiaz Design, CC BY-NC-SA 4.0', make: 'Bugatti', model: 'Chiron Super Sport', year: 2022, type: 'Hypercar', km: 900,
    paint: { name: 'Atlantic Blue', hex: '#1F4FB0', metal: 0.85, rough: 0.2 },
    usd: 3900000, hp: '1,600 PS', sprint: '2.4 s', top: '440 km/h', engine: '8.0 quad-turbo W16',
    parts: {
      tyres: ['Tyres', 'Michelin Pilot Sport Cup 2 R, 285/30 R20 front and 355/25 R21 rear, rated for 440 km/h.'],
      wheels: ['Wheels', 'Forged magnesium wheels, lighter than the standard Chiron set.'],
      brakes: ['Brakes', 'Carbon ceramic, 420 mm front with eight-piston titanium calipers.'],
      lights: ['Headlights', 'Four-eyed LED headlights, each unit milled from one block of aluminium.'],
      taillights: ['Tail lights', 'A single 1.6 m LED bar made of 82 light guides.'],
      glass: ['Glass', 'Curved windscreen tested for the top-speed run.'],
      interior: ['Cabin', 'Hand-stitched leather, a speedometer that reads to 500 km/h, one piece of exposed carbon.'],
      paint: ['Paint', 'Atlantic Blue over exposed blue carbon, the Super Sport livery.'],
      aero: ['Aero', 'Long tail, 25 cm longer than a Chiron, for stability above 400 km/h.'],
      grille: ['Grille', 'The horseshoe grille with the silver Bugatti macaron.'],
    },
  },
];

// How each part class appears when hovered and framed in a close-up.
export const PART_ORDER = ['tyres', 'wheels', 'brakes', 'lights', 'taillights', 'glass', 'interior', 'paint', 'aero', 'grille'];

// Sorts a mesh of the car model into a part class by its name and material.
export function partOf(mesh) {
  const n = (mesh.name + ' ' + (mesh.material && mesh.material.name || '')).toLowerCase();
  if (/tyre|tire/.test(n)) return 'tyres';
  if (/brake|caliper|disc/.test(n)) return 'brakes';
  if (/rim|wheel|centre|center|nuts|hub/.test(n)) return 'wheels';
  if (/lights_red|taillight|tail_light|rear_light/.test(n)) return 'taillights';
  // cabin first: "interior_light" is a trim colour, not a lamp
  if (/leather|interior|seat|carpet|steering|dash/.test(n)) return 'interior';
  if (/light|lamp|led|projector/.test(n)) return 'lights';
  if (/glass|window|windscreen/.test(n)) return 'glass';
  if (/carbon|wing|spoiler|diffuser|splitter/.test(n)) return 'aero';
  if (/grill|intake|vent/.test(n)) return 'grille';
  if (/body|paint/.test(n)) return 'paint';
  return null;
}

export const naira = usd => {
  const n = usd * RATE;
  return n >= 1e9 ? '₦' + (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B' : '₦' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
};
export const dollars = usd => '$' + usd.toLocaleString('en-US');
export const km = n => n.toLocaleString('en-US') + ' km';
