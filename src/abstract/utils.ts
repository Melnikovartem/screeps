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
        if (!Memory.log.crashes)
          Memory.log.crashes = {};
        let regex = /\["(.*)\"]/.exec(context);
        if (DEVELOPING) console.log(e.stack);
        // console .log(context, e.message);
        Memory.log.crashes[regex ? regex[1] : context] = { time: Game.time, context: context, message: e.message, stack: e.stack }
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

export function towerCoef(tower: StructureTower, pos: ProtoPos) {
  if (!(pos instanceof RoomPosition))
    pos = pos.pos;
  let range = pos.getRangeTo(tower.pos);
  if (range >= TOWER_FALLOFF_RANGE)
    return 1 - TOWER_FALLOFF;
  else if (range <= TOWER_OPTIMAL_RANGE)
    return 1;
  return (TOWER_OPTIMAL_RANGE - range + TOWER_FALLOFF_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE) * TOWER_FALLOFF;
}
