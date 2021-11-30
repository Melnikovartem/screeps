import { beeStates } from "../enums";
import { profile } from "../profiler/decorator";
import type { Master } from "../beeMasters/_Master";

type InfoMove = { bee: ProtoBee<Creep | PowerCreep>, priority: number };
type MoveMap = { [id: string]: InfoMove[] };

@profile
export abstract class ProtoBee<ProtoCreep extends Creep | PowerCreep> {

  abstract master: Master | undefined;
  abstract lifeTime: number;

  creep: ProtoCreep;
  ref: string;

  // target caching and states to have some tools to work with in masters

  targetPosition: RoomPosition | undefined;
  actionPosition: RoomPosition | undefined;

  // for now it will be forever binded
  constructor(creep: ProtoCreep) {
    this.creep = creep;
    this.ref = creep.name;
    if (this.state === undefined)
      this.state = beeStates.idle;
    // not sure weather i should copy all parameters from creep like body and stuff
    Apiary.bees[this.creep.name] = this;
  }

  abstract memory: CreepMemory | PowerCreepMemory;
  abstract readonly fatigue: number;

  get state() {
    return this.creep.memory.state;
  }

  set state(state) {
    this.creep.memory.state = state;
  }

  get target() {
    return this.creep.memory.target;
  }

  set target(target) {
    this.creep.memory.target = target;
  }

  get hits() {
    return this.creep.hits;
  }

  get hitsMax() {
    return this.creep.hitsMax;
  }

  get store() {
    return this.creep.store;
  }

  get pos() {
    return this.creep.pos;
  }

  get ticksToLive() {
    if (this.creep.ticksToLive)
      return this.creep.ticksToLive;
    else
      return this.lifeTime;
  }

  update() {
    this.targetPosition = undefined;
    this.actionPosition = undefined;
  }

  // abstract static checkBees(): string;

  // for future: could path to open position near object for targets that require isNearTo
  // but is it worh in terms of CPU?
  actionCheck(pos: RoomPosition, opt: TravelToOptions = {}, range: number = 1): ScreepsReturnCode {
    if (this.creep.pos.getRangeTo(pos) <= range) {
      this.actionPosition = pos;
      return OK;
    } else {
      opt.range = range;
      return this.goTo(pos, opt);
    }
  }

  goRest(pos: RoomPosition, opt?: TravelToOptions): ScreepsReturnCode {
    this.actionPosition = pos;
    if (!pos.equal(this) && (!this.pos.isNearTo(pos) || pos.isFree(false)))
      this.goTo(pos, opt);
    else
      return OK;
    return ERR_NOT_IN_RANGE;
  }

  goToRoom(roomName: string, opt?: TravelToOptions): ScreepsReturnCode {
    return this.goTo(new RoomPosition(25, 25, roomName), opt);
  }

  goTo(target: ProtoPos, opt: TravelToOptions = {}): ScreepsReturnCode {
    Apiary.intel.getInfo(this.pos.roomName, Infinity);
    let ans = this.creep.travelTo(target, opt);
    if (typeof ans === "number") {
      if (ans === OK)
        this.targetPosition = undefined;
      return ans;
    } else
      this.targetPosition = ans;
    return ERR_NOT_IN_RANGE;
  }

  transfer(t: Structure, resourceType: ResourceConstant, amount?: number, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.transfer(t, resourceType, amount) : ans;
  }

  withdraw(t: Structure | Tombstone | Ruin, resourceType: ResourceConstant, amount?: number, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.withdraw(t, resourceType, amount) : ans;
  }

  pickup(t: Resource, opt?: TravelToOptions) {
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.pickup(t) : ans;
  }

  drop(resourceType: ResourceConstant, amount?: number) {
    return this.creep.drop(resourceType, amount);
  }

  getFleeOpt(opt: TravelToOptions) {
    if (!opt.maxRooms || opt.maxRooms > 4)
      opt.maxRooms = 4;
    opt.stuckValue = 1;
    let roomCallback = opt.roomCallback;
    opt.roomCallback = (roomName, matrix) => {
      if (roomCallback) {
        let postCallback = roomCallback(roomName, matrix);
        if (!postCallback || typeof postCallback === "boolean")
          return postCallback;
        matrix = postCallback;
      }
      let terrain = Game.map.getRoomTerrain(roomName);
      let enemies = Apiary.intel.getInfo(roomName).enemies.filter(e => e.dangerlvl >= 4).map(e => e.object);
      _.forEach(enemies, c => {
        let fleeDist = 0;
        if (c instanceof Creep)
          fleeDist = Apiary.intel.getFleeDist(c);
        if (!fleeDist)
          return;
        let rangeToEnemy = this.pos.getRangeTo(c);
        _.forEach(c.pos.getPositionsInRange(fleeDist), p => {
          if (p.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_RAMPART && (<StructureRampart>s).my && s.hits > 10000).length)
            return;
          let coef = terrain.get(p.x, p.y) === TERRAIN_MASK_SWAMP ? 5 : 1;
          let posRangeToEnemy = p.getRangeTo(c);
          let padding = 0x08 * Math.sign(posRangeToEnemy - rangeToEnemy); // we wan't to get as far as we can from enemy
          let val = Math.min(0x88, 0x20 * coef * (fleeDist + 1 - posRangeToEnemy) - padding);
          if (val > matrix.get(p.x, p.y))
            matrix.set(p.x, p.y, val);
        });
        matrix.set(c.pos.x, c.pos.y, 0xff);
      });
      return matrix;
    }
    return opt;
  }

  flee(posToFlee: ProtoPos, opt: TravelToOptions = {}) {
    let poss = this.pos.getOpenPositions(true);
    if (!poss.length)
      return ERR_NOT_FOUND;

    if (this.pos.isNearTo(posToFlee)) {
      let exit = this.pos.findClosest(Game.rooms[this.pos.roomName].find(FIND_EXIT));
      if (exit)
        posToFlee = exit;
    }

    opt = this.getFleeOpt(opt);
    /* let getTerrain = (pos: RoomPosition) => {
      let terrain: -2 | -1 | 0 | 1 | 2 = Game.map.getRoomTerrain(pos.roomName).get(pos.x, pos.y);
      let ss = pos.lookFor(LOOK_STRUCTURES);
      if (ss.filter(s => s.structureType === STRUCTURE_RAMPART && (<StructureRampart>s).my).length)
        terrain = -2;
      else if (ss.filter(s => s.structureType === STRUCTURE_ROAD).length)
        terrain = -1;
      return terrain;
    }

    let terrain_prev: -2 | -1 | 0 | 1 | 2 = Game.map.getRoomTerrain(poss[0].roomName).get(poss[0].x, poss[0].y)
    let open = poss.reduce((prev, curr) => {
      let ans = prev.getRangeTo(enemy) - curr.getRangeTo(enemy);
      let terrain_curr: -2 | -1 | 0 | 1 | 2 | undefined
      if (ans === 0) {
        terrain_curr = getTerrain(curr);
        ans = terrain_curr - terrain_prev;
      }
      if (ans === 0)
        ans = curr.getRangeTo(posToFlee) - prev.getRangeTo(posToFlee);
      if (ans < 0) {
        terrain_prev = terrain_curr || getTerrain(curr);
        return curr;
      }
      return prev;
    }); */
    this.memory._trav.path = undefined;
    let ans = this.goTo(posToFlee, opt);
    this.memory._trav.path = undefined;
    return ans;
  }

  static beesMove() {
    let moveMap: MoveMap = {};
    let chillMap: { [id: string]: ProtoBee<Creep | PowerCreep> } = {}
    Apiary.wrap(() => {
      for (const name in Apiary.bees) {
        let bee = Apiary.bees[name];
        if (bee.fatigue > 0) {
          chillMap[bee.pos.to_str] = bee;
          continue;
        }
        let p = bee.targetPosition;
        let priority = bee.master && bee.master.movePriority || 6;
        if (!p) {
          chillMap[bee.pos.to_str] = bee;
          continue;
        }
        let nodeId = p.to_str;
        if (!moveMap[nodeId])
          moveMap[nodeId] = [];
        moveMap[nodeId].push({ bee: bee, priority: priority });
      }
    }, "beesMove_moveMap", "run", Object.keys(Apiary.bees).length, false);
    Apiary.wrap(() => {
      for (const nodeId in moveMap) {
        let [, roomName, x, y] = /^(\w*)_(\d*)_(\d*)/.exec(nodeId)!;
        this.beeMove(moveMap, new RoomPosition(+x, +y, roomName), chillMap);
      }
    }, "beesMove_beeMove", "run", Object.keys(moveMap).length, false);
  }

  private static beeMove(moveMap: MoveMap, pos: RoomPosition, chillMap: { [id: string]: ProtoBee<Creep | PowerCreep> | undefined }): OK | ERR_FULL | ERR_NOT_FOUND {
    let beeIn = chillMap[pos.to_str];
    let red = (prev: InfoMove, curr: InfoMove) => curr.priority < prev.priority ? curr : prev;
    let bee;
    if (beeIn) {
      if (beeIn.fatigue > 0)
        return ERR_FULL;
      if (!beeIn.targetPosition) {
        bee = moveMap[pos.to_str].reduce(red).bee;
        if (bee.ref === beeIn.ref)
          return ERR_FULL;
        let target = beeIn.actionPosition ? beeIn.actionPosition : bee.pos;
        let open = beeIn.pos.getOpenPositions(true).filter(p => !moveMap[p.to_str]);
        if (!open.length)
          return ERR_NOT_FOUND;
        let pp = open.reduce((prev, curr) => {
          let ans = curr.getRangeTo(target) - prev.getRangeTo(target);
          if (ans === 0)
            ans = (chillMap[curr.to_str] ? 1 : 0) - (chillMap[prev.to_str] ? 1 : 0);
          if (ans === 0)
            ans = Game.map.getRoomTerrain(curr.roomName).get(curr.x, curr.y) - Game.map.getRoomTerrain(prev.roomName).get(prev.x, prev.y);
          return ans < 0 ? curr : prev;
        });
        moveMap[pp.to_str] = [{ bee: beeIn, priority: beeIn.master ? beeIn.master.movePriority : 6 }];
        let ans = this.beeMove(moveMap, pp, chillMap);
        if (ans !== OK)
          return ans;
      } else {
        let outPos = beeIn.targetPosition;
        // should i check that beeIn will be the max priority in outPos or it is too edge case?
        red = (prev: InfoMove, curr: InfoMove) => {
          let ans = curr.priority - prev.priority;
          if (ans === 0) {
            if (outPos.equal(curr.bee))
              return curr;
            if (outPos.equal(prev.bee))
              return prev;
          }
          return ans < 0 ? curr : prev
        }
        let winner = moveMap[pos.to_str].reduce(red);
        bee = winner.bee;
      }
    } else
      bee = moveMap[pos.to_str].reduce(red).bee;
    bee.creep.move(bee.pos.getDirectionTo(pos));
    return OK;
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
