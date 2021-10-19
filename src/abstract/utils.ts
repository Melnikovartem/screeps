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
        if (DEVELOPING) console.log(context, e.message);
        // console .log(e);
        Memory.log.crashes[regex ? regex[1] : context] = { time: Game.time, context: context, message: e.message, stack: e.stack }
      }
    }
  } else
    cycle();
}

export function findOptimalResource(store: Store<ResourceConstant, false>): ResourceConstant {
  let ans: ResourceConstant = RESOURCE_ENERGY;
  for (let resourceConstant in store) {
    if (ans !== resourceConstant && store[<ResourceConstant>resourceConstant] > store.getUsedCapacity(ans))
      ans = <ResourceConstant>resourceConstant;
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
  return (TOWER_OPTIMAL_RANGE - range + TOWER_FALLOFF_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
}
