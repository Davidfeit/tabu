// נוצר אוטומטית מ-src/engine — אל תערוך.
// להרצה מחדש: npm run build:engine


// data/board.json
var board_default = {
  meta: {
    name: "\u05D8\u05D0\u05D1\u05D5",
    locale: "he-IL",
    currency: "ILS",
    startingCash: 1500,
    passStartBonus: 200,
    houseSupply: 32,
    hotelSupply: 12,
    mortgageRate: 0.5,
    unmortgageInterest: 0.1,
    jailFine: 50,
    maxJailTurns: 3,
    minPlayers: 2,
    maxPlayers: 6
  },
  groups: [
    { key: "sand", name: "\u05E7\u05E6\u05D4 \u05D4\u05DE\u05D3\u05D1\u05E8", color: "#8C6239", textOn: "#ffffff", icon: "dune", houseCost: 40, size: 2 },
    { key: "sky", name: "\u05E2\u05E8\u05D9 \u05D4\u05E4\u05D9\u05EA\u05D5\u05D7", color: "#7FC7E8", textOn: "#1a1a1a", icon: "wave", houseCost: 50, size: 3 },
    { key: "rose", name: "\u05E4\u05E8\u05D9\u05E4\u05E8\u05D9\u05D4 \u05E6\u05E4\u05D5\u05E0\u05D9\u05EA", color: "#D9639B", textOn: "#ffffff", icon: "peak", houseCost: 60, size: 3 },
    { key: "copper", name: "\u05D1\u05D9\u05E8\u05D5\u05EA \u05D0\u05D6\u05D5\u05E8\u05D9\u05D5\u05EA", color: "#E08A2E", textOn: "#1a1a1a", icon: "copper", houseCost: 75, size: 3 },
    { key: "crimson", name: "\u05E2\u05E8\u05D9 \u05D7\u05D5\u05E3 \u05D5\u05E1\u05E4\u05E8", color: "#D0342C", textOn: "#ffffff", icon: "anemone", houseCost: 90, size: 3 },
    { key: "olive", name: "\u05D4\u05DE\u05D8\u05E8\u05D5\u05E4\u05D5\u05DC\u05D9\u05DF \u05D4\u05DE\u05EA\u05E8\u05D7\u05D1", color: "#C9B037", textOn: "#1a1a1a", icon: "olive", houseCost: 110, size: 3 },
    { key: "green", name: "\u05D8\u05D1\u05E2\u05EA \u05D4\u05E9\u05E8\u05D5\u05DF \u05D5\u05D2\u05D5\u05E9 \u05D3\u05DF", color: "#2E8B57", textOn: "#ffffff", icon: "cypress", houseCost: 130, size: 3 },
    { key: "azure", name: "\u05D4\u05E6\u05DE\u05E8\u05EA", color: "#1F4E9C", textOn: "#ffffff", icon: "anchor", houseCost: 160, size: 2 }
  ],
  board: [
    { pos: 0, type: "corner", key: "start", name: "\u05D6\u05D9\u05E0\u05D5\u05E7", subtitle: "\u05E2\u05D1\u05E8\u05EA \u05D1\u05D6\u05D9\u05E0\u05D5\u05E7? \u05E7\u05D1\u05DC \u20AA200" },
    { pos: 1, type: "property", group: "sand", name: "\u05D9\u05E8\u05D5\u05D7\u05DD", region: "\u05E0\u05D2\u05D1", price: 60, rent: [2, 10, 30, 90, 160, 250], mortgage: 30 },
    { pos: 2, type: "card", deck: "kupat_gemel", name: "\u05E7\u05D5\u05E4\u05EA \u05D2\u05DE\u05DC" },
    { pos: 3, type: "property", group: "sand", name: "\u05DE\u05E6\u05E4\u05D4 \u05E8\u05DE\u05D5\u05DF", region: "\u05E0\u05D2\u05D1", price: 80, rent: [3, 15, 45, 140, 240, 380], mortgage: 40 },
    { pos: 4, type: "tax", name: "\u05DE\u05E1 \u05D4\u05DB\u05E0\u05E1\u05D4", amount: 200 },
    { pos: 5, type: "transport", name: "\u05EA\u05D7\u05E0\u05EA \u05D4\u05E8\u05DB\u05D1\u05EA \u05D4\u05DE\u05E8\u05DB\u05D6\u05D9\u05EA", price: 180, rent: [20, 40, 80, 160], mortgage: 90 },
    { pos: 6, type: "property", group: "sky", name: "\u05D3\u05D9\u05DE\u05D5\u05E0\u05D4", region: "\u05E0\u05D2\u05D1", price: 90, rent: [5, 25, 75, 220, 350, 480], mortgage: 45 },
    { pos: 7, type: "card", deck: "yad_hagoral", name: "\u05D9\u05D3 \u05D4\u05D2\u05D5\u05E8\u05DC" },
    { pos: 8, type: "property", group: "sky", name: "\u05D0\u05D5\u05E4\u05E7\u05D9\u05DD", region: "\u05E0\u05D2\u05D1 \u05DE\u05E2\u05E8\u05D1\u05D9", price: 100, rent: [6, 30, 90, 270, 420, 570], mortgage: 50 },
    { pos: 9, type: "property", group: "sky", name: "\u05E0\u05EA\u05D9\u05D1\u05D5\u05EA", region: "\u05E0\u05D2\u05D1 \u05DE\u05E2\u05E8\u05D1\u05D9", price: 120, rent: [7, 35, 100, 320, 490, 675], mortgage: 60 },
    { pos: 10, type: "corner", key: "jail", name: "\u05DE\u05E2\u05E6\u05E8 \u05D1\u05D9\u05EA", subtitle: "\u05D0\u05D5\u05E8\u05D7 \u05D1\u05DC\u05D1\u05D3" },
    { pos: 11, type: "property", group: "rose", name: "\u05E7\u05E8\u05D9\u05EA \u05E9\u05DE\u05D5\u05E0\u05D4", region: "\u05D2\u05DC\u05D9\u05DC \u05E2\u05DC\u05D9\u05D5\u05DF", price: 130, rent: [8, 40, 120, 320, 480, 650], mortgage: 65 },
    { pos: 12, type: "utility", name: "\u05EA\u05D7\u05E0\u05EA \u05D4\u05DB\u05D5\u05D7", price: 140, multipliers: [5, 12], mortgage: 70 },
    { pos: 13, type: "property", group: "rose", name: "\u05D1\u05D9\u05EA \u05E9\u05D0\u05DF", region: "\u05E2\u05DE\u05E7\u05D9\u05DD", price: 140, rent: [9, 45, 140, 360, 540, 725], mortgage: 70 },
    { pos: 14, type: "property", group: "rose", name: "\u05D8\u05D1\u05E8\u05D9\u05D4", region: "\u05DB\u05E0\u05E8\u05EA", price: 150, rent: [10, 50, 150, 400, 600, 800], mortgage: 75 },
    { pos: 15, type: "transport", name: "\u05E0\u05DE\u05DC \u05D4\u05EA\u05E2\u05D5\u05E4\u05D4 \u05D4\u05D1\u05D9\u05E0\u05DC\u05D0\u05D5\u05DE\u05D9", price: 180, rent: [20, 40, 80, 160], mortgage: 90 },
    { pos: 16, type: "property", group: "copper", name: "\u05DE\u05D2\u05D3\u05DC \u05D4\u05E2\u05DE\u05E7", region: "\u05E2\u05DE\u05E7 \u05D9\u05D6\u05E8\u05E2\u05D0\u05DC", price: 160, rent: [11, 55, 150, 420, 590, 775], mortgage: 80 },
    { pos: 17, type: "card", deck: "kupat_gemel", name: "\u05E7\u05D5\u05E4\u05EA \u05D2\u05DE\u05DC" },
    { pos: 18, type: "property", group: "copper", name: "\u05D1\u05D0\u05E8 \u05E9\u05D1\u05E2", region: "\u05D1\u05D9\u05E8\u05EA \u05D4\u05E0\u05D2\u05D1", price: 180, rent: [13, 65, 180, 490, 700, 900], mortgage: 90 },
    { pos: 19, type: "property", group: "copper", name: "\u05E2\u05E4\u05D5\u05DC\u05D4", region: "\u05E2\u05DE\u05E7 \u05D9\u05D6\u05E8\u05E2\u05D0\u05DC", price: 190, rent: [14, 70, 200, 530, 760, 1e3], mortgage: 95 },
    { pos: 20, type: "corner", key: "rest", name: "\u05D7\u05D5\u05E4\u05E9\u05D4 \u05D1\u05D0\u05D9\u05DC\u05EA", subtitle: "\u05D0\u05D9\u05DF \u05EA\u05E9\u05DC\u05D5\u05DD, \u05D0\u05D9\u05DF \u05D2\u05D1\u05D9\u05D9\u05D4" },
    { pos: 21, type: "property", group: "crimson", name: "\u05E0\u05D4\u05E8\u05D9\u05D4", region: "\u05D2\u05DC\u05D9\u05DC \u05DE\u05E2\u05E8\u05D1\u05D9", price: 200, rent: [15, 75, 210, 540, 750, 950], mortgage: 100 },
    { pos: 22, type: "card", deck: "yad_hagoral", name: "\u05D9\u05D3 \u05D4\u05D2\u05D5\u05E8\u05DC" },
    { pos: 23, type: "property", group: "crimson", name: "\u05D0\u05E9\u05E7\u05DC\u05D5\u05DF", region: "\u05D7\u05D5\u05E3 \u05D3\u05E8\u05D5\u05DE\u05D9", price: 210, rent: [16, 80, 220, 580, 800, 1e3], mortgage: 105 },
    { pos: 24, type: "property", group: "crimson", name: "\u05D7\u05D9\u05E4\u05D4", region: "\u05DE\u05E4\u05E8\u05E5 \u05D7\u05D9\u05E4\u05D4", price: 230, rent: [18, 90, 250, 650, 900, 1125], mortgage: 115 },
    { pos: 25, type: "transport", name: "\u05E0\u05DE\u05DC \u05D4\u05D9\u05DD", price: 180, rent: [20, 40, 80, 160], mortgage: 90 },
    { pos: 26, type: "property", group: "olive", name: "\u05D0\u05E9\u05D3\u05D5\u05D3", region: "\u05D7\u05D5\u05E3 \u05D3\u05E8\u05D5\u05DE\u05D9", price: 240, rent: [20, 100, 280, 675, 925, 1150], mortgage: 120 },
    { pos: 27, type: "property", group: "olive", name: "\u05E8\u05D0\u05E9\u05D5\u05DF \u05DC\u05E6\u05D9\u05D5\u05DF", region: "\u05D2\u05D5\u05E9 \u05D3\u05DF", price: 260, rent: [21, 100, 290, 725, 975, 1200], mortgage: 130 },
    { pos: 28, type: "utility", name: "\u05DE\u05EA\u05E7\u05DF \u05D4\u05D4\u05EA\u05E4\u05DC\u05D4", price: 140, multipliers: [5, 12], mortgage: 70 },
    { pos: 29, type: "property", group: "olive", name: "\u05E4\u05EA\u05D7 \u05EA\u05E7\u05D5\u05D5\u05D4", region: "\u05D2\u05D5\u05E9 \u05D3\u05DF", price: 280, rent: [23, 120, 320, 775, 1050, 1300], mortgage: 140 },
    { pos: 30, type: "corner", key: "goto_jail", name: "\u05D4\u05D5\u05E6\u05D0\u05D4 \u05DC\u05E4\u05D5\u05E2\u05DC", subtitle: "\u05E2\u05D1\u05D5\u05E8 \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05DC\u05DE\u05E2\u05E6\u05E8 \u05D1\u05D9\u05EA" },
    { pos: 31, type: "property", group: "green", name: "\u05E0\u05EA\u05E0\u05D9\u05D4", region: "\u05E9\u05E8\u05D5\u05DF", price: 300, rent: [26, 130, 360, 850, 1125, 1350], mortgage: 150 },
    { pos: 32, type: "property", group: "green", name: "\u05DB\u05E4\u05E8 \u05E1\u05D1\u05D0", region: "\u05E9\u05E8\u05D5\u05DF", price: 320, rent: [28, 140, 390, 925, 1200, 1450], mortgage: 160 },
    { pos: 33, type: "card", deck: "kupat_gemel", name: "\u05E7\u05D5\u05E4\u05EA \u05D2\u05DE\u05DC" },
    { pos: 34, type: "property", group: "green", name: "\u05E8\u05DE\u05EA \u05D2\u05DF", region: "\u05D2\u05D5\u05E9 \u05D3\u05DF", price: 340, rent: [30, 150, 420, 1e3, 1300, 1550], mortgage: 170 },
    { pos: 35, type: "transport", name: "\u05D4\u05E8\u05DB\u05D1\u05EA \u05D4\u05E7\u05DC\u05D4", price: 180, rent: [20, 40, 80, 160], mortgage: 90 },
    { pos: 36, type: "card", deck: "yad_hagoral", name: "\u05D9\u05D3 \u05D4\u05D2\u05D5\u05E8\u05DC" },
    { pos: 37, type: "property", group: "azure", name: "\u05D9\u05E8\u05D5\u05E9\u05DC\u05D9\u05DD", region: "\u05D9\u05E8\u05D5\u05E9\u05DC\u05D9\u05DD", price: 360, rent: [38, 190, 530, 1225, 1525, 1775], mortgage: 180 },
    { pos: 38, type: "tax", name: "\u05DE\u05E1 \u05E8\u05DB\u05D9\u05E9\u05D4", amount: 100 },
    { pos: 39, type: "property", group: "azure", name: "\u05EA\u05DC \u05D0\u05D1\u05D9\u05D1-\u05D9\u05E4\u05D5", region: "\u05D2\u05D5\u05E9 \u05D3\u05DF", price: 420, rent: [44, 220, 625, 1400, 1750, 2075], mortgage: 210 }
  ],
  realismVariant: {
    note: "\u05D4\u05E8\u05E6\u05DC\u05D9\u05D4 \u05D9\u05E7\u05E8\u05D4 \u05D1\u05E4\u05D5\u05E2\u05DC \u05DE\u05D9\u05E8\u05D5\u05E9\u05DC\u05D9\u05DD. \u05DE\u05EA\u05D2 \u05D0\u05D5\u05E4\u05E6\u05D9\u05D5\u05E0\u05DC\u05D9 \u05E9\u05DE\u05D7\u05DC\u05D9\u05E3 \u05D0\u05EA \u05DE\u05E9\u05D1\u05E6\u05EA 37.",
    "37": { name: "\u05D4\u05E8\u05E6\u05DC\u05D9\u05D4", region: "\u05E9\u05E8\u05D5\u05DF" }
  },
  decks: {
    kupat_gemel: [
      { id: "kg01", text: "\u05E7\u05D9\u05D1\u05DC\u05EA \u05D4\u05D7\u05D6\u05E8 \u05DE\u05E1 \u05DE\u05DE\u05E1 \u05D4\u05DB\u05E0\u05E1\u05D4.", effect: { type: "cash", amount: 200 } },
      { id: "kg02", text: "\u05DE\u05E2\u05E0\u05E7 \u05DC\u05D9\u05D3\u05D4 \u05DE\u05D4\u05D1\u05D9\u05D8\u05D5\u05D7 \u05D4\u05DC\u05D0\u05D5\u05DE\u05D9.", effect: { type: "cash", amount: 50 } },
      { id: "kg03", text: "\u05D3\u05DE\u05D9 \u05E0\u05D9\u05D4\u05D5\u05DC \u05E9\u05E0\u05EA\u05D9\u05D9\u05DD \u05D1\u05E7\u05D5\u05E4\u05EA \u05D4\u05D2\u05DE\u05DC.", effect: { type: "cash", amount: -50 } },
      { id: "kg04", text: "\u05E4\u05D3\u05D9\u05D5\u05DF \u05E7\u05E8\u05DF \u05D4\u05E9\u05EA\u05DC\u05DE\u05D5\u05EA \u05D0\u05D7\u05E8\u05D9 \u05E9\u05E9 \u05E9\u05E0\u05D9\u05DD.", effect: { type: "cash", amount: 150 } },
      { id: "kg05", text: "\u05EA\u05E8\u05DE\u05EA \u05DC\u05E7\u05DE\u05D7\u05D0 \u05D3\u05E4\u05E1\u05D7\u05D0 \u05D1\u05E9\u05DB\u05D5\u05E0\u05D4.", effect: { type: "cash", amount: -50 } },
      { id: "kg06", text: "\u05D6\u05DB\u05D9\u05EA \u05D1\u05D4\u05D2\u05E8\u05DC\u05EA \u05D5\u05E2\u05D3 \u05D4\u05E9\u05DB\u05D5\u05E0\u05D4.", effect: { type: "cash", amount: 100 } },
      { id: "kg07", text: "\u05D7\u05EA\u05D5\u05E0\u05D4 \u05D1\u05DE\u05D5\u05E9\u05D1 \u2014 \u05DB\u05DC \u05E9\u05D7\u05E7\u05DF \u05E0\u05D5\u05EA\u05DF \u05DC\u05DA \u05DE\u05EA\u05E0\u05D4.", effect: { type: "collect_from_each", amount: 50 } },
      { id: "kg08", text: "\u05D7\u05D6\u05E8\u05EA \u05DE\u05DE\u05D9\u05DC\u05D5\u05D0\u05D9\u05DD \u2014 \u05E7\u05D9\u05D1\u05DC\u05EA \u05DE\u05E2\u05E0\u05E7.", effect: { type: "cash", amount: 75 } },
      { id: "kg09", text: "\u05D2\u05DE\u05DC\u05EA \u05E1\u05D9\u05E2\u05D5\u05D3 \u05DC\u05D4\u05D5\u05E8\u05D4 \u2014 \u05D4\u05E9\u05DC\u05DE\u05D4 \u05DE\u05D4\u05DB\u05D9\u05E1.", effect: { type: "cash", amount: -75 } },
      { id: "kg10", text: "\u05D3\u05DE\u05D9 \u05D4\u05D1\u05E8\u05D0\u05D4 \u05E9\u05E0\u05EA\u05D9\u05D9\u05DD.", effect: { type: "cash", amount: 40 } },
      { id: "kg11", text: "\u05D5\u05E2\u05D3 \u05D4\u05D1\u05D9\u05EA \u05DE\u05D7\u05D9\u05D9\u05D1 \u05D1\u05EA\u05D9\u05E7\u05D5\u05DF \u05EA\u05E9\u05EA\u05D9\u05D5\u05EA.", effect: { type: "per_building", perHouse: -25, perHotel: -100 } },
      { id: "kg12", text: "\u05D8\u05E2\u05D5\u05EA \u05D1\u05D7\u05D9\u05E9\u05D5\u05D1 \u05D4\u05D0\u05E8\u05E0\u05D5\u05E0\u05D4 \u2014 \u05DC\u05D8\u05D5\u05D1\u05EA\u05DA.", effect: { type: "cash", amount: 60 } },
      { id: "kg13", text: "\u05D4\u05D2\u05E2\u05EA \u05DC\u05D2\u05D9\u05DC \u05E4\u05E8\u05D9\u05E9\u05D4 \u2014 \u05E7\u05E6\u05D1\u05D4 \u05E8\u05D0\u05E9\u05D5\u05E0\u05D4.", effect: { type: "cash", amount: 100 } },
      { id: "kg14", text: "\u05D0\u05D9\u05D7\u05D5\u05E8 \u05D1\u05D4\u05D2\u05E9\u05EA \u05D4\u05D3\u05D5\u05D7 \u05D4\u05E9\u05E0\u05EA\u05D9.", effect: { type: "cash", amount: -80 } },
      { id: "kg15", text: "\u05DB\u05E8\u05D8\u05D9\u05E1 \u05D9\u05E6\u05D9\u05D0\u05D4 \u05DE\u05DE\u05E2\u05E6\u05E8 \u05D1\u05D9\u05EA \u2014 \u05E9\u05DE\u05D5\u05E8 \u05E2\u05D3 \u05DC\u05E9\u05D9\u05DE\u05D5\u05E9 \u05D0\u05D5 \u05DE\u05DB\u05D5\u05E8.", effect: { type: "keep_out_of_jail" } },
      { id: "kg16", text: "\u05D7\u05D6\u05E8\u05D4 \u05DC\u05D6\u05D9\u05E0\u05D5\u05E7.", effect: { type: "move_to", pos: 0, collectStart: true } }
    ],
    yad_hagoral: [
      { id: "yg01", text: "\u05E1\u05E2 \u05DC\u05EA\u05DC \u05D0\u05D1\u05D9\u05D1-\u05D9\u05E4\u05D5. \u05D0\u05DD \u05E2\u05D1\u05E8\u05EA \u05D1\u05D6\u05D9\u05E0\u05D5\u05E7 \u2014 \u05E7\u05D1\u05DC \u20AA200.", effect: { type: "move_to", pos: 39, collectStart: true } },
      { id: "yg02", text: "\u05E1\u05E2 \u05DC\u05D9\u05E8\u05D5\u05E9\u05DC\u05D9\u05DD. \u05D0\u05DD \u05E2\u05D1\u05E8\u05EA \u05D1\u05D6\u05D9\u05E0\u05D5\u05E7 \u2014 \u05E7\u05D1\u05DC \u20AA200.", effect: { type: "move_to", pos: 37, collectStart: true } },
      { id: "yg03", text: "\u05E1\u05E2 \u05DC\u05D1\u05D0\u05E8 \u05E9\u05D1\u05E2. \u05D0\u05DD \u05E2\u05D1\u05E8\u05EA \u05D1\u05D6\u05D9\u05E0\u05D5\u05E7 \u2014 \u05E7\u05D1\u05DC \u20AA200.", effect: { type: "move_to", pos: 18, collectStart: true } },
      { id: "yg04", text: "\u05D7\u05D6\u05D5\u05E8 \u05E9\u05DC\u05D5\u05E9 \u05DE\u05E9\u05D1\u05E6\u05D5\u05EA \u05D0\u05D7\u05D5\u05E8\u05D4.", effect: { type: "move_relative", delta: -3 } },
      { id: "yg05", text: "\u05E2\u05D1\u05D5\u05E8 \u05DC\u05D6\u05D9\u05E0\u05D5\u05E7.", effect: { type: "move_to", pos: 0, collectStart: true } },
      { id: "yg06", text: "\u05E1\u05E2 \u05DC\u05E6\u05D5\u05DE\u05EA \u05D4\u05EA\u05D7\u05D1\u05D5\u05E8\u05D4 \u05D4\u05E7\u05E8\u05D5\u05D1 \u05D5\u05E9\u05DC\u05DD \u05DC\u05D1\u05E2\u05DC\u05D9\u05D5 \u05D3\u05DE\u05D9 \u05DE\u05E2\u05D1\u05E8 \u05DB\u05E4\u05D5\u05DC\u05D9\u05DD.", effect: { type: "nearest_transport", rentMultiplier: 2 } },
      { id: "yg07", text: "\u05EA\u05E7\u05DC\u05D4 \u05D1\u05EA\u05E9\u05EA\u05D9\u05EA \u2014 \u05E1\u05E2 \u05DC\u05EA\u05E9\u05EA\u05D9\u05EA \u05D4\u05E7\u05E8\u05D5\u05D1\u05D4. \u05D0\u05DD \u05D1\u05D1\u05E2\u05DC\u05D5\u05EA \u05E9\u05D7\u05E7\u05DF, \u05E9\u05DC\u05DD \u05E4\u05D9 12 \u05DE\u05E1\u05DB\u05D5\u05DD \u05D4\u05E7\u05D5\u05D1\u05D9\u05D5\u05EA.", effect: { type: "nearest_utility", forceMultiplier: 12 } },
      { id: "yg08", text: "\u05E7\u05E0\u05E1 \u05D7\u05E0\u05D9\u05D4 \u05D1\u05E8\u05D7\u05D5\u05D1 \u05D3\u05D9\u05D6\u05E0\u05D2\u05D5\u05E3.", effect: { type: "cash", amount: -50 } },
      { id: "yg09", text: "\u05D3\u05D5\u05D7 \u05DE\u05D4\u05D9\u05E8\u05D5\u05EA \u05D1\u05DB\u05D1\u05D9\u05E9 6.", effect: { type: "cash", amount: -75 } },
      { id: "yg10", text: "\u05E4\u05E7\u05E7 \u05E2\u05E0\u05E7 \u05D1\u05DB\u05D1\u05D9\u05E9 1 \u2014 \u05D4\u05E4\u05E1\u05D3\u05EA \u05EA\u05D5\u05E8.", effect: { type: "skip_next_turn" } },
      { id: "yg11", text: "\u05D0\u05D5\u05E9\u05E8\u05D4 \u05EA\u05D5\u05DB\u05E0\u05D9\u05EA \u05EA\u05DE\u05F4\u05D0 38 \u05D1\u05D1\u05E0\u05D9\u05D9\u05DF \u05E9\u05DC\u05DA.", effect: { type: "cash", amount: 150 } },
      { id: "yg12", text: "\u05D4\u05D5\u05D5\u05E2\u05D3\u05D4 \u05D4\u05DE\u05E7\u05D5\u05DE\u05D9\u05EA \u05D3\u05D5\u05E8\u05E9\u05EA \u05E9\u05D9\u05E4\u05D5\u05E5.", effect: { type: "per_building", perHouse: -40, perHotel: -150 } },
      { id: "yg13", text: "\u05D3\u05D5\u05D3 \u05D4\u05E9\u05DE\u05E9 \u05D4\u05EA\u05E4\u05D5\u05E6\u05E5 \u05D1\u05D2\u05D2.", effect: { type: "cash", amount: -25 } },
      { id: "yg14", text: "\u05D4\u05E0\u05D7\u05D4 \u05D1\u05D0\u05E8\u05E0\u05D5\u05E0\u05D4 \u05DC\u05EA\u05D5\u05E9\u05D1 \u05D7\u05D5\u05D6\u05E8.", effect: { type: "cash", amount: 80 } },
      { id: "yg15", text: "\u05E6\u05D5 \u05E2\u05D9\u05E7\u05D5\u05DC \u2014 \u05E2\u05D1\u05D5\u05E8 \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05DC\u05DE\u05E2\u05E6\u05E8 \u05D1\u05D9\u05EA. \u05D0\u05DC \u05EA\u05E2\u05D1\u05D5\u05E8 \u05D1\u05D6\u05D9\u05E0\u05D5\u05E7, \u05D0\u05DC \u05EA\u05E7\u05D1\u05DC \u20AA200.", effect: { type: "goto_jail" } },
      { id: "yg16", text: "\u05DB\u05E8\u05D8\u05D9\u05E1 \u05D9\u05E6\u05D9\u05D0\u05D4 \u05DE\u05DE\u05E2\u05E6\u05E8 \u05D1\u05D9\u05EA \u2014 \u05E9\u05DE\u05D5\u05E8 \u05E2\u05D3 \u05DC\u05E9\u05D9\u05DE\u05D5\u05E9 \u05D0\u05D5 \u05DE\u05DB\u05D5\u05E8.", effect: { type: "keep_out_of_jail" } }
    ]
  },
  tokens: [
    { key: "camel", name: "\u05D2\u05DE\u05DC" },
    { key: "scooter", name: "\u05D0\u05D5\u05E4\u05E0\u05D5\u05E2 \u05E9\u05DC\u05D9\u05D7\u05D5\u05D9\u05D5\u05EA" },
    { key: "tank", name: "\u05DE\u05D9\u05DB\u05DC \u05DE\u05D9\u05DD" },
    { key: "pack", name: "\u05EA\u05E8\u05DE\u05D9\u05DC" },
    { key: "boat", name: "\u05E1\u05D9\u05E8\u05EA \u05D3\u05D9\u05D2" },
    { key: "tractor", name: "\u05D8\u05E8\u05E7\u05D8\u05D5\u05E8" },
    { key: "jerrican", name: "\u05D2\u05F3\u05E8\u05D9\u05E7\u05DF" },
    { key: "hat", name: "\u05DB\u05D5\u05D1\u05E2 \u05D8\u05DE\u05D1\u05DC" }
  ],
  modes: {
    full: { name: "\u05DE\u05E9\u05D7\u05E7 \u05DE\u05DC\u05D0", auctions: true, hotelThreshold: 4, turnSeconds: 60, hardLimitMinutes: null },
    quick: { name: "\u05DE\u05D4\u05D9\u05E8", auctions: false, hotelThreshold: 3, turnSeconds: 30, hardLimitMinutes: 60, startingCash: 1200, passStartBonus: 250, dealtProperties: 2, rentSurgeAfterMinutes: 45, rentSurgeMultiplier: 1.5 },
    blitz: { name: "\u05D1\u05D6\u05E7", auctions: false, hotelThreshold: 2, turnSeconds: 20, hardLimitMinutes: 30, startingCash: 1200, passStartBonus: 300, dealtProperties: 3, rentSurgeAfterMinutes: 20, rentSurgeMultiplier: 1.5 }
  }
};

// src/lib/board.ts
var BOARD = board_default;
var SQUARES = BOARD.board;
var GROUPS = BOARD.groups;
var groupIndex = new Map(GROUPS.map((g) => [g.key, g]));
function group(key) {
  const g = groupIndex.get(key);
  if (!g) throw new Error(`\u05E7\u05D1\u05D5\u05E6\u05EA \u05E6\u05D1\u05E2 \u05DC\u05D0 \u05DE\u05D5\u05DB\u05E8\u05EA: ${key}`);
  return g;
}
function squareAt(pos) {
  const sq = SQUARES[pos];
  if (!sq) throw new Error(`\u05D0\u05D9\u05DF \u05DE\u05E9\u05D1\u05E6\u05EA \u05D1\u05DE\u05D9\u05E7\u05D5\u05DD ${pos}`);
  return sq;
}

// src/lib/types.ts
function isDeed(sq) {
  return sq.type === "property" || sq.type === "transport" || sq.type === "utility";
}

// src/engine/rng.ts
function hash32(seed, counter) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= counter;
  h = Math.imul(h, 16777619) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 625341585) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 1058868001) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}
function byteAt(seed, seq, draw) {
  return hash32(seed, seq * 65536 + draw) & 255;
}
function rollDie(seed, seq, draw) {
  for (let attempt = 0; attempt < 64; attempt++) {
    const b = byteAt(seed, seq, draw * 64 + attempt);
    if (b < 252) return b % 6 + 1;
  }
  return byteAt(seed, seq, draw * 64 + 63) % 6 + 1;
}
function rollDice(seed, seq) {
  return [rollDie(seed, seq, 0), rollDie(seed, seq, 1)];
}
function shuffle(items, seed, stream) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const bound = i + 1;
    const limit = Math.floor(256 / bound) * bound;
    let j = 0;
    for (let attempt = 0; attempt < 64; attempt++) {
      const b = byteAt(seed, stream, i * 64 + attempt);
      if (b < limit) {
        j = b % bound;
        break;
      }
    }
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// src/engine/setup.ts
var MODE_DEFAULTS = {
  full: {
    auctions: true,
    hotelThreshold: 4,
    turnSeconds: 60,
    hardLimitMinutes: null,
    rentSurgeAfterMinutes: null
  },
  quick: {
    auctions: false,
    hotelThreshold: 3,
    turnSeconds: 30,
    hardLimitMinutes: 60,
    rentSurgeAfterMinutes: 45
  },
  blitz: {
    auctions: false,
    hotelThreshold: 2,
    turnSeconds: 20,
    hardLimitMinutes: 30,
    rentSurgeAfterMinutes: 20
  }
};
var MODE_CASH = {
  full: modeCash("full"),
  quick: modeCash("quick"),
  blitz: modeCash("blitz")
};
function modeCash(mode) {
  const m = BOARD.modes[mode] ?? {};
  return {
    cash: m.startingCash ?? BOARD.meta.startingCash,
    pass: m.passStartBonus ?? BOARD.meta.passStartBonus,
    dealt: m.dealtProperties ?? 0
  };
}
function defaultSettings(mode = "quick") {
  return {
    mode,
    auctions: true,
    hotelThreshold: 4,
    turnSeconds: 30,
    hardLimitMinutes: null,
    rentSurgeAfterMinutes: null,
    rentSurgeMultiplier: 1.5,
    // חוקי בית שמאריכים משחקים — כבויים כברירת מחדל, ראה spec §5.9.
    eilatJackpot: false,
    doubleOnStart: false,
    ...MODE_DEFAULTS[mode]
  };
}
function passStartBonus(s) {
  return MODE_CASH[s.mode].pass;
}
var DEED_POSITIONS = SQUARES.filter(isDeed).map((s) => s.pos);
function createGame(seats, settings, seed, now) {
  if (seats.length < BOARD.meta.minPlayers || seats.length > BOARD.meta.maxPlayers) {
    throw new RangeError(`\u05DE\u05E1\u05E4\u05E8 \u05E9\u05D7\u05E7\u05E0\u05D9\u05DD \u05DC\u05D0 \u05D7\u05D5\u05E7\u05D9: ${seats.length}`);
  }
  const order = shuffle(seats, seed, 1);
  const { cash, dealt } = MODE_CASH[settings.mode];
  const players = order.map((s, i) => ({
    seat: i,
    userId: s.userId,
    name: s.name,
    token: s.token,
    cash,
    pos: 0,
    inJail: false,
    jailTurns: 0,
    getOutCards: 0,
    bankrupt: false,
    skipNextTurn: false
  }));
  const deeds = {};
  for (const pos of DEED_POSITIONS) deeds[pos] = { owner: null, houses: 0, hotel: false, mortgaged: false };
  if (dealt > 0) {
    const pool = shuffle(DEED_POSITIONS, seed, 2);
    for (let i = 0; i < dealt * players.length && i < pool.length; i++) {
      deeds[pool[i]].owner = players[i % players.length].seat;
    }
  }
  const decks = {};
  for (const key of ["kupat_gemel", "yad_hagoral"]) {
    const ids = BOARD.decks[key].map((c) => c.id);
    decks[key] = shuffle(ids, seed, key === "kupat_gemel" ? 3 : 4);
  }
  return {
    seq: 0,
    phase: "awaiting_roll",
    players,
    currentSeat: 0,
    dice: null,
    doublesCount: 0,
    deeds,
    bank: { houses: BOARD.meta.houseSupply, hotels: BOARD.meta.hotelSupply },
    decks,
    drawnCard: null,
    auction: null,
    trade: null,
    debt: null,
    pendingMove: null,
    pot: 0,
    turnDeadline: now + settings.turnSeconds * 1e3,
    startedAt: now,
    finishedAt: null,
    winnerSeat: null,
    settings
  };
}

// src/engine/selectors.ts
function player(s, seat) {
  const p = s.players[seat];
  if (!p) throw new RangeError(`\u05D0\u05D9\u05DF \u05E9\u05D7\u05E7\u05DF \u05D1\u05DE\u05D5\u05E9\u05D1 ${seat}`);
  return p;
}
function deedAt(pos) {
  const sq = squareAt(pos);
  if (!isDeed(sq)) throw new TypeError(`\u05D4\u05DE\u05E9\u05D1\u05E6\u05EA ${pos} \u05D0\u05D9\u05E0\u05D4 \u05E9\u05D8\u05E8`);
  return sq;
}
function isDeedPos(pos) {
  return DEED_POSITIONS.includes(pos);
}
function groupPositions(key) {
  return DEED_POSITIONS.filter((p) => {
    const sq = squareAt(p);
    return sq.type === "property" && sq.group === key;
  });
}
function ownsGroup(s, seat, key) {
  return groupPositions(key).every((p) => s.deeds[p]?.owner === seat);
}
function groupUnmortgaged(s, key) {
  return groupPositions(key).every((p) => !s.deeds[p]?.mortgaged);
}
function countOwned(s, seat, type) {
  return DEED_POSITIONS.filter((p) => {
    const d = s.deeds[p];
    return d?.owner === seat && !d.mortgaged && squareAt(p).type === type;
  }).length;
}
function rentFor(s, pos, diceSum, forced) {
  const d = s.deeds[pos];
  if (!d || d.owner === null || d.mortgaged) return 0;
  const sq = deedAt(pos);
  let rent;
  if (sq.type === "property") {
    if (d.hotel) {
      rent = sq.rent[5];
    } else if (d.houses > 0) {
      rent = sq.rent[d.houses];
    } else if (ownsGroup(s, d.owner, sq.group) && groupUnmortgaged(s, sq.group)) {
      rent = sq.rent[0] * 2;
    } else {
      rent = sq.rent[0];
    }
  } else if (sq.type === "transport") {
    const owned = countOwned(s, d.owner, "transport");
    rent = owned === 0 ? 0 : sq.rent[owned - 1];
    if (forced === "transport_double") rent *= 2;
  } else {
    if (forced === "utility_max") {
      rent = diceSum * sq.multipliers[1];
    } else {
      const owned = countOwned(s, d.owner, "utility");
      rent = owned === 0 ? 0 : diceSum * sq.multipliers[owned === 1 ? 0 : 1];
    }
  }
  return Math.round(rent * rentSurge(s));
}
function rentSurge(s) {
  const after = s.settings.rentSurgeAfterMinutes;
  if (after === null || s.finishedAt !== null) return 1;
  const elapsed = (s.turnDeadline ?? s.startedAt) - s.startedAt;
  return elapsed >= after * 6e4 ? s.settings.rentSurgeMultiplier : 1;
}
function houseCost(pos) {
  const sq = squareAt(pos);
  if (sq.type !== "property") throw new TypeError(`\u05D0\u05D9 \u05D0\u05E4\u05E9\u05E8 \u05DC\u05D1\u05E0\u05D5\u05EA \u05E2\u05DC ${pos}`);
  return group(sq.group).houseCost;
}
function houseCost0(pos) {
  const sq = squareAt(pos);
  return sq.type === "property" ? group(sq.group).houseCost : 0;
}
function buildingUnits(s, d) {
  return d.hotel ? s.settings.hotelThreshold + 1 : d.houses;
}
function netWorth(s, seat) {
  let total = player(s, seat).cash;
  for (const pos of DEED_POSITIONS) {
    const d = s.deeds[pos];
    if (d.owner !== seat) continue;
    const sq = deedAt(pos);
    total += d.mortgaged ? sq.mortgage : sq.price;
    total += houseCost0(pos) * buildingUnits(s, d);
  }
  return total;
}
function liquidValue(s, seat) {
  let total = player(s, seat).cash;
  for (const pos of DEED_POSITIONS) {
    const d = s.deeds[pos];
    if (d.owner !== seat) continue;
    const sq = deedAt(pos);
    total += houseCost0(pos) * buildingUnits(s, d) / 2;
    if (!d.mortgaged) total += sq.mortgage;
  }
  return total;
}
function activePlayers(s) {
  return s.players.filter((p) => !p.bankrupt);
}
var JAIL_POS = 10;
var BOARD_SIZE = BOARD.board.length;

// src/engine/economy.ts
function emit(s, events, type, seat, payload = {}) {
  events.push({ seq: ++s.seq, type, seat, payload });
}
function credit(s, seat, amount) {
  player(s, seat).cash += amount;
}
function charge(s, events, seat, amount, creditorSeat, reason, meta = {}) {
  if (amount <= 0) return;
  const p = player(s, seat);
  if (p.cash >= amount) {
    p.cash -= amount;
    if (creditorSeat !== null) credit(s, creditorSeat, amount);
    else if (s.settings.eilatJackpot) s.pot += amount;
    emit(s, events, "pay", seat, { amount, to: creditorSeat, reason, ...meta });
    return;
  }
  if (liquidValue(s, seat) < amount) {
    emit(s, events, "cannot_pay", seat, { amount, to: creditorSeat, reason, ...meta });
    bankrupt(s, events, seat, creditorSeat);
    return;
  }
  s.debt = {
    debtorSeat: seat,
    creditorSeat,
    amount,
    deadline: s.turnDeadline === null ? null : s.turnDeadline + 6e4,
    reason,
    meta
  };
  s.phase = "debt";
  emit(s, events, "debt_opened", seat, { amount, to: creditorSeat, reason, ...meta });
}
function collectFromEach(s, events, seat, amount, reason) {
  for (const other of activePlayers(s)) {
    if (other.seat === seat) continue;
    charge(s, events, other.seat, amount, seat, reason);
  }
}
function returnCardsToDecks(s, seat) {
  const p = player(s, seat);
  const decks = ["kupat_gemel", "yad_hagoral"];
  for (let i = 0; i < p.getOutCards; i++) {
    const key = decks[i % decks.length];
    const id = BOARD.decks[key].find((c) => c.effect.type === "keep_out_of_jail")?.id;
    if (id && !s.decks[key].includes(id)) s.decks[key].push(id);
  }
  p.getOutCards = 0;
}
function bankrupt(s, events, seat, creditorSeat) {
  const p = player(s, seat);
  if (p.bankrupt) return;
  const owned = DEED_POSITIONS.filter((pos) => s.deeds[pos].owner === seat);
  let buildingRefund = 0;
  for (const pos of owned) {
    const d = s.deeds[pos];
    const units = buildingUnits(s, d);
    if (units === 0) continue;
    buildingRefund += houseCost(pos) * units / 2;
    if (d.hotel) s.bank.hotels += 1;
    s.bank.houses += d.hotel ? 0 : d.houses;
    d.hotel = false;
    d.houses = 0;
  }
  if (creditorSeat !== null) {
    credit(s, creditorSeat, p.cash + buildingRefund);
    for (const pos of owned) {
      s.deeds[pos].owner = creditorSeat;
      if (s.deeds[pos].mortgaged) {
        const fee = Math.round(deedAt(pos).mortgage * BOARD.meta.unmortgageInterest);
        charge(s, events, creditorSeat, fee, null, "mortgage_transfer_fee", { pos });
      }
    }
    player(s, creditorSeat).getOutCards += p.getOutCards;
    p.getOutCards = 0;
  } else {
    for (const pos of owned) s.deeds[pos].owner = null;
    returnCardsToDecks(s, seat);
    if (s.settings.auctions && owned.length > 0) {
      s.auction = {
        pos: owned[0],
        bid: null,
        bidderSeat: null,
        passed: [],
        declinedBy: null,
        queue: owned.slice(1),
        deadline: s.turnDeadline === null ? null : s.turnDeadline + 12e3
      };
      s.phase = "auction";
    }
  }
  p.cash = 0;
  p.bankrupt = true;
  emit(s, events, "bankrupt", seat, { to: creditorSeat, deeds: owned.length });
  checkVictory(s, events);
}
function checkVictory(s, events) {
  const alive = activePlayers(s);
  if (alive.length > 1) return false;
  s.phase = "finished";
  s.finishedAt = s.turnDeadline ?? s.startedAt;
  s.winnerSeat = alive[0]?.seat ?? null;
  s.turnDeadline = null;
  s.auction = null;
  s.debt = null;
  emit(s, events, "game_over", s.winnerSeat, { reason: "last_standing" });
  return true;
}
function finishOnTime(s, events, now) {
  const ranked = activePlayers(s).map((p) => ({ seat: p.seat, worth: netWorth(s, p.seat), cash: p.cash })).sort((a, b) => b.worth - a.worth || b.cash - a.cash || a.seat - b.seat);
  s.phase = "finished";
  s.finishedAt = now;
  s.winnerSeat = ranked[0]?.seat ?? null;
  s.turnDeadline = null;
  emit(s, events, "game_over", s.winnerSeat, { reason: "time_limit", ranked });
}

// src/engine/auction.ts
var AUCTION_OPENING = 10;
var AUCTION_INCREMENT = 10;
var BASE_MS = 12e3;
var FLOOR_MS = 4e3;
function timerFor(bidCount) {
  return Math.max(FLOOR_MS, BASE_MS - bidCount * 1500);
}
function openAuction(s, events, pos, declinedBy, queue, now) {
  s.auction = {
    pos,
    bid: null,
    bidderSeat: null,
    passed: [],
    declinedBy,
    queue,
    deadline: now + BASE_MS
  };
  s.phase = "auction";
  emit(s, events, "auction_opened", declinedBy, { pos, name: deedAt(pos).name });
}
function bid(s, events, seat, amount, now) {
  const a = s.auction;
  if (a.passed.includes(seat)) return "ALREADY_PASSED";
  const minimum = a.bid === null ? AUCTION_OPENING : a.bid + AUCTION_INCREMENT;
  if (!Number.isInteger(amount) || amount < minimum) return "BID_TOO_LOW";
  if (player(s, seat).cash < amount) return "INSUFFICIENT_FUNDS";
  a.bid = amount;
  a.bidderSeat = seat;
  a.deadline = now + timerFor(a.passed.length + 1);
  emit(s, events, "auction_bid", seat, { pos: a.pos, amount });
  return null;
}
function pass(s, events, seat, now) {
  const a = s.auction;
  if (a.passed.includes(seat)) return "ALREADY_PASSED";
  a.passed.push(seat);
  emit(s, events, "auction_pass", seat, { pos: a.pos });
  maybeSettle(s, events, now);
  return null;
}
function contenders(s) {
  const a = s.auction;
  return activePlayers(s).map((p) => p.seat).filter((seat) => !a.passed.includes(seat));
}
function maybeSettle(s, events, now, force = false) {
  const a = s.auction;
  if (!a) return;
  const left = contenders(s);
  const timedOut = a.deadline !== null && now >= a.deadline;
  const decided = left.length <= 1 && (a.bid !== null || left.length === 0);
  if (!force && !timedOut && !decided) return;
  settle(s, events, now);
}
function settle(s, events, now) {
  const a = s.auction;
  if (a.bidderSeat !== null && a.bid !== null) {
    s.deeds[a.pos].owner = a.bidderSeat;
    s.deeds[a.pos].mortgaged = false;
    charge(s, events, a.bidderSeat, a.bid, null, "auction", { pos: a.pos });
    emit(s, events, "auction_won", a.bidderSeat, { pos: a.pos, amount: a.bid });
  } else {
    emit(s, events, "auction_unsold", null, { pos: a.pos });
  }
  const next = a.queue.shift();
  if (next !== void 0) {
    openAuction(s, events, next, null, a.queue, now);
    return;
  }
  s.auction = null;
  if (s.phase === "auction") s.phase = "awaiting_end";
}

// src/engine/build.ts
function level(s, pos) {
  return buildingUnits(s, s.deeds[pos]);
}
function groupOf(pos) {
  const sq = squareAt(pos);
  return sq.type === "property" ? sq.group : null;
}
function checkGroup(s, seat, pos) {
  const key = groupOf(pos);
  if (key === null) return "NOT_A_DEED";
  const d = s.deeds[pos];
  if (!d || d.owner !== seat) return "NOT_OWNER";
  if (!ownsGroup(s, seat, key)) return "GROUP_INCOMPLETE";
  if (!groupUnmortgaged(s, key)) return "GROUP_INCOMPLETE";
  return null;
}
function buildHouse(s, events, seat, pos) {
  const bad = checkGroup(s, seat, pos);
  if (bad) return bad;
  const key = groupOf(pos);
  const d = s.deeds[pos];
  if (d.hotel) return "MAX_DEVELOPED";
  const threshold = s.settings.hotelThreshold;
  const upgradingToHotel = d.houses === threshold;
  const levels = groupPositions(key).map((p2) => level(s, p2));
  if (level(s, pos) !== Math.min(...levels)) return "UNEVEN_BUILD";
  if (upgradingToHotel) {
    if (s.bank.hotels < 1) return "NO_HOTELS_LEFT";
  } else if (s.bank.houses < 1) {
    return "NO_HOUSES_LEFT";
  }
  const cost = houseCost(pos);
  const p = player(s, seat);
  if (p.cash < cost) return "INSUFFICIENT_FUNDS";
  p.cash -= cost;
  if (upgradingToHotel) {
    s.bank.houses += threshold;
    s.bank.hotels -= 1;
    d.houses = 0;
    d.hotel = true;
    emit(s, events, "hotel_built", seat, { pos, cost });
  } else {
    s.bank.houses -= 1;
    d.houses += 1;
    emit(s, events, "house_built", seat, { pos, cost, houses: d.houses });
  }
  return null;
}
function sellHouse(s, events, seat, pos) {
  const key = groupOf(pos);
  if (key === null) return "NOT_A_DEED";
  const d = s.deeds[pos];
  if (!d || d.owner !== seat) return "NOT_OWNER";
  if (buildingUnits(s, d) === 0) return "NO_BUILDINGS";
  const levels = groupPositions(key).map((p) => level(s, p));
  if (level(s, pos) !== Math.max(...levels)) return "UNEVEN_BUILD";
  const threshold = s.settings.hotelThreshold;
  const refund = houseCost(pos) / 2;
  if (d.hotel) {
    if (s.bank.houses < threshold) return "NO_HOUSES_LEFT";
    s.bank.hotels += 1;
    s.bank.houses -= threshold;
    d.hotel = false;
    d.houses = threshold;
    credit(s, seat, refund);
    emit(s, events, "hotel_sold", seat, { pos, refund });
  } else {
    s.bank.houses += 1;
    d.houses -= 1;
    credit(s, seat, refund);
    emit(s, events, "house_sold", seat, { pos, refund, houses: d.houses });
  }
  return null;
}
function mortgage(s, events, seat, pos) {
  const d = s.deeds[pos];
  if (!d) return "NOT_A_DEED";
  if (d.owner !== seat) return "NOT_OWNER";
  if (d.mortgaged) return "ALREADY_MORTGAGED";
  const key = groupOf(pos);
  if (key !== null && groupPositions(key).some((p) => buildingUnits(s, s.deeds[p]) > 0)) {
    return "HAS_BUILDINGS";
  }
  d.mortgaged = true;
  const amount = deedAt(pos).mortgage;
  credit(s, seat, amount);
  emit(s, events, "mortgaged", seat, { pos, amount });
  return null;
}
function unmortgage(s, events, seat, pos) {
  const d = s.deeds[pos];
  if (!d) return "NOT_A_DEED";
  if (d.owner !== seat) return "NOT_OWNER";
  if (!d.mortgaged) return "NOT_MORTGAGED";
  const cost = Math.round(deedAt(pos).mortgage * (1 + BOARD.meta.unmortgageInterest));
  const p = player(s, seat);
  if (p.cash < cost) return "INSUFFICIENT_FUNDS";
  p.cash -= cost;
  d.mortgaged = false;
  emit(s, events, "unmortgaged", seat, { pos, cost });
  return null;
}

// src/engine/moves.ts
function cardDef(deck, id) {
  const c = BOARD.decks[deck].find((x) => x.id === id);
  if (!c) throw new Error(`\u05E7\u05DC\u05E3 \u05DC\u05D0 \u05DE\u05D5\u05DB\u05E8: ${deck}/${id}`);
  return c;
}
function moveTo(s, events, seat, pos, collectStart) {
  const p = player(s, seat);
  const passed = pos < p.pos;
  p.pos = pos;
  if (collectStart && passed) {
    const bonus = passStartBonus(s.settings);
    credit(s, seat, bonus);
    emit(s, events, "pass_start", seat, { amount: bonus });
  }
}
function sendToJail(s, events, seat) {
  const p = player(s, seat);
  p.pos = JAIL_POS;
  p.inJail = true;
  p.jailTurns = 0;
  s.doublesCount = 0;
  emit(s, events, "jailed", seat, {});
}
function nearest(from, type) {
  for (let i = 1; i <= BOARD_SIZE; i++) {
    const pos = (from + i) % BOARD_SIZE;
    if (squareAt(pos).type === type) return pos;
  }
  throw new Error(`\u05D0\u05D9\u05DF \u05DE\u05E9\u05D1\u05E6\u05EA \u05DE\u05E1\u05D5\u05D2 ${type} \u05E2\u05DC \u05D4\u05DC\u05D5\u05D7`);
}
function resolveLanding(s, events, seat, diceSum, forced) {
  const p = player(s, seat);
  const sq = squareAt(p.pos);
  emit(s, events, "landed", seat, { pos: p.pos, name: sq.name });
  if (isDeedPos(p.pos)) {
    const d = s.deeds[p.pos];
    if (d.owner === null) {
      s.phase = "awaiting_buy";
      return;
    }
    if (d.owner === seat || d.mortgaged) {
      s.phase = "awaiting_end";
      return;
    }
    const rent = rentFor(s, p.pos, diceSum, forced);
    if (rent > 0) {
      emit(s, events, "rent_due", seat, { pos: p.pos, amount: rent, to: d.owner });
      charge(s, events, seat, rent, d.owner, "rent", { pos: p.pos });
    }
    if (s.phase !== "debt" && s.phase !== "finished") s.phase = "awaiting_end";
    return;
  }
  switch (sq.type) {
    case "tax":
      charge(s, events, seat, sq.amount, null, "tax", { pos: p.pos });
      break;
    case "card":
      drawCard(s, events, seat, sq.deck);
      return;
    case "corner":
      if (sq.key === "goto_jail") {
        sendToJail(s, events, seat);
        s.phase = "awaiting_end";
        return;
      }
      if (sq.key === "rest" && s.settings.eilatJackpot && s.pot > 0) {
        credit(s, seat, s.pot);
        emit(s, events, "pot_collected", seat, { amount: s.pot });
        s.pot = 0;
      }
      if (sq.key === "start" && s.settings.doubleOnStart) {
        const bonus = passStartBonus(s.settings);
        credit(s, seat, bonus);
        emit(s, events, "start_landing_bonus", seat, { amount: bonus });
      }
      break;
  }
  if (s.phase !== "debt" && s.phase !== "finished") s.phase = "awaiting_end";
}
function drawCard(s, events, seat, deck) {
  const id = s.decks[deck].shift();
  if (!id) {
    s.phase = "awaiting_end";
    return;
  }
  s.drawnCard = { deck, id };
  emit(s, events, "card_drawn", seat, { deck, id, text: cardDef(deck, id).text });
  if (cardDef(deck, id).effect.type !== "keep_out_of_jail") s.decks[deck].push(id);
}
function applyCard(s, events, seat) {
  const drawn = s.drawnCard;
  if (!drawn) return;
  s.drawnCard = null;
  const { effect } = cardDef(drawn.deck, drawn.id);
  const p = player(s, seat);
  const e = effect;
  switch (effect.type) {
    case "cash": {
      const amount = Number(e.amount);
      if (amount >= 0) {
        credit(s, seat, amount);
        emit(s, events, "card_cash", seat, { amount });
      } else charge(s, events, seat, -amount, null, "card");
      break;
    }
    case "collect_from_each":
      collectFromEach(s, events, seat, Number(e.amount), "card");
      break;
    case "per_building": {
      let total = 0;
      for (const pos of DEED_POSITIONS) {
        const d = s.deeds[pos];
        if (d.owner !== seat) continue;
        if (d.hotel) total += Math.abs(Number(e.perHotel));
        else total += d.houses * Math.abs(Number(e.perHouse));
      }
      if (total > 0) charge(s, events, seat, total, null, "card_repairs", {});
      break;
    }
    case "keep_out_of_jail":
      p.getOutCards += 1;
      emit(s, events, "jail_card_received", seat, {});
      break;
    case "skip_next_turn":
      p.skipNextTurn = true;
      emit(s, events, "skip_queued", seat, {});
      break;
    case "goto_jail":
      sendToJail(s, events, seat);
      break;
    case "move_to":
      moveTo(s, events, seat, Number(e.pos), Boolean(e.collectStart));
      resolveLanding(s, events, seat, s.dice ? s.dice[0] + s.dice[1] : 0);
      return;
    case "move_relative": {
      const target = (p.pos + Number(e.delta) + BOARD_SIZE) % BOARD_SIZE;
      p.pos = target;
      resolveLanding(s, events, seat, s.dice ? s.dice[0] + s.dice[1] : 0);
      return;
    }
    case "nearest_transport": {
      moveTo(s, events, seat, nearest(p.pos, "transport"), true);
      resolveLanding(s, events, seat, 0, "transport_double");
      return;
    }
    case "nearest_utility": {
      moveTo(s, events, seat, nearest(p.pos, "utility"), true);
      const sum = s.dice ? s.dice[0] + s.dice[1] : 0;
      resolveLanding(s, events, seat, sum, "utility_max");
      return;
    }
  }
  if (s.phase !== "debt" && s.phase !== "finished") s.phase = "awaiting_end";
}

// src/engine/reduce.ts
var TRADE_TTL_MS = 6e4;
function phaseOf(s) {
  return s.phase;
}
function setDeadline(s, now) {
  s.turnDeadline = now + s.settings.turnSeconds * 1e3;
}
function timeExpired(s, now) {
  const limit = s.settings.hardLimitMinutes;
  return limit !== null && now - s.startedAt >= limit * 6e4;
}
function nextTurn(s, events, now) {
  if (checkVictory(s, events)) return;
  if (timeExpired(s, now)) {
    finishOnTime(s, events, now);
    return;
  }
  s.dice = null;
  s.doublesCount = 0;
  s.drawnCard = null;
  s.trade = null;
  const seats = s.players.map((p) => p.seat);
  let seat = s.currentSeat;
  for (let i = 0; i < seats.length * 2; i++) {
    seat = (seat + 1) % seats.length;
    const p = player(s, seat);
    if (p.bankrupt) continue;
    if (p.skipNextTurn) {
      p.skipNextTurn = false;
      emit(s, events, "turn_skipped", seat, {});
      continue;
    }
    break;
  }
  s.currentSeat = seat;
  s.phase = "awaiting_roll";
  setDeadline(s, now);
  emit(s, events, "turn_started", seat, {});
}
function settleDebtIfPossible(s, events) {
  const debt = s.debt;
  if (!debt) return;
  const p = player(s, debt.debtorSeat);
  if (p.cash < debt.amount) return;
  p.cash -= debt.amount;
  if (debt.creditorSeat !== null) credit(s, debt.creditorSeat, debt.amount);
  else if (s.settings.eilatJackpot) s.pot += debt.amount;
  emit(
    s,
    events,
    "debt_settled",
    debt.debtorSeat,
    { amount: debt.amount, to: debt.creditorSeat, reason: debt.reason, ...debt.meta }
  );
  s.debt = null;
  resumeAfterDebt(s, events);
}
function resumeAfterDebt(s, events) {
  if (phaseOf(s) === "finished") return;
  const pending = s.pendingMove;
  if (pending !== null) {
    s.pendingMove = null;
    const p = player(s, s.currentSeat);
    p.inJail = false;
    p.jailTurns = 0;
    moveTo(s, events, s.currentSeat, (p.pos + pending) % BOARD_SIZE, true);
    resolveLanding(s, events, s.currentSeat, pending);
    if (phaseOf(s) === "debt" || phaseOf(s) === "finished") return;
  }
  s.phase = s.auction ? "auction" : "awaiting_end";
}
function autoLiquidate(s, events, seat, target) {
  const byValue = DEED_POSITIONS.filter((pos) => s.deeds[pos].owner === seat).sort((a, b) => deedAt(a).price - deedAt(b).price);
  for (const pos of byValue) {
    while (player(s, seat).cash < target && buildingUnits(s, s.deeds[pos]) > 0) {
      if (sellHouse(s, events, seat, pos) !== null) break;
    }
  }
  for (const pos of byValue) {
    if (player(s, seat).cash >= target) break;
    if (!s.deeds[pos].mortgaged) mortgage(s, events, seat, pos);
  }
}
function tradeSideValid(s, seat, side) {
  if (side.cash < 0 || !Number.isInteger(side.cash)) return "INVALID_TRADE";
  const p = player(s, seat);
  if (p.cash < side.cash) return "INSUFFICIENT_FUNDS";
  if (side.jailCards < 0 || side.jailCards > p.getOutCards) return "INVALID_TRADE";
  for (const pos of side.deeds) {
    const d = s.deeds[pos];
    if (!d) return "NOT_A_DEED";
    if (d.owner !== seat) return "NOT_OWNER";
    const sq = deedAt(pos);
    if (sq.type === "property") {
      const built = DEED_POSITIONS.some((q) => {
        const qs = deedAt(q);
        return qs.type === "property" && qs.group === sq.group && buildingUnits(s, s.deeds[q]) > 0;
      });
      if (built) return "HAS_BUILDINGS";
    }
  }
  return null;
}
function executeTrade(s, events, offer) {
  const a = player(s, offer.fromSeat);
  const b = player(s, offer.toSeat);
  a.cash -= offer.give.cash;
  b.cash += offer.give.cash;
  b.cash -= offer.receive.cash;
  a.cash += offer.receive.cash;
  a.getOutCards -= offer.give.jailCards;
  b.getOutCards += offer.give.jailCards;
  b.getOutCards -= offer.receive.jailCards;
  a.getOutCards += offer.receive.jailCards;
  const fee = BOARD.meta.unmortgageInterest;
  for (const pos of offer.give.deeds) {
    s.deeds[pos].owner = offer.toSeat;
    if (s.deeds[pos].mortgaged) {
      charge(
        s,
        events,
        offer.toSeat,
        Math.round(deedAt(pos).mortgage * fee),
        null,
        "mortgage_transfer_fee",
        { pos }
      );
    }
  }
  for (const pos of offer.receive.deeds) {
    s.deeds[pos].owner = offer.fromSeat;
    if (s.deeds[pos].mortgaged) {
      charge(
        s,
        events,
        offer.fromSeat,
        Math.round(deedAt(pos).mortgage * fee),
        null,
        "mortgage_transfer_fee",
        { pos }
      );
    }
  }
  emit(s, events, "trade_executed", offer.fromSeat, { with: offer.toSeat });
}
var err = (error) => ({ ok: false, error });
function reduce(state, action, ctx) {
  const s = structuredClone(state);
  const events = [];
  const { seat, now } = ctx;
  if (s.phase === "finished") return err("GAME_OVER");
  if (action.type !== "claim_timeout" && s.players[seat]?.bankrupt) {
    return err("PLAYER_BANKRUPT");
  }
  if (action.type !== "claim_timeout" && s.turnDeadline !== null && now > s.turnDeadline) {
    applyTimeout(s, events, now, ctx.seed);
    if (phaseOf(s) === "finished") return { ok: true, state: s, events };
  }
  const isCurrent = seat === s.currentSeat;
  switch (action.type) {
    case "roll": {
      if (!isCurrent) return err("NOT_YOUR_TURN");
      if (s.phase !== "awaiting_roll") return err("WRONG_PHASE");
      doRoll(s, events, ctx);
      break;
    }
    case "buy_property": {
      if (!isCurrent) return err("NOT_YOUR_TURN");
      if (s.phase !== "awaiting_buy") return err("WRONG_PHASE");
      const p = player(s, seat);
      const d = s.deeds[p.pos];
      if (!d) return err("NOT_A_DEED");
      if (d.owner !== null) return err("ALREADY_OWNED");
      const price = deedAt(p.pos).price;
      if (p.cash < price) return err("INSUFFICIENT_FUNDS");
      p.cash -= price;
      d.owner = seat;
      emit(s, events, "bought", seat, { pos: p.pos, price });
      s.phase = "awaiting_end";
      break;
    }
    case "decline_property": {
      if (!isCurrent) return err("NOT_YOUR_TURN");
      if (s.phase !== "awaiting_buy") return err("WRONG_PHASE");
      const pos = player(s, seat).pos;
      if (s.settings.auctions) openAuction(s, events, pos, seat, [], now);
      else {
        emit(s, events, "declined", seat, { pos });
        s.phase = "awaiting_end";
      }
      break;
    }
    case "auction_bid": {
      if (!s.auction) return err("NO_AUCTION");
      const bad = bid(s, events, seat, action.amount, now);
      if (bad) return err(bad);
      break;
    }
    case "auction_pass": {
      if (!s.auction) return err("NO_AUCTION");
      const bad = pass(s, events, seat, now);
      if (bad) return err(bad);
      break;
    }
    case "build_house": {
      const bad = buildHouse(s, events, seat, action.pos);
      if (bad) return err(bad);
      break;
    }
    case "sell_house": {
      const bad = sellHouse(s, events, seat, action.pos);
      if (bad) return err(bad);
      settleDebtIfPossible(s, events);
      break;
    }
    case "mortgage": {
      const bad = mortgage(s, events, seat, action.pos);
      if (bad) return err(bad);
      settleDebtIfPossible(s, events);
      break;
    }
    case "unmortgage": {
      const bad = unmortgage(s, events, seat, action.pos);
      if (bad) return err(bad);
      break;
    }
    case "pay_jail_fine": {
      if (!isCurrent) return err("NOT_YOUR_TURN");
      if (s.phase !== "awaiting_roll") return err("WRONG_PHASE");
      const p = player(s, seat);
      if (!p.inJail) return err("NOT_IN_JAIL");
      if (p.cash < BOARD.meta.jailFine) return err("INSUFFICIENT_FUNDS");
      p.cash -= BOARD.meta.jailFine;
      p.inJail = false;
      p.jailTurns = 0;
      emit(s, events, "jail_paid", seat, { amount: BOARD.meta.jailFine });
      break;
    }
    case "use_jail_card": {
      if (!isCurrent) return err("NOT_YOUR_TURN");
      if (s.phase !== "awaiting_roll") return err("WRONG_PHASE");
      const p = player(s, seat);
      if (!p.inJail) return err("NOT_IN_JAIL");
      if (p.getOutCards < 1) return err("NO_JAIL_CARD");
      p.getOutCards -= 1;
      p.inJail = false;
      p.jailTurns = 0;
      const deck = BOARD.decks.yad_hagoral.find((c) => c.effect.type === "keep_out_of_jail");
      if (deck && !s.decks.yad_hagoral.includes(deck.id)) s.decks.yad_hagoral.push(deck.id);
      emit(s, events, "jail_card_used", seat, {});
      break;
    }
    case "acknowledge_card": {
      if (!s.drawnCard) return err("WRONG_PHASE");
      applyCard(s, events, s.currentSeat);
      break;
    }
    case "propose_trade": {
      const o = action.offer;
      if (o.fromSeat !== seat) return err("NOT_YOUR_TURN");
      if (o.toSeat === seat) return err("INVALID_TRADE");
      if (!s.players[o.toSeat] || s.players[o.toSeat].bankrupt) return err("INVALID_TRADE");
      if (s.phase === "auction" || s.phase === "debt") return err("WRONG_PHASE");
      const badGive = tradeSideValid(s, o.fromSeat, o.give);
      if (badGive) return err(badGive);
      const badGet = tradeSideValid(s, o.toSeat, o.receive);
      if (badGet) return err(badGet);
      s.trade = { ...o, expiresAt: now + TRADE_TTL_MS };
      emit(s, events, "trade_proposed", seat, { to: o.toSeat });
      break;
    }
    case "accept_trade": {
      const o = s.trade;
      if (!o) return err("NO_TRADE");
      if (o.toSeat !== seat) return err("NOT_TRADE_TARGET");
      if (now > o.expiresAt) {
        s.trade = null;
        return err("NO_TRADE");
      }
      if (tradeSideValid(s, o.fromSeat, o.give) || tradeSideValid(s, o.toSeat, o.receive)) {
        s.trade = null;
        return err("INVALID_TRADE");
      }
      executeTrade(s, events, o);
      s.trade = null;
      break;
    }
    case "reject_trade": {
      const o = s.trade;
      if (!o) return err("NO_TRADE");
      if (o.toSeat !== seat && o.fromSeat !== seat) return err("NOT_TRADE_TARGET");
      s.trade = null;
      emit(s, events, "trade_rejected", seat, {});
      break;
    }
    case "end_turn": {
      if (!isCurrent) return err("NOT_YOUR_TURN");
      if (s.phase !== "awaiting_end") return err("WRONG_PHASE");
      if (s.dice && s.dice[0] === s.dice[1] && !player(s, seat).inJail && s.doublesCount > 0) {
        s.phase = "awaiting_roll";
        setDeadline(s, now);
        emit(s, events, "extra_roll", seat, {});
        break;
      }
      nextTurn(s, events, now);
      break;
    }
    case "declare_bankruptcy": {
      if (!s.debt || s.debt.debtorSeat !== seat) return err("NO_DEBT");
      const owed = s.debt.amount;
      if (liquidValue(s, seat) >= owed && player(s, seat).cash < owed) {
        return err("CAN_PAY");
      }
      const creditor = s.debt.creditorSeat;
      s.debt = null;
      s.pendingMove = null;
      bankrupt(s, events, seat, creditor);
      if (phaseOf(s) !== "finished" && phaseOf(s) !== "auction") nextTurn(s, events, now);
      break;
    }
    case "claim_timeout": {
      if (s.turnDeadline === null || now <= s.turnDeadline) {
        if (!s.auction || s.auction.deadline === null || now <= s.auction.deadline) {
          return err("DEADLINE_NOT_REACHED");
        }
      }
      applyTimeout(s, events, now, ctx.seed);
      break;
    }
    default:
      return err("UNKNOWN_ACTION");
  }
  normalize(s, events, now);
  return { ok: true, state: s, events };
}
function normalize(s, events, now) {
  if (phaseOf(s) === "finished") return;
  if (s.debt && player(s, s.debt.debtorSeat).bankrupt) {
    s.debt = null;
    s.pendingMove = null;
  }
  if (s.debt) {
    s.phase = "debt";
    return;
  }
  if (phaseOf(s) === "debt") s.phase = s.auction ? "auction" : "awaiting_end";
  if (phaseOf(s) === "auction") return;
  if (player(s, s.currentSeat).bankrupt) nextTurn(s, events, now);
}
function doRoll(s, events, ctx) {
  const { seed } = ctx;
  const seat = s.currentSeat;
  const p = player(s, seat);
  const [d1, d2] = rollDice(seed, s.seq);
  s.dice = [d1, d2];
  const sum = d1 + d2;
  const isDouble = d1 === d2;
  emit(s, events, "rolled", seat, { d1, d2, double: isDouble });
  if (p.inJail) {
    if (isDouble) {
      p.inJail = false;
      p.jailTurns = 0;
      emit(s, events, "jail_escaped", seat, { d1, d2 });
      moveTo(s, events, seat, (p.pos + sum) % BOARD_SIZE, true);
      resolveLanding(s, events, seat, sum);
      s.doublesCount = 0;
      return;
    }
    p.jailTurns += 1;
    if (p.jailTurns < BOARD.meta.maxJailTurns) {
      emit(s, events, "jail_attempt_failed", seat, { attempt: p.jailTurns });
      s.phase = "awaiting_end";
      return;
    }
    emit(s, events, "jail_term_ended", seat, {});
    s.pendingMove = sum;
    charge(s, events, seat, BOARD.meta.jailFine, null, "jail_fine", { pos: JAIL_POS });
    if (phaseOf(s) === "debt" || phaseOf(s) === "finished") return;
    s.pendingMove = null;
    p.inJail = false;
    p.jailTurns = 0;
    moveTo(s, events, seat, (p.pos + sum) % BOARD_SIZE, true);
    resolveLanding(s, events, seat, sum);
    s.doublesCount = 0;
    return;
  }
  if (isDouble) {
    s.doublesCount += 1;
    if (s.doublesCount >= 3) {
      emit(s, events, "three_doubles", seat, {});
      sendToJail(s, events, seat);
      s.phase = "awaiting_end";
      return;
    }
  }
  moveTo(s, events, seat, (p.pos + sum) % BOARD_SIZE, true);
  resolveLanding(s, events, seat, sum);
}
function applyTimeout(s, events, now, seed) {
  if (s.auction && s.auction.deadline !== null && now >= s.auction.deadline) {
    maybeSettle(s, events, now, true);
    if (phaseOf(s) !== "auction") setDeadline(s, now);
    return;
  }
  if (s.trade && now > s.trade.expiresAt) s.trade = null;
  switch (s.phase) {
    case "awaiting_roll":
      emit(s, events, "auto_roll", s.currentSeat, {});
      doRoll(s, events, { seat: s.currentSeat, now, seed });
      if (phaseOf(s) === "awaiting_end") nextTurn(s, events, now);
      break;
    case "awaiting_buy":
      emit(s, events, "auto_decline", s.currentSeat, {});
      if (s.settings.auctions) openAuction(
        s,
        events,
        player(s, s.currentSeat).pos,
        s.currentSeat,
        [],
        now
      );
      else nextTurn(s, events, now);
      break;
    case "awaiting_end":
      nextTurn(s, events, now);
      break;
    case "debt": {
      const debt = s.debt;
      if (!debt) {
        s.phase = s.auction ? "auction" : "awaiting_end";
        break;
      }
      const { debtorSeat, amount, creditorSeat } = debt;
      if (liquidValue(s, debtorSeat) >= amount) {
        emit(s, events, "auto_liquidate", debtorSeat, { amount });
        autoLiquidate(s, events, debtorSeat, amount);
        settleDebtIfPossible(s, events);
        if (phaseOf(s) === "awaiting_end") nextTurn(s, events, now);
      } else {
        s.debt = null;
        s.pendingMove = null;
        bankrupt(s, events, debtorSeat, creditorSeat);
        if (phaseOf(s) !== "finished" && phaseOf(s) !== "auction") nextTurn(s, events, now);
      }
      break;
    }
    default:
      break;
  }
}
export {
  AUCTION_INCREMENT,
  AUCTION_OPENING,
  DEED_POSITIONS,
  activePlayers,
  buildingUnits,
  createGame,
  defaultSettings,
  houseCost,
  liquidValue,
  netWorth,
  passStartBonus,
  player,
  reduce,
  rentFor,
  rollDice,
  shuffle
};
