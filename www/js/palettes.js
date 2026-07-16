/* SandScape palettes — hand-tuned sets plus a generator that expands 2–3 team
   brand colors into a 5-band density ramp. Pure data + color math: no DOM. */

export const CLASSIC = [
  { name: "Canyon", liquid: ["#cbb9a4", "#b3a08a"],
    sand: ["#5e0f0f", "#a11c14", "#d4502b", "#e88a4e", "#f2d9b8"] },
  { name: "Ocean", liquid: ["#c9cfd4", "#aeb6bd"],
    sand: ["#0d1f4e", "#1b3f8f", "#2f6bd0", "#7fa8e8", "#f2f4f7"] },
  { name: "Gilt", liquid: ["#b9b2a4", "#9e9788"],
    sand: ["#0c0a08", "#3a2f1a", "#8a6a1f", "#d4a52f", "#f4e3b2"] },
  { name: "Orchid", liquid: ["#cfc3cd", "#b6a8b6"],
    sand: ["#3a0f3f", "#7a1f6e", "#c04a9a", "#e58ac2", "#f6dcec"] },
];

/* Authentic Exotic Sands variants (exoticsands.com) — real liquid tint,
   black-heavy → powder-white sand banding, per-variant fine glitter.
   Black sand is heaviest (settles to the bottom, never mixes with white);
   the color comes from the tinted liquid, exactly like the physical frames. */
export const EXOTIC = [
  { name: "Ocean Blue", glitter: "#bcd6ff", liquid: ["#1c4fa0", "#123a7e"],
    sand: ["#08090c", "#0e2b5e", "#215fb8", "#8fb8ea", "#f2f5fb"] },
  { name: "Summer Turquoise", glitter: "#9ff0da", liquid: ["#12a5b8", "#0b7c8f"],
    sand: ["#080b0b", "#0d4a44", "#149c72", "#7fd9c1", "#eff7f4"] },
  { name: "Sunset Orange", glitter: "#ffb27a", liquid: ["#d8641e", "#ab4711"],
    sand: ["#0b0908", "#5c2410", "#d86a2a", "#f0a690", "#f6ede2"] },
  { name: "Arctic Glacier", glitter: "#bcdcff", liquid: ["#dbe6ef", "#bccdda"],
    sand: ["#090a0c", "#2c333b", "#5a6773", "#a9b6c2", "#f4f7fa"] },
  { name: "Red Volcanic", glitter: "#ff7a6b", liquid: ["#e6dcd6", "#c7bcb4"],
    sand: ["#0a0909", "#2a2422", "#8f2b1e", "#bcaea6", "#f6f2ef"] },
];

/* [name, primary, secondary, (tertiary)] — standard team brand hexes */
export const TEAMS = {
NFL: [
["Cardinals", "#97233F", "#FFB612", "#000000"], ["Falcons", "#A71930", "#000000", "#A5ACAF"],
["Ravens", "#241773", "#9E7C0C", "#000000"], ["Bills", "#00338D", "#C60C30"],
["Panthers", "#0085CA", "#101820", "#BFC0BF"], ["Bears", "#0B162A", "#C83803"],
["Bengals", "#FB4F14", "#000000"], ["Browns", "#311D00", "#FF3C00"],
["Cowboys", "#003594", "#869397", "#FFFFFF"], ["Broncos", "#FB4F14", "#002244"],
["Lions", "#0076B6", "#B0B7BC"], ["Packers", "#203731", "#FFB612"],
["Texans", "#03202F", "#A71930"], ["Colts", "#002C5F", "#A2AAAD"],
["Jaguars", "#006778", "#D7A22A", "#101820"], ["Chiefs", "#E31837", "#FFB81C"],
["Raiders", "#000000", "#A5ACAF"], ["Chargers", "#0080C6", "#FFC20E"],
["Rams", "#003594", "#FFA300"], ["Dolphins", "#008E97", "#FC4C02"],
["Vikings", "#4F2683", "#FFC62F"], ["Patriots", "#002244", "#C60C30", "#B0B7BC"],
["Saints", "#D3BC8D", "#101820"], ["Giants", "#0B2265", "#A71930", "#A5ACAF"],
["Jets", "#125740", "#FFFFFF"], ["Eagles", "#004C54", "#A5ACAF", "#000000"],
["Steelers", "#FFB612", "#101820"], ["49ers", "#AA0000", "#B3995D"],
["Seahawks", "#002244", "#69BE28", "#A5ACAF"], ["Buccaneers", "#D50A0A", "#34302B", "#B1BABF"],
["Titans", "#0C2340", "#4B92DB", "#C8102E"], ["Commanders", "#5A1414", "#FFB612"],
],
NBA: [
["Hawks", "#E03A3E", "#C1D32F"], ["Celtics", "#007A33", "#BA9653", "#FFFFFF"],
["Nets", "#000000", "#FFFFFF", "#707271"], ["Hornets", "#1D1160", "#00788C"],
["Bulls", "#CE1141", "#000000"], ["Cavaliers", "#860038", "#FDBB30", "#041E42"],
["Mavericks", "#00538C", "#002B5E", "#B8C4CA"], ["Nuggets", "#0E2240", "#FEC524", "#8B2131"],
["Pistons", "#C8102E", "#1D42BA", "#BEC0C2"], ["Warriors", "#1D428A", "#FFC72C"],
["Rockets", "#CE1141", "#000000", "#C4CED4"], ["Pacers", "#002D62", "#FDBB30", "#BEC0C2"],
["Clippers", "#C8102E", "#1D428A", "#BEC0C2"], ["Lakers", "#552583", "#FDB927"],
["Grizzlies", "#5D76A9", "#12173F", "#F5B112"], ["Heat", "#98002E", "#F9A01B", "#000000"],
["Bucks", "#00471B", "#EEE1C6"], ["Timberwolves", "#0C2340", "#236192", "#78BE20"],
["Pelicans", "#0C2340", "#C8102E", "#85714D"], ["Knicks", "#006BB6", "#F58426", "#BEC0C2"],
["Thunder", "#007AC1", "#EF3B24", "#002D62"], ["Magic", "#0077C0", "#C4CED4", "#000000"],
["76ers", "#006BB6", "#ED174C", "#002B5C"], ["Suns", "#1D1160", "#E56020", "#63727A"],
["Trail Blazers", "#E03A3E", "#000000"], ["Kings", "#5A2D81", "#63727A", "#000000"],
["Spurs", "#C4CED4", "#000000"], ["Raptors", "#CE1141", "#000000", "#A1A1A4"],
["Jazz", "#002B5C", "#F9A01B", "#00471B"], ["Wizards", "#002B5C", "#E31837", "#C4CED4"],
],
MLB: [
["D-backs", "#A71930", "#E3D4AD", "#000000"], ["Braves", "#CE1141", "#13274F"],
["Orioles", "#DF4601", "#000000"], ["Red Sox", "#BD3039", "#0C2340"],
["Cubs", "#0E3386", "#CC3433"], ["White Sox", "#27251F", "#C4CED4"],
["Reds", "#C6011F", "#000000"], ["Guardians", "#E31937", "#0C2340"],
["Rockies", "#333366", "#C4CED4", "#000000"], ["Tigers", "#0C2340", "#FA4616"],
["Astros", "#002D62", "#EB6E1F"], ["Royals", "#004687", "#BD9B60"],
["Angels", "#BA0021", "#003263", "#C4CED4"], ["Dodgers", "#005A9C", "#EF3E42", "#A5ACAF"],
["Marlins", "#00A3E0", "#EF3340", "#000000"], ["Brewers", "#12284B", "#FFC52F"],
["Twins", "#002B5C", "#D31145", "#B9975B"], ["Mets", "#002D72", "#FF5910"],
["Yankees", "#0C2340", "#C4CED4"], ["Athletics", "#003831", "#EFB21E"],
["Phillies", "#E81828", "#002D72"], ["Pirates", "#FDB827", "#27251F"],
["Padres", "#2F241D", "#FFC425"], ["Giants", "#FD5A1E", "#27251F", "#EFD19F"],
["Mariners", "#0C2C56", "#005C5C", "#C4CED4"], ["Cardinals", "#C41E3A", "#0C2340", "#FEDB00"],
["Rays", "#092C5C", "#8FBCE6", "#F5D130"], ["Rangers", "#003278", "#C0111F"],
["Blue Jays", "#134A8E", "#1D2D5C", "#E8291C"], ["Nationals", "#AB0003", "#14225A"],
],
NHL: [
["Ducks", "#F47A38", "#B9975B", "#000000"], ["Bruins", "#FFB81C", "#000000"],
["Sabres", "#003087", "#FFB81C"], ["Flames", "#D2001C", "#FAAF19"],
["Hurricanes", "#CE1126", "#A4A9AD", "#000000"], ["Blackhawks", "#CF0A2C", "#000000", "#FF671B"],
["Avalanche", "#6F263D", "#236192", "#A2AAAD"], ["Blue Jackets", "#002654", "#CE1126", "#A4A9AD"],
["Stars", "#006847", "#8F8F8C", "#000000"], ["Red Wings", "#CE1126", "#FFFFFF"],
["Oilers", "#041E42", "#FF4C00"], ["Panthers", "#041E42", "#C8102E", "#B9975B"],
["Kings", "#111111", "#A2AAAD"], ["Wild", "#A6192E", "#154734", "#EAAA00"],
["Canadiens", "#AF1E2D", "#192168"], ["Predators", "#FFB81C", "#041E42"],
["Devils", "#CE1126", "#000000"], ["Islanders", "#00539B", "#F47D30"],
["Rangers", "#0038A8", "#CE1126"], ["Senators", "#000000", "#DA1A32", "#B79257"],
["Flyers", "#F74902", "#000000"], ["Penguins", "#000000", "#FCB514"],
["Sharks", "#006D75", "#EA7200", "#000000"], ["Blues", "#002F87", "#FCB514", "#041E42"],
["Lightning", "#002868", "#FFFFFF"], ["Maple Leafs", "#00205B", "#FFFFFF"],
["Canucks", "#00205B", "#00843D", "#97999B"], ["Golden Knights", "#B4975A", "#333F42", "#C8102E"],
["Capitals", "#C8102E", "#041E42", "#FFFFFF"], ["Jets", "#041E42", "#004C97", "#AC162C"],
["Kraken", "#001628", "#99D9D9", "#E9072B"], ["Mammoth", "#6CACE4", "#090909", "#FFFFFF"],
],
NCAA: [
["Alabama", "#9E1B32", "#828A8F", "#FFFFFF"], ["Auburn", "#0C2340", "#E87722"],
["Arkansas", "#9D2235", "#FFFFFF"], ["Florida", "#0021A5", "#FA4616"],
["Georgia", "#BA0C2F", "#000000"], ["Kentucky", "#0033A0", "#FFFFFF"],
["LSU", "#461D7C", "#FDD023"], ["Ole Miss", "#CE1126", "#14213D"],
["Miss State", "#660000", "#FFFFFF"], ["Missouri", "#F1B82D", "#000000"],
["Oklahoma", "#841617", "#FDF9D8"], ["S Carolina", "#73000A", "#000000"],
["Tennessee", "#FF8200", "#58595B", "#FFFFFF"], ["Texas", "#BF5700", "#FFFFFF"],
["Texas A&M", "#500000", "#FFFFFF"], ["Vanderbilt", "#000000", "#866D4B"],
["Ohio State", "#BB0000", "#666666"], ["Michigan", "#00274C", "#FFCB05"],
["Penn State", "#041E42", "#FFFFFF"], ["Notre Dame", "#0C2340", "#C99700", "#00843D"],
["Clemson", "#F56600", "#522D80"], ["FSU", "#782F40", "#CEB888"],
["Miami", "#F47321", "#005030", "#FFFFFF"], ["USC", "#990000", "#FFC72C"],
["Oregon", "#154733", "#FEE123"], ["Washington", "#4B2E83", "#B7A57A"],
["Wisconsin", "#C5050C", "#FFFFFF"], ["Nebraska", "#E41C38", "#FDF2D9"],
["Troy", "#8A2432", "#B5B7B9", "#000000"], ["UAB", "#1E6B52", "#F4C300"],
],
Soccer: [
["USA", "#B22234", "#3C3B6E", "#FFFFFF"], ["Mexico", "#006847", "#CE1126", "#FFFFFF"],
["Canada", "#D80621", "#FFFFFF"], ["Brazil", "#009C3B", "#FFDF00", "#002776"],
["Argentina", "#75AADB", "#FFFFFF", "#F6B40E"], ["France", "#0055A4", "#EF4135", "#FFFFFF"],
["England", "#CE1124", "#FFFFFF", "#00247D"], ["Germany", "#000000", "#DD0000", "#FFCE00"],
["Spain", "#AA151B", "#F1BF00"], ["Portugal", "#046A38", "#DA291C", "#FFD700"],
["Netherlands", "#FF6600", "#21468B", "#FFFFFF"], ["Italy", "#0066B2", "#CE2B37", "#FFFFFF"],
["Belgium", "#000000", "#FDDA24", "#EF3340"], ["Croatia", "#FF0000", "#171796", "#FFFFFF"],
["Japan", "#000555", "#B0313F", "#FFFFFF"], ["S Korea", "#CD2E3A", "#0047A0", "#FFFFFF"],
["Morocco", "#C1272D", "#006233"], ["Senegal", "#00853F", "#FDEF42", "#E31B23"],
["Ghana", "#CE1126", "#FCD116", "#006B3F"], ["Nigeria", "#008751", "#FFFFFF"],
["Uruguay", "#7BAFD4", "#000000", "#FFFFFF"], ["Colombia", "#FCD116", "#003893", "#CE1126"],
["Ecuador", "#FFDD00", "#034EA2", "#ED1C24"], ["Australia", "#FFCD00", "#00843D"],
["Saudi Arabia", "#006C35", "#FFFFFF"], ["Switzerland", "#DA291C", "#FFFFFF"],
["Denmark", "#C8102E", "#FFFFFF"], ["Sweden", "#006AA7", "#FECC02"],
["Poland", "#DC143C", "#FFFFFF"], ["Norway", "#BA0C2F", "#00205B", "#FFFFFF"],
],
};

export const GROUPS = ["Exotic", "Classic", "NFL", "NBA", "MLB", "NHL", "NCAA", "Soccer"];
export const DIRECT = { Classic: CLASSIC, Exotic: EXOTIC };   // groups with hand-tuned palettes

/* color math: expand 2–3 team colors into a 5-band density ramp */
const WHITE = [255, 255, 255], BLACK = [8, 8, 8], CREAM = [244, 238, 224];

export function hexToRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
export function mixc(a, b, f) {
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
export function lum(c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }

export function teamPalette(entry) {
  const cols = entry.slice(1).map(hexToRgb);
  const prim = cols[0];
  const sec = cols[1] || mixc(prim, WHITE, .5);
  const ter = cols[2] || mixc(prim, sec, .5);
  const lightest = [prim, sec, ter].reduce((a, b) => lum(b) > lum(a) ? b : a);
  const ramp = [
    mixc(prim, BLACK, .5),
    prim,
    ter,
    sec,
    mixc(mixc(lightest, CREAM, .55), WHITE, .15),
  ];
  ramp.sort((a, b) => lum(a) - lum(b));           // darkest = heaviest = bottom band
  for (let k = 1; k < 5; k++) {                    // enforce band separation
    if (lum(ramp[k]) - lum(ramp[k - 1]) < 14) ramp[k] = mixc(ramp[k], WHITE, .18);
  }
  const liq0 = mixc([203, 196, 182], lightest, .20);
  const liq1 = mixc(liq0, BLACK, .12);
  return { liquid: [rgbToHex(...liq0), rgbToHex(...liq1)],
           sand: ramp.map(c => rgbToHex(...c)) };
}

export function resolvePalette(group, i) {
  return DIRECT[group] ? DIRECT[group][i] : teamPalette(TEAMS[group][i]);
}

export function paletteName(group, i) {
  return DIRECT[group] ? DIRECT[group][i].name : TEAMS[group][i][0];
}

export function paletteCount(group) {
  return DIRECT[group] ? DIRECT[group].length : TEAMS[group].length;
}
