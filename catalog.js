export const RARITIES = {
  common: { label: 'Common', mark: 'C', color: '#c3c8bf', copies: 5, price: 35 },
  uncommon: { label: 'Uncommon', mark: 'U', color: '#a5c6a4', copies: 4, price: 55 },
  rare: { label: 'Rare', mark: 'R', color: '#a2c5ec', copies: 3, price: 85 },
  superRare: { label: 'Super Rare', mark: 'SR', color: '#c8b5eb', copies: 2, price: 125 },
  ultraRare: { label: 'Ultra Rare', mark: 'UR', color: '#eba6c4', copies: 1, price: 175 },
  legendary: { label: 'Legendary', mark: 'L', color: '#e9c176', copies: 1, price: 245 },
  mythic: { label: 'Mythic', mark: 'M', color: '#f09681', copies: 1, price: 360 }
};

export const GAMES = [
  { title: 'Nite to Fort', genre: 'Tactical building', blurb: 'Gather scraps, raise a fort, and survive the storm with one plank to spare.', rarity: 'superRare' },
  { title: 'Mine Your Business', genre: 'Crafting sandbox', blurb: 'Run a tiny quarry, polish strange gems, and keep the neighbors out of your caves.', rarity: 'rare' },
  { title: 'Cart Heist', genre: 'Comic caper', blurb: 'A runaway shopping cart. One steep garage. Absolutely no receipt.', rarity: 'uncommon' },
  { title: 'Traffic Jam GP', genre: 'Tabletop racing', blurb: 'Race breakfast-table hairpins with a jar full of jam and a questionable engine.', rarity: 'common' },
  { title: 'Sofa League', genre: 'Couch sports', blurb: 'Dribble a giant ball across the rug. Try to keep the lamps intact.', rarity: 'rare' },
  { title: 'Attack of the Overdue', genre: 'Comedy horror', blurb: 'Escape a library that takes late returns personally.', rarity: 'uncommon' },
  { title: 'Signal at Aster Ridge', genre: 'Sci-fi mystery', blurb: 'Trace a fading transmission across an icebound moon.', rarity: 'ultraRare' },
  { title: 'Ember at Low Tide', genre: 'Fantasy adventure', blurb: 'Carry the last lantern along a volcanic coast before the tide returns.', rarity: 'superRare' },
  { title: 'Low Tide Archive', genre: 'Underwater exploration', blurb: 'Dive through a submerged archive and piece together the city’s history.', rarity: 'uncommon' },
  { title: 'The Brass Meridian', genre: 'Puzzle adventure', blurb: 'Rebuild a brass instrument that charts a missing line across the world.', rarity: 'rare' },
  { title: 'Juniper Post', genre: 'Cozy adventure', blurb: 'Deliver letters by bicycle and learn the rhythms of a forest village.', rarity: 'common' },
  { title: 'Blue Hour Circuit', genre: 'Night racing', blurb: 'Master wet corners and quiet mountain roads as daylight slips away.', rarity: 'rare' },
  { title: 'The Hollowglass Vault', genre: 'Dungeon puzzles', blurb: 'Find a route through a crystal vault that reshapes with every reflection.', rarity: 'mythic' },
  { title: 'Petals at Perihelion', genre: 'Botanical sci-fi', blurb: 'Care for a greenhouse ship as it passes close to a restless star.', rarity: 'uncommon' },
  { title: 'Dustline Station', genre: 'Rail adventure', blurb: 'Restore a desert rail stop and trace the route of its last train.', rarity: 'common' },
  { title: 'Ternwatch Harbor', genre: 'Coastal exploration', blurb: 'Take a small boat around headlands, tide pools, and a working lighthouse.', rarity: 'common' },
  { title: 'Call of the Kettle', genre: 'Kitchen tactics', blurb: 'Lead a squad of spatulas through breakfast before the kettle blows its top.', rarity: 'uncommon' },
  { title: 'Legend of the Lunchbox', genre: 'Fantasy comedy', blurb: 'Recover a fabled lunchbox said to keep sandwiches fresh for a thousand years.', rarity: 'legendary' },
  { title: 'Pigeonball United', genre: 'Arcade sports', blurb: 'Turn a flock of rooftop rivals into a team that can pass the ball.', rarity: 'common' },
  { title: 'Clog Runner', genre: 'Arcade platformer', blurb: 'Leap from canal bridge to canal bridge in the least aerodynamic shoes ever made.', rarity: 'common' },
  { title: 'Antenna Orchard', genre: 'Sci-fi strategy', blurb: 'Grow a network of listening stations among pear trees that hum after dark.', rarity: 'rare' },
  { title: 'Redwater Crossing', genre: 'Historical adventure', blurb: 'Ferry travelers across a river whose banks change with each season.', rarity: 'common' },
  { title: 'Unquiet Transit', genre: 'Suspense', blurb: 'Ride the last train and work out why one station keeps passing by.', rarity: 'uncommon' },
  { title: 'Lattice and Loom', genre: 'Textile puzzles', blurb: 'Weave broken patterns back together, one color and thread at a time.', rarity: 'common' },
  { title: 'Saltglass Republic', genre: 'City building', blurb: 'Guide a desert settlement built around a forest of living salt crystals.', rarity: 'ultraRare' },
  { title: 'Velvet Checkmate', genre: 'Chess tactics', blurb: 'Solve intricate endgames on boards carved from marble and velvet.', rarity: 'uncommon' },
  { title: 'Icebound Relay', genre: 'Winter racing', blurb: 'Trade the lead through glacier gates on a team of sled racers.', rarity: 'common' },
  { title: 'Before the Floodgate', genre: 'Narrative thriller', blurb: 'Read the valley’s warnings and decide when to open its aging floodgate.', rarity: 'rare' },
  { title: 'The Lantern Index', genre: 'Historical mystery', blurb: 'Follow a trail of handwritten records through a coastal archive.', rarity: 'uncommon' },
  { title: 'Once in Mothlight', genre: 'Atmospheric platformer', blurb: 'Guide a small moth through fern forests in search of the first dawn.', rarity: 'uncommon' },
  { title: 'Verdant Freight', genre: 'Rail management', blurb: 'Move cargo between highland villages by building a railway over steep valleys.', rarity: 'common' },
  { title: 'A Map for Comets', genre: 'Astronomy puzzles', blurb: 'Chart wandering comets and reconstruct a forgotten observatory’s star maps.', rarity: 'superRare' },
  { title: 'Goose Protocol', genre: 'Stealth comedy', blurb: 'Infiltrate a bank vault armed with impeccable timing and an ill-timed honk.', rarity: 'ultraRare' },
  { title: 'Definitely a Wizard', genre: 'Comedy adventure', blurb: 'Sort your enchanted laundry before the socks form an organized coven.', rarity: 'common' },
  { title: 'Breadshot Arena', genre: 'Party action', blurb: 'Launch toast across a toy arena and try to finish with the whole loaf.', rarity: 'common' },
  { title: 'Landlord of the Lake', genre: 'Cozy management', blurb: 'Build lily-pad cottages for tenants with very particular ideas about damp.', rarity: 'common' },
  { title: 'The Amberline Atlas', genre: 'Traversal fantasy', blurb: 'Sail a windship above the dunes and chart landmarks that move at night.', rarity: 'uncommon' },
  { title: 'Sable Frequency', genre: 'Rhythm', blurb: 'Layer vinyl loops and track the rhythm of a city after its lights go out.', rarity: 'uncommon' },
  { title: 'Rimegarden Keep', genre: 'Winter fantasy', blurb: 'Tend a frozen castle garden whose roots keep the old walls standing.', rarity: 'uncommon' },
  { title: 'Cinders Over Vale', genre: 'Tactical strategy', blurb: 'Hold a mountain fortress while ash cuts off the roads and supply lines.', rarity: 'common' },
  { title: 'Knots Underwater', genre: 'Marine engineering', blurb: 'Rig pulleys and guide delicate salvage from the floor of a cold sea.', rarity: 'rare' },
  { title: 'The Porcelain Hour', genre: 'Time-loop mystery', blurb: 'Examine one parlor over and over as a cracked teacup changes each hour.', rarity: 'superRare' },
  { title: 'Chalkline Derby', genre: 'Skateboarding', blurb: 'Link tricks across hand-drawn courses on concrete ramps and street corners.', rarity: 'common' },
  { title: 'Sunfield Courier', genre: 'Flight simulation', blurb: 'Deliver packages by ultralight across fields, rivers, and small grass airstrips.', rarity: 'common' },
  { title: 'Paper Lantern District', genre: 'Cozy city building', blurb: 'Restore rainy market streets and choose where to hang the first lanterns.', rarity: 'common' },
  { title: 'Quiet Orbit Foundry', genre: 'Industrial simulation', blurb: 'Build a working metal foundry aboard a station at the edge of orbit.', rarity: 'legendary' },
  { title: 'Marsh Echo Survey', genre: 'Ecological exploration', blurb: 'Cross boardwalks and record the life of a wetland from dawn to dusk.', rarity: 'common' },
  { title: 'Spiral of Cobalt', genre: 'Precision platformer', blurb: 'Climb an impossible staircase where every landing changes the next jump.', rarity: 'rare' }
];

export const LATEST_RELEASE = GAMES.length - 1;

export const atlasColumns = 4, atlasRows = 4;
export const coversPerAtlas = atlasColumns * atlasRows;
const cellWidth = 512, cellHeight = 352;
export const atlasWidth = atlasColumns * cellWidth;
export const atlasHeight = atlasRows * cellHeight;
const panels = {
  front: [6, 6, 216, 340],
  back: [230, 6, 216, 340],
  spine: [454, 6, 52, 340]
};

export function coverRegion(index, face = 'front') {
  const cell = index % coversPerAtlas;
  const [x, y, w, h] = panels[face];
  return {
    x: x + (cell % atlasColumns) * cellWidth,
    y: y + Math.floor(cell / atlasColumns) * cellHeight,
    w, h
  };
}

export function coverUV(index, face) {
  const { x, y, w, h } = coverRegion(index, face);
  const left = (x + 1) / atlasWidth, right = (x + w - 1) / atlasWidth;
  const top = 1 - (y + 1) / atlasHeight, bottom = 1 - (y + h - 1) / atlasHeight;
  return [[left, bottom], [right, bottom], [right, top], [left, top]];
}
