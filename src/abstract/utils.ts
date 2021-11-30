import { SAFE_DEV, LOGGING_CYCLE, DEVELOPING } from "../settings";

export function makeId(length: number): string {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() *
      charactersLength));
  }
  return result;
}

// wrap run or update functions
// not to get colony wide blackout cause i missed something in some master
export function safeWrap(cycle: () => void, context: string): void {
  if (SAFE_DEV) {
    try { cycle(); }
    catch (e) {
      if (LOGGING_CYCLE) {
        if (!Memory.report.crashes)
          Memory.report.crashes = {};
        let regex = /\["(.*)\"]/.exec(context);
        if (DEVELOPING) console.log(e.stack);
        // console .log(context, e.message);
        Memory.report.crashes[regex ? regex[1] : context] = { time: Game.time, context: context, message: e.message, stack: e.stack }
      }
    }
  } else
    cycle();
}

export function findOptimalResource(store: Store<ResourceConstant, false>, mode: -1 | 1 = 1): ResourceConstant {
  let ans: ResourceConstant = RESOURCE_ENERGY;
  for (let resourceConstant in store) {
    let res = <ResourceConstant>resourceConstant;
    if (ans !== resourceConstant && (store.getUsedCapacity(res) - store.getUsedCapacity(ans)) * mode > 0)
      ans = res;
  }
  return ans;
}

export function towerCoef(tower: StructureTower, pos: ProtoPos, ignoreBuff = false) {
  if (!(pos instanceof RoomPosition))
    pos = pos.pos;
  let coef = 1;
  if (tower.effects && !ignoreBuff) {
    let powerup = <PowerEffect>tower.effects.filter(e => e.effect === PWR_OPERATE_TOWER)[0];
    if (powerup)
      coef += powerup.level * 0.1;
    let powerdown = <PowerEffect>tower.effects.filter(e => e.effect === PWR_DISRUPT_TOWER)[0];
    if (powerdown)
      coef -= powerdown.level * 0.1;
  }
  let range = pos.getRangeTo(tower.pos);
  if (range >= TOWER_FALLOFF_RANGE)
    return coef * (1 - TOWER_FALLOFF);
  else if (range <= TOWER_OPTIMAL_RANGE)
    return coef;
  return coef * (TOWER_OPTIMAL_RANGE - range + TOWER_FALLOFF_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE) * TOWER_FALLOFF;
}

export function getRoomCoorinates(roomName: string, plane = true): [number, number, string, string] {
  let parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName);
  let x = 0;
  let y = 0;
  if (parsed) {
    x = (+parsed[2]) * (!plane && parsed[1] === "W" ? -1 : 1);
    y = (+parsed[4]) * (!plane && parsed[3] === "S" ? -1 : 1);
    return [x, y, parsed[1], parsed[3]];
  }
  return [0, 0, "E", "S"];
}

export function getEnterances(roomName: string): RoomPosition[] {
  let terrain = Game.map.getRoomTerrain(roomName);
  let enterances = [];
  for (let y in { 0: 1, 49: 1 }) {
    let start = -1;
    let end = -1;
    for (let x = 0; x <= 49; ++x)
      if (terrain.get(x, +y) !== TERRAIN_MASK_WALL) {
        if (start === -1)
          start = x;
        end = x;
      } else if (start !== -1) {
        let pos = new RoomPosition(start + Math.round((end - start) / 2), +y, roomName);
        enterances.push(pos);
        start = -1;
      }
  }
  for (let x in { 0: 1, 49: 1 }) {
    let start = -1;
    let end = -1;
    for (let y = 0; y <= 49; ++y)
      if (terrain.get(+x, y) !== TERRAIN_MASK_WALL) {
        if (start === -1)
          start = y;
        end = y;
      } else if (start !== -1) {
        let pos = new RoomPosition(+x, start + Math.round((end - start) / 2), roomName);
        enterances.push(pos);
        start = -1;
      }
  }
  return enterances;
}
