import { beeStates } from "../enums";
import { profile } from "../profiler/decorator";
import type { Master } from "../beeMasters/_Master";

@profile
export class Bee {

  master: Master | undefined;
  creep: Creep;

  ref: string;
  pos: RoomPosition;
  store: Store<ResourceConstant, false>;
  memory: CreepMemory;
  hits: number;
  hitsMax: number;
  reusePath: number = 3;
  lifeTime: number = CREEP_LIFE_TIME;

  // target caching and states to have some tools to work with in masters
  state: beeStates;
  target?: string;

  targetPosition: RoomPosition | undefined;
  actionPosition: RoomPosition | undefined;

  // for now it will be forever binded
  constructor(creep: Creep) {
    this.creep = creep;

    this.ref = creep.name;
    this.pos = creep.pos;
    this.store = creep.store;
    this.memory = creep.memory;
    this.hits = creep.hits;
    this.hitsMax = creep.hitsMax;

    this.state = creep.memory.state;
    this.target = creep.memory.target;

    if (creep.getBodyParts(CLAIM))
      this.lifeTime = CREEP_CLAIM_LIFE_TIME;

    // not sure weather i should copy all parameters from creep like body and stuff
    Apiary.bees[this.creep.name] = this;
  }

  update() {
    this.creep = Game.creeps[this.ref];
    this.pos = this.creep.pos;
    this.store = this.creep.store;
    this.memory = this.creep.memory;
    this.hits = this.creep.hits;
    this.hitsMax = this.creep.hitsMax;

    this.creep.memory.state = this.state;
    this.creep.memory.target = this.target;

    this.targetPosition = undefined;
    this.actionPosition = undefined;

    if (!this.master && Apiary.masters[this.creep.memory.refMaster]) {
      this.master = Apiary.masters[this.creep.memory.refMaster];
      this.master.newBee(this);
    }
  }

  // for future: could path to open position near object for targets that require isNearTo
  // but is it worh in terms of CPU?
  actionCheck<Obj extends RoomObject | undefined>(target: Obj, opt: TravelToOptions = {}, range: number = 1): number {
    if (!target)
      return ERR_NOT_FOUND;
    if (this.creep.pos.inRangeTo(target!, range)) {
      this.actionPosition = target.pos;
      return OK;
    } else {
      let targetPos = <RoomPosition>(target instanceof RoomObject && target.pos) || (target instanceof RoomPosition && target);
      if (range > 1 && targetPos.roomName !== this.pos.roomName)
        range = 1;
      opt.range = range;
      return this.goTo(targetPos, opt);
    }
  }

  goRest(pos: RoomPosition, opt?: TravelToOptions): number {
    this.actionPosition = pos;
    if ((this.pos.x !== pos.x || this.pos.y !== pos.y) && (!this.pos.isNearTo(pos) || pos.isFree()) || this.pos.roomName !== pos.roomName)
      this.goTo(pos, opt);
    else
      return OK;
    return ERR_NOT_IN_RANGE;
  }

  goToRoom(roomName: string, opt?: TravelToOptions): number {
    return this.goTo(new RoomPosition(25, 25, roomName), opt);
  }

  goTo(target: RoomPosition | { pos: RoomPosition }, opt: TravelToOptions = {}): number {
    Apiary.intel.getInfo(this.pos.roomName, 50); // collect intel
    opt.allowSK = true;
    /* Not sure how useful is this
    if (Game.cpu.bucket < 20 && Game.shard.name === "shard3") {
      // extreme low on cpu
      opt.maxOps = 2000;
      opt.maxRooms = 3;
      opt.useFindRoute = false;
      opt.ignoreCreeps = false;
    } */
    let ans = this.creep.travelTo(target, opt);
    if (typeof ans === "number")
      return ans;
    else
      this.targetPosition = ans;
    if (target instanceof RoomPosition)
      target = { pos: target };

    return ERR_NOT_IN_RANGE;
  }

  getBodyParts(partType: BodyPartConstant, boosted: 1 | 0 | -1 = 0): number {
    return this.creep.getBodyParts(partType, boosted);
  }

  getActiveBodyParts(partType: BodyPartConstant): number {
    return this.creep.getBodyParts(partType, undefined, true);
  }

  transfer(t: Structure | undefined, resourceType: ResourceConstant, amount?: number, opt?: TravelToOptions): number {
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.transfer(t!, resourceType, amount) : ans;
  }

  withdraw(t: Structure | Tombstone | Ruin | undefined, resourceType: ResourceConstant, amount?: number, opt?: TravelToOptions): number {
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.withdraw(t!, resourceType, amount) : ans;
  }

  pickup(t: Resource | undefined, opt?: TravelToOptions) {
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.pickup(t!) : ans;
  }

  attack(t: Creep | Structure | PowerCreep | undefined, opt: TravelToOptions = {}): number {
    opt.movingTarget = true;
    opt.goInDanger = true;
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.attack(t!) : ans;
  }

  rangedAttack(t: Creep | Structure | PowerCreep | undefined, opt: TravelToOptions = {}): number {
    opt.movingTarget = true;
    opt.goInDanger = true;
    let ans = this.actionCheck(t, opt, 3);
    return ans === OK ? this.creep.rangedAttack(t!) : ans;
  }

  heal(t: Creep | PowerCreep | Bee | undefined, opt: TravelToOptions = {}) {
    opt.movingTarget = true;
    opt.goInDanger = true;
    if (t instanceof Bee)
      t = t.creep;
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.heal(<Creep | PowerCreep>t) : ans;
  }

  rangedHeal(t: Creep | PowerCreep | Bee | undefined, opt: TravelToOptions = {}) {
    opt.movingTarget = true;
    opt.goInDanger = true;
    if (t instanceof Bee)
      t = t.creep;
    let ans = this.actionCheck(t, opt, 3);
    return ans === OK ? this.creep.rangedHeal(<Creep | PowerCreep>t) : ans;
  }

  dismantle(t: Structure | undefined, opt: TravelToOptions = {}): number {
    opt.goInDanger = true;
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.dismantle(t!) : ans;
  }

  harvest(t: Source | Mineral | undefined, opt?: TravelToOptions): number {
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.harvest(t!) : ans;
  }


  build(t: ConstructionSite | undefined, opt?: TravelToOptions): number {
    let ans = this.actionCheck(t, opt, 3);
    return ans === OK ? this.creep.build(t!) : ans;
  }

  repair(t: Structure | undefined, opt?: TravelToOptions): number {
    let ans = this.actionCheck(t, opt, 3);
    return ans === OK ? this.creep.repair(t!) : ans;
  }

  upgradeController(t: StructureController | undefined, opt?: TravelToOptions): number {
    let ans = this.actionCheck(t, opt, 3);
    return ans === OK ? this.creep.upgradeController(t!) : ans;
  }

  reserveController(t: StructureController | undefined, opt?: TravelToOptions): number {
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.reserveController(t!) : ans;
  }

  claimController(t: StructureController | undefined, opt?: TravelToOptions): number {
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.claimController(t!) : ans;
  }

  attackController(t: StructureController | undefined, opt?: TravelToOptions): number {
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.attackController(t!) : ans;
  }

  repairRoadOnMove(ans: number = ERR_NOT_IN_RANGE) {
    if (ans === ERR_NOT_IN_RANGE)
      return this.repair(_.filter(this.pos.lookFor(LOOK_STRUCTURES), (s) => s.hits < s.hitsMax)[0]);
    return ans;
  }

  static checkBees() {
    for (const name in Game.creeps) {
      let bee = Apiary.bees[name];
      if (!bee)
        Apiary.bees[name] = new Bee(Game.creeps[name]);
      else if (bee.state === beeStates.idle) {
        // F bee is list
      }
    }
  }

  static beesMove() {
    type InfoMove = { bee: Bee, priority: number };
    let moveMap: { [id: string]: InfoMove[] } = {};
    for (const name in Apiary.bees) {
      let bee = Apiary.bees[name];
      if (bee.creep.fatigue > 0)
        continue;
      let p = bee.targetPosition;
      let priority = bee.master ? bee.master.movePriority : 6;
      if (priority < 2 && !p)
        p = bee.pos; // 0 and 1 won't move
      if (!p)
        continue;
      let nodeId = p.roomName + "_" + p.x + "_" + p.y;
      if (!moveMap[nodeId])
        moveMap[nodeId] = [];
      moveMap[nodeId].push({ bee: bee, priority: priority });
    }

    for (const nodeId in moveMap) {
      let [, roomName, x, y] = /(\w*)_(\d*)_(\d*)/.exec(nodeId)!;
      let pos = new RoomPosition(+x, +y, roomName);
      let creepIn: Creep | undefined;
      if (roomName in Game.rooms)
        creepIn = pos.lookFor(LOOK_CREEPS).filter((c) => c.my)[0];
      let red = (prev: InfoMove, curr: InfoMove) => curr.priority < prev.priority ? curr : prev;
      let bee;
      if (creepIn) {
        if (creepIn.fatigue > 0)
          continue;
        let beeIn = Apiary.bees[creepIn.name];
        if (!beeIn.targetPosition) {
          bee = moveMap[nodeId].reduce(red).bee;
          if (bee.ref === creepIn.name)
            continue;
          let target = beeIn.actionPosition ? beeIn.actionPosition : bee.pos;
          let pp = beeIn.pos.getOpenPositions(true).filter((p) => !moveMap[p.roomName + "_" + p.x + "_" + p.y])
            .reduce((prev, curr) => curr.getRangeTo(target) < prev.getRangeTo(target) ? curr : prev);
          if (pp) {
            moveMap[pp.roomName + "_" + pp.x + "_" + pp.y] = [{ bee: beeIn, priority: beeIn.master ? beeIn.master.movePriority : 6 }];
            beeIn.creep.move(bee.pos.getDirectionTo(pp))
          } else
            continue;
        } else {
          let outPos = beeIn.targetPosition;
          // should i check that beeIn will be the max priority in outPos or it is too edge case?
          red = (prev: InfoMove, curr: InfoMove) => {
            if (curr.bee.pos.x === outPos.x && curr.bee.pos.y === outPos.y)
              return curr;
            if (prev.bee.pos.x === outPos.x && prev.bee.pos.y === outPos.y)
              return prev;
            return curr.priority < prev.priority ? curr : prev
          };
          bee = moveMap[nodeId].reduce(red).bee;
        }
      } else
        bee = moveMap[nodeId].reduce(red).bee;
      bee.creep.move(bee.pos.getDirectionTo(pos));
    }
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
