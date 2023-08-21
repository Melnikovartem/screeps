import type { Master } from "../beeMasters/_Master";
import { beeStates } from "../enums";
import { profile } from "../profiler/decorator";
import {
  STATE_DEST_ROOMNAME,
  STATE_DEST_X,
  STATE_DEST_Y,
  STATE_STUCK,
} from "../Traveler/TravelerModified";

interface InfoMove {
  bee: ProtoBee<Creep | PowerCreep>;
  priority: number;
}
interface MoveMap {
  [id: string]: InfoMove[];
}

@profile
export abstract class ProtoBee<ProtoCreep extends Creep | PowerCreep> {
  public abstract master: Master | undefined;
  public abstract lifeTime: number;

  public creep: ProtoCreep;
  public ref: string;

  // target caching and states to have some tools to work with in masters

  public targetPosition: RoomPosition | undefined;
  public actionPosition: RoomPosition | undefined;

  // for now it will be forever binded
  public constructor(creep: ProtoCreep) {
    this.creep = creep;
    this.ref = creep.name;
    if (this.state === undefined) this.state = beeStates.idle;
    // not sure weather i should copy all parameters from creep like body and stuff
    Apiary.bees[this.creep.name] = this;
  }

  public abstract memory: CreepMemory | PowerCreepMemory;
  public abstract readonly fatigue: number;

  public get state() {
    return this.creep.memory.state;
  }

  public set state(state) {
    this.creep.memory.state = state;
  }

  public get target() {
    return this.creep.memory.target;
  }

  public set target(target) {
    this.creep.memory.target = target;
  }

  public get hits() {
    return this.creep.hits;
  }

  public get hitsMax() {
    return this.creep.hitsMax;
  }

  public get store() {
    return this.creep.store;
  }

  public get pos() {
    return this.creep.pos;
  }

  public get movePosition() {
    if (!this.memory._trav || !this.memory._trav.state) return undefined;
    const x = this.memory._trav.state[STATE_DEST_X];
    const y = this.memory._trav.state[STATE_DEST_Y];
    const roomName = this.memory._trav.state[STATE_DEST_ROOMNAME];
    return new RoomPosition(x, y, roomName);
  }

  public set movePosition(pos) {
    if (!pos || !this.memory._trav || !this.memory._trav.state) return;
    this.memory._trav.state[STATE_DEST_X] = pos.x;
    this.memory._trav.state[STATE_DEST_Y] = pos.y;
    this.memory._trav.state[STATE_DEST_ROOMNAME] = pos.roomName;
  }

  public get ticksToLive() {
    if (this.creep.ticksToLive) return this.creep.ticksToLive;
    else return this.lifeTime;
  }

  public update() {
    this.targetPosition = undefined;
    this.actionPosition = undefined;
  }

  // abstract static checkBees(): string;

  // for future: could path to open position near object for targets that require isNearTo
  // but is it worh in terms of CPU?
  public actionCheck(
    pos: RoomPosition,
    opt: TravelToOptions = {},
    range: number = 1
  ): ScreepsReturnCode {
    if (this.creep.pos.getRangeTo(pos) <= range) {
      this.actionPosition = pos;
      return OK;
    } else {
      opt.range =
        range > 1 &&
        this.pos.roomName !== pos.roomName &&
        (pos.x <= range ||
          pos.x >= 49 - range ||
          pos.y <= range ||
          pos.y >= 49 - range)
          ? 1
          : range;
      return this.goTo(pos, opt);
    }
  }

  public goRest(
    pos: RoomPosition,
    opt: TravelToOptions = {}
  ): ScreepsReturnCode {
    this.actionPosition = pos;
    if (pos.equal(this)) return OK;
    opt.range = opt.range || 2;
    this.goTo(pos, opt);
    if (
      this.targetPosition &&
      !this.targetPosition.isFree(false) &&
      pos.getRangeTo(this) <= 2
    ) {
      this.stop();
      if (this.pos.enteranceToRoom) {
        const notEnt = this.pos
          .getOpenPositions(false)
          .filter((p) => !p.enteranceToRoom);
        if (notEnt.length)
          this.targetPosition = notEnt.reduce((prev, curr) =>
            curr.getRangeTo(pos) < prev.getRangeTo(pos) ? curr : prev
          );
      }
      return OK;
    }
    return ERR_NOT_IN_RANGE;
  }

  public fleeRoom(roomName: string, opt?: TravelToOptions) {
    let roomToRest = this.pos.roomName;
    if (roomToRest === roomName) {
      const exits = Game.map.describeExits(roomName);
      const roomNames = Object.values(exits);
      roomToRest = roomNames[0];
      let roomInfo = Apiary.intel.getInfo(roomToRest, 50);
      for (let i = 1; i < roomNames.length; ++i) {
        const newRoomInfo = Apiary.intel.getInfo(roomNames[i], 50);
        if (
          newRoomInfo.dangerlvlmax < roomInfo.dangerlvlmax ||
          (newRoomInfo.dangerlvlmax === roomInfo.dangerlvlmax &&
            newRoomInfo.roomState < roomInfo.roomState)
        ) {
          roomInfo = newRoomInfo;
          roomToRest = roomNames[i];
        }
      }
      if (roomToRest === undefined) return ERR_NOT_FOUND;
    }
    return this.goRest(new RoomPosition(25, 25, roomToRest), opt);
  }

  public goToRoom(roomName: string, opt?: TravelToOptions): ScreepsReturnCode {
    return this.goTo(new RoomPosition(25, 25, roomName), opt);
  }

  public goTo(target: ProtoPos, opt: TravelToOptions = {}): ScreepsReturnCode {
    Apiary.intel.getInfo(this.pos.roomName, Infinity);
    const ans = this.creep.travelTo(target, opt);
    if (typeof ans === "number") {
      if (ans === OK) this.targetPosition = undefined;
      return ans;
    } else this.targetPosition = ans;
    return ERR_NOT_IN_RANGE;
  }

  public transfer(
    t: Structure,
    resourceType: ResourceConstant,
    amount?: number,
    opt?: TravelToOptions
  ): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.transfer(t, resourceType, amount) : ans;
  }

  public withdraw(
    t: Structure | Tombstone | Ruin,
    resourceType: ResourceConstant,
    amount?: number,
    opt?: TravelToOptions
  ): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.withdraw(t, resourceType, amount) : ans;
  }

  public pickup(t: Resource, opt?: TravelToOptions) {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.pickup(t) : ans;
  }

  public drop(resourceType: ResourceConstant, amount?: number) {
    return this.creep.drop(resourceType, amount);
  }

  public stop() {
    this.targetPosition = undefined;
    if (this.memory._trav) this.memory._trav.state[STATE_STUCK] = 0;
  }

  public getFleeOpt(opt: TravelToOptions) {
    if (!opt.maxRooms || opt.maxRooms > 4) opt.maxRooms = 3;
    opt.stuckValue = 1;
    opt.restrictDistance = 10;
    const roomCallback = opt.roomCallback;
    opt.roomCallback = (roomName, matrix) => {
      if (roomCallback) {
        const postCallback = roomCallback(roomName, matrix);
        if (typeof postCallback === "boolean") return postCallback;
        else if (postCallback) matrix = postCallback;
      }
      const terrain = Game.map.getRoomTerrain(roomName);
      const enemies = Apiary.intel
        .getInfo(roomName, 10)
        .enemies.map((e) => e.object);
      _.forEach(enemies, (c) => {
        let fleeDist = 0;
        if (c instanceof Creep) fleeDist = Apiary.intel.getFleeDist(c);
        if (!fleeDist) return;
        const rangeToEnemy = this.pos.getRangeTo(c);
        _.forEach(c.pos.getPositionsInRange(fleeDist), (p) => {
          if (
            p
              .lookFor(LOOK_STRUCTURES)
              .filter(
                (s) =>
                  s.structureType === STRUCTURE_RAMPART &&
                  (s as StructureRampart).my &&
                  s.hits > 10000
              ).length
          )
            return;
          const coef = terrain.get(p.x, p.y) === TERRAIN_MASK_SWAMP ? 5 : 1;
          const posRangeToEnemy = p.getRangeTo(c);
          const padding = 0x01 * Math.sign(posRangeToEnemy - rangeToEnemy); // we wan't to get as far as we can from enemy
          let val = Math.min(
            0x20,
            0x0a * coef * (fleeDist + 1 - posRangeToEnemy) - padding
          );
          if (terrain.get(p.x, p.y) === TERRAIN_MASK_WALL) val = 0xff; // idk why but sometimes the matrix is not with all walls...
          if (val > matrix.get(p.x, p.y)) matrix.set(p.x, p.y, val);
        });
      });
      return matrix;
    };
    return opt;
  }

  public flee(
    posToFlee: RoomPosition | null,
    opt: TravelToOptions = {},
    doExit: boolean = false
  ) {
    const poss = this.pos.getOpenPositions(true);
    if (!poss.length) return ERR_NOT_FOUND;

    if (!posToFlee || (this.pos.roomName === posToFlee.roomName && doExit)) {
      const roomInfo = Apiary.intel.getInfo(this.pos.roomName, 10);
      if (
        !posToFlee ||
        roomInfo.enemies.filter(
          (e) =>
            e.object instanceof Creep &&
            Apiary.intel.getFleeDist(e.object) + 1 >=
              this.pos.getRangeTo(e.object)
        ).length
      ) {
        const exit = this.pos.findClosest(
          Game.rooms[this.pos.roomName].find(FIND_EXIT)
        );
        if (exit) posToFlee = exit;
      }
    }
    opt = this.getFleeOpt(opt);
    this.memory._trav.path = undefined;
    const ans = this.goTo(
      posToFlee || new RoomPosition(25, 25, this.pos.roomName),
      opt
    );
    return ans;
  }

  public static beesMove() {
    const moveMap: MoveMap = {};
    const chillMap: { [id: string]: ProtoBee<Creep | PowerCreep> } = {};
    Apiary.wrap(
      () => {
        for (const name in Apiary.bees) {
          const bee = Apiary.bees[name];
          chillMap[bee.pos.to_str] = bee;
          if (bee.fatigue > 0) continue;
          const p = bee.targetPosition;
          const priority = (bee.master && bee.master.movePriority) || 6;
          if (!p) continue;
          const nodeId = p.to_str;
          if (!moveMap[nodeId]) moveMap[nodeId] = [];
          moveMap[nodeId].push({ bee, priority });
        }
      },
      "beesMove_moveMap",
      "run",
      Object.keys(Apiary.bees).length,
      false
    );
    Apiary.wrap(
      () => {
        for (const nodeId in moveMap) {
          const [, roomName, x, y] = /^(\w*)_(\d*)_(\d*)/.exec(nodeId)!;
          this.beeMove(moveMap, new RoomPosition(+x, +y, roomName), chillMap);
        }
      },
      "beesMove_beeMove",
      "run",
      Object.keys(moveMap).length,
      false
    );
  }

  private static beeMove(
    moveMap: MoveMap,
    pos: RoomPosition,
    chillMap: { [id: string]: ProtoBee<Creep | PowerCreep> | undefined }
  ): OK | ERR_FULL | ERR_NOT_FOUND {
    const beeIn = chillMap[pos.to_str];
    let red = (prev: InfoMove, curr: InfoMove) =>
      curr.priority < prev.priority ? curr : prev;
    let bee;
    if (beeIn) {
      if (beeIn.fatigue > 0) return ERR_FULL;
      if (!beeIn.targetPosition) {
        bee = moveMap[pos.to_str].reduce(red).bee;
        if (bee.ref === beeIn.ref) return ERR_FULL;
        const target = beeIn.actionPosition ? beeIn.actionPosition : bee.pos;
        const open = beeIn.pos
          .getOpenPositions(true)
          .filter((p) => !moveMap[p.to_str]);
        if (!open.length) return ERR_NOT_FOUND;
        const pp = open.reduce((prev, curr) => {
          let ans =
            (moveMap[curr.to_str] ? 1 : 0) - (moveMap[prev.to_str] ? 1 : 0);
          if (ans === 0)
            ans =
              (chillMap[curr.to_str] ? 1 : 0) - (chillMap[prev.to_str] ? 1 : 0);
          if (ans === 0)
            ans = curr.getRangeTo(target) - prev.getRangeTo(target);
          if (ans === 0)
            ans =
              Game.map.getRoomTerrain(curr.roomName).get(curr.x, curr.y) -
              Game.map.getRoomTerrain(prev.roomName).get(prev.x, prev.y);
          return ans < 0 ? curr : prev;
        });
        moveMap[pp.to_str] = [
          {
            bee: beeIn,
            priority: beeIn.master ? beeIn.master.movePriority : 6,
          },
        ];
        const ans = this.beeMove(moveMap, pp, chillMap);
        if (ans !== OK) return ans;
      } else {
        const outPos = beeIn.targetPosition;
        // should i check that beeIn will be the max priority in outPos or it is too edge case?
        red = (prev: InfoMove, curr: InfoMove) => {
          const ans = curr.priority - prev.priority;
          if (ans === 0) {
            if (outPos.equal(curr.bee)) return curr;
            if (outPos.equal(prev.bee)) return prev;
          }
          return ans < 0 ? curr : prev;
        };
        const winner = moveMap[pos.to_str].reduce(red);
        bee = winner.bee;
        if (outPos.equal(bee.pos)) {
          beeIn.creep.move(beeIn.pos.getDirectionTo(bee.pos));
          moveMap[bee.pos.to_str] = [
            {
              bee: beeIn,
              priority: beeIn.master ? beeIn.master.movePriority : 6,
            },
          ];
        }
      }
    } else bee = moveMap[pos.to_str].reduce(red).bee;
    bee.creep.move(bee.pos.getDirectionTo(pos));
    return OK;
  }

  public get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
