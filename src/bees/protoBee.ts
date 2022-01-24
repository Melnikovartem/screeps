import { beeStates } from "../enums";
import { profile } from "../profiler/decorator";
import { STATE_STUCK, STATE_DEST_X, STATE_DEST_Y, STATE_DEST_ROOMNAME } from "../Traveler/TravelerModified";
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

  get movePosition() {
    if (!this.memory._trav || !this.memory._trav.state)
      return undefined;
    let x = this.memory._trav.state[STATE_DEST_X];
    let y = this.memory._trav.state[STATE_DEST_Y];
    let roomName = this.memory._trav.state[STATE_DEST_ROOMNAME];
    return new RoomPosition(x, y, roomName);
  }

  set movePosition(pos) {
    if (!pos || !this.memory._trav || !this.memory._trav.state)
      return;
    this.memory._trav.state[STATE_DEST_X] = pos.x;
    this.memory._trav.state[STATE_DEST_Y] = pos.y;
    this.memory._trav.state[STATE_DEST_ROOMNAME] = pos.roomName;
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
      opt.range = range > 1 && this.pos.roomName !== pos.roomName
        && (pos.x <= range || pos.x >= 49 - range || pos.y <= range || pos.y >= 49 - range) ? 1 : range;
      return this.goTo(pos, opt);
    }
  }

  goRest(pos: RoomPosition, opt: TravelToOptions = {}): ScreepsReturnCode {
    this.actionPosition = pos;
    if (pos.equal(this))
      return OK;
    opt.range = opt.range || 2;
    this.goTo(pos, opt);
    if (this.targetPosition && !this.targetPosition.isFree(false) && pos.getRangeTo(this) <= 2) {
      this.stop();
      if (this.pos.enteranceToRoom) {
        let notEnt = this.pos.getOpenPositions(false).filter(p => !p.enteranceToRoom);
        if (notEnt.length)
          this.targetPosition = notEnt.reduce((prev, curr) => curr.getRangeTo(pos) < prev.getRangeTo(pos) ? curr : prev);
      }
      return OK;
    }
    return ERR_NOT_IN_RANGE;
  }

  fleeRoom(roomName: string, opt?: TravelToOptions) {
    let roomToRest = this.pos.roomName;
    if (roomToRest === roomName) {
      let exits = Game.map.describeExits(roomName);
      let roomNames = <string[]>Object.values(exits);;
      roomToRest = roomNames[0];
      let roomInfo = Apiary.intel.getInfo(roomToRest, 50);
      for (let i = 1; i < roomNames.length; ++i) {
        let newRoomInfo = Apiary.intel.getInfo(roomNames[i], 50);
        if (newRoomInfo.dangerlvlmax < roomInfo.dangerlvlmax || (newRoomInfo.dangerlvlmax === roomInfo.dangerlvlmax && newRoomInfo.roomState < roomInfo.roomState)) {
          roomInfo = newRoomInfo;
          roomToRest = roomNames[i];
        }
      }
      if (roomToRest === undefined)
        return ERR_NOT_FOUND;
    }
    return this.goRest(new RoomPosition(25, 25, roomToRest), opt);
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

  stop() {
    this.targetPosition = undefined;
    if (this.memory._trav)
      this.memory._trav.state[STATE_STUCK] = 0;
  }

  getFleeOpt(opt: TravelToOptions) {
    if (!opt.maxRooms || opt.maxRooms > 4)
      opt.maxRooms = 3;
    opt.stuckValue = 1;
    opt.restrictDistance = 10;
    let roomCallback = opt.roomCallback;
    opt.roomCallback = (roomName, matrix) => {
      if (roomCallback) {
        let postCallback = roomCallback(roomName, matrix);
        if (typeof postCallback === "boolean")
          return postCallback;
        else if (postCallback)
          matrix = postCallback;
      }
      let terrain = Game.map.getRoomTerrain(roomName);
      let enemies = Apiary.intel.getInfo(roomName, 10).enemies.map(e => e.object);
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
          let padding = 0x01 * Math.sign(posRangeToEnemy - rangeToEnemy); // we wan't to get as far as we can from enemy
          let val = Math.min(0x20, 0x0A * coef * (fleeDist + 1 - posRangeToEnemy) - padding);
          if (terrain.get(p.x, p.y) === TERRAIN_MASK_WALL)
            val = 0xff; // idk why but sometimes the matrix is not with all walls...
          if (val > matrix.get(p.x, p.y))
            matrix.set(p.x, p.y, val);
        });
      });
      return matrix;
    }
    return opt;
  }

  flee(posToFlee: RoomPosition | null, opt: TravelToOptions = {}, doExit: boolean = false) {
    let poss = this.pos.getOpenPositions(true);
    if (!poss.length)
      return ERR_NOT_FOUND;

    if (!posToFlee || this.pos.roomName === posToFlee.roomName && doExit) {
      let roomInfo = Apiary.intel.getInfo(this.pos.roomName, 10);
      if (!posToFlee || roomInfo.enemies.filter(e => e.object instanceof Creep
        && Apiary.intel.getFleeDist(e.object) + 1 >= this.pos.getRangeTo(e.object)).length) {
        let exit = this.pos.findClosest(Game.rooms[this.pos.roomName].find(FIND_EXIT));
        if (exit)
          posToFlee = exit;
      }
    }
    opt = this.getFleeOpt(opt);
    this.memory._trav.path = undefined;
    let ans = this.goTo(posToFlee || new RoomPosition(25, 25, this.pos.roomName), opt);
    return ans;
  }

  static beesMove() {
    let moveMap: MoveMap = {};
    let chillMap: { [id: string]: ProtoBee<Creep | PowerCreep> } = {}
    Apiary.wrap(() => {
      for (const name in Apiary.bees) {
        let bee = Apiary.bees[name];
        chillMap[bee.pos.to_str] = bee;
        if (bee.fatigue > 0)
          continue;
        let p = bee.targetPosition;
        let priority = bee.master && bee.master.movePriority || 6;
        if (!p)
          continue;
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
          let ans = (moveMap[curr.to_str] ? 1 : 0) - (moveMap[prev.to_str] ? 1 : 0);
          if (ans === 0)
            ans = (chillMap[curr.to_str] ? 1 : 0) - (chillMap[prev.to_str] ? 1 : 0);
          if (ans === 0)
            ans = curr.getRangeTo(target) - prev.getRangeTo(target);
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
        if (outPos.equal(bee.pos)) {
          beeIn.creep.move(beeIn.pos.getDirectionTo(bee.pos));
          moveMap[bee.pos.to_str] = [{ bee: beeIn, priority: beeIn.master ? beeIn.master.movePriority : 6 }];
        }
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
