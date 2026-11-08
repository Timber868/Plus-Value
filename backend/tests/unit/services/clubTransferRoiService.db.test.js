/**
 * @file Runs a club's transfer ROI queries against an in-memory MongoDB.
 * Like Club.test.js, this needs the MongoDB binary and is verified in CI.
 */

const mongoose = require("mongoose");
const mongo = require("../../helpers/mongoMemory");
const Person = require("../../../src/models/Person");
const Player = require("../../../src/models/Player");
const Club = require("../../../src/models/Club");
const Transfer = require("../../../src/models/Transfer");
const MarketValue = require("../../../src/models/MarketValue");
const Season = require("../../../src/models/Season");
const { getClubTransferRoi } = require("../../../src/services/clubTransferRoiService");

let ol;
let season2010;
let ligue2Season2010;
let season2011;

beforeAll(async () => {
  await mongo.start();
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await mongo.clearAll();
  const person = await Person.create({ name: "Alexandre Lacazette", birthDate: new Date("1991-05-28"), nationality: "France" });
  const player = await Player.create({ playerId: "1", person: person._id });
  ol = await Club.create({ clubId: "1041", name: "Olympique Lyonnais", country: "France" });
  const arsenal = await Club.create({ clubId: "11", name: "Arsenal FC", country: "England" });
  const ligue1 = new mongoose.Types.ObjectId();
  const ligue2 = new mongoose.Types.ObjectId();
  const season = (league, start, end) => Season.create({ league, startDate: new Date(start), endDate: new Date(end) });
  season2010 = (await season(ligue1, "2010-08-07", "2011-05-29"))._id;
  ligue2Season2010 = (await season(ligue2, "2010-07-30", "2011-05-27"))._id;
  season2011 = (await season(ligue1, "2011-08-06", "2012-05-20"))._id;
  await Transfer.create([
    { player: player._id, buyer: ol._id, season: season2010, date: new Date("2010-07-01"), price: 1000000 },
    { player: player._id, buyer: arsenal._id, seller: ol._id, season: new mongoose.Types.ObjectId(), date: new Date("2017-07-05"), price: 53000000 },
  ]);
  await MarketValue.create([
    { player: player._id, date: new Date("2010-06-01"), value: 500000 },
    { player: player._id, date: new Date("2017-06-01"), value: 40000000 },
  ]);
});

describe("getClubTransferRoi (MongoDB)", () => {
  it("returns the club's incoming transfers with resale ROI and totals", async () => {
    const result = await getClubTransferRoi(String(ol._id));

    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toMatchObject({
      isLoan: false,
      player: { name: "Alexandre Lacazette" },
      fromClub: null,
      feePaid: 1000000,
      marketValueAtSigning: { value: 500000 },
      exit: { type: "resale", value: 53000000 },
      gain: 52000000,
      roiPercent: 5200,
    });
    expect(result.totals).toEqual({
      totalSpent: 1000000,
      totalCurrentValue: 0,
      totalResaleIncome: 53000000,
      totalLoanIncome: 0,
      netGain: 52000000,
    });
  });

  it("filters by the season's period, in any league", async () => {
    const unknown = await getClubTransferRoi(String(ol._id), { seasonId: String(new mongoose.Types.ObjectId()) });
    const other = await getClubTransferRoi(String(ol._id), { seasonId: String(season2011) });
    const same = await getClubTransferRoi(String(ol._id), { seasonId: String(season2010) });
    const samePeriodOtherLeague = await getClubTransferRoi(String(ol._id), { seasonId: String(ligue2Season2010) });

    expect(unknown.transfers).toHaveLength(0);
    expect(other.transfers).toHaveLength(0);
    expect(same.transfers).toHaveLength(1);
    expect(samePeriodOtherLeague.transfers).toHaveLength(1);
  });

  it("returns null for an unknown club", async () => {
    expect(await getClubTransferRoi(String(new mongoose.Types.ObjectId()))).toBeNull();
  });
});
