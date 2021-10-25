import { beeStates, prefix } from "../enums";
import { profile } from "../profiler/decorator";
import { setupsNames } from "../enums";
import type { Master } from "../beeMasters/_Master";

type InfoMove = { bee: Bee, priority: number };
type MoveMap = { [id: string]: InfoMove[] };

@profile
export class Bee {

  master: Master | undefined;
  creep: Creep;

  ref: string;
  reusePath: number = 3;
  lifeTime: number;

  // target caching and states to have some tools to work with in masters

  targetPosition: RoomPosition | undefined;
  actionPosition: RoomPosition | undefined;

  boosted = false;

  // for now it will be forever binded
  constructor(creep: Creep) {
    this.creep = creep;
    this.ref = creep.name;

    if (this.state === undefined)
      this.state = beeStates.idle;

    this.lifeTime = this.getBodyParts(CLAIM) ? CREEP_CLAIM_LIFE_TIME : CREEP_LIFE_TIME;
    this.boosted = !!this.body.filter(b => b.boost).length

    // not sure weather i should copy all parameters from creep like body and stuff
    Apiary.bees[this.creep.name] = this;
  }

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

  get body() {
    return this.creep.body;
  }

  get ticksToLive() {
    if (this.creep.ticksToLive)
      return this.creep.ticksToLive;
    else
      return this.lifeTime;
  }

  get memory() {
    return this.creep.memory;
  }

  update() {
    this.creep = Game.creeps[this.ref];

    this.targetPosition = undefined;
    this.actionPosition = undefined;

    if (!this.master) {
      if (!Apiary.masters[this.creep.memory.refMaster])
        this.creep.memory.refMaster = this.findMaster();
      if (Apiary.masters[this.creep.memory.refMaster]) {
        this.master = Apiary.masters[this.creep.memory.refMaster];
        this.master.newBee(this);
      }
    }
  }

  findMaster() {
    if (this.ref.includes(setupsNames.hauler)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.excavationCell))); // && m.beesAmount <= m.targetBeeCount + 2));
      if (refMaster)
        return refMaster;
    } else if (this.ref.includes(setupsNames.bootstrap)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.developmentCell)));
      if (refMaster)
        return refMaster;
    } else if (this.ref.includes(setupsNames.claimer)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.claim)));
      if (refMaster)
        return refMaster;
      refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.annex)));
      if (refMaster)
        return refMaster;
      refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.activeBees.length < 1 && m.ref.includes("downgrade")));
      if (refMaster)
        return refMaster;
    } else if (this.ref.includes(setupsNames.defender)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.defenseCell)));
      if (refMaster)
        return refMaster;
    } else if (this.ref.includes(setupsNames.knight)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes("harass")));
      if (refMaster)
        return refMaster;
    }
    /* else if (this.ref.includes(setupsNames.healer) || this.ref.includes(setupsNames.dismantler)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes("dismantle")));
      if (refMaster)
        return refMaster;
    }
    }*/
    return this.creep.memory.refMaster === undefined ? "" : this.creep.memory.refMaster;
  }

  findClosestByHive(masters: Master[]) {
    if (!masters.length)
      return null;
    let ans = masters.reduce((prev, curr) => curr.hive.pos.getRoomRangeTo(this) < prev.hive.pos.getRoomRangeTo(this) ? curr : prev);
    if (ans.hive.pos.getRoomRangeTo(this) * 25 > this.ticksToLive)
      return null;
    return ans.ref;
  }

  // for future: could path to open position near object for targets that require isNearTo
  // but is it worh in terms of CPU?
  actionCheck<Obj extends RoomObject | undefined | null>(target: Obj, opt: TravelToOptions = {}, range: number = 1): ScreepsReturnCode {
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
    Apiary.intel.getInfo(this.pos.roomName, 50); // collect intel
    /* Not sure how useful is this
    if (Game.cpu.bucket < 20 && Game.shard.name === "shard3") {
      // extreme low on cpu
      opt.maxOps = 2000;
      opt.maxRooms = 3;
      opt.useFindRoute = false;
      opt.ignoreCreeps = false;
    } */
    let ans = this.creep.travelTo(target, opt);
    if (typeof ans === "number") {
      if (ans === OK)
        this.targetPosition = undefined;
      return ans;
    } else
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

  transfer(t: Structure | undefined | null, resourceType: ResourceConstant, amount?: number, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.transfer(t!, resourceType, amount) : ans;
  }

  withdraw(t: Structure | Tombstone | Ruin | undefined | null, resourceType: ResourceConstant, amount?: number, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.withdraw(t!, resourceType, amount) : ans;
  }

  pickup(t: Resource | undefined | null, opt?: TravelToOptions) {
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.pickup(t!) : ans;
  }

  attack(t: Creep | Structure | PowerCreep | undefined | null, opt: TravelToOptions = {}): ScreepsReturnCode {
    opt.movingTarget = true;
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.attack(t!) : ans;
  }

  rangedAttack(t: Creep | Structure | PowerCreep | undefined | null, opt: TravelToOptions = {}): ScreepsReturnCode {
    opt.movingTarget = true;
    let ans = this.actionCheck(t, opt, 3);
    if (t && this.pos.getRangeTo(t) <= 1 && "owner" in t)
      return this.creep.rangedMassAttack();
    return ans === OK ? this.creep.rangedAttack(t!) : ans;
  }

  rangedMassAttack(): ScreepsReturnCode {
    return this.creep.rangedMassAttack();
  }

  heal(t: Creep | PowerCreep | Bee | undefined | null, opt: TravelToOptions = {}) {
    opt.movingTarget = true;
    if (t instanceof Bee)
      t = t.creep;
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.heal(<Creep | PowerCreep>t) : ans;
  }

  rangedHeal(t: Creep | PowerCreep | Bee | undefined | null, opt: TravelToOptions = {}) {
    opt.movingTarget = true;
    if (t instanceof Bee)
      t = t.creep;
    let ans = this.actionCheck(t, opt, 3);
    return ans === OK ? this.creep.rangedHeal(<Creep | PowerCreep>t) : ans;
  }

  dismantle(t: Structure | undefined | null, opt: TravelToOptions = {}): ScreepsReturnCode {
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.dismantle(t!) : ans;
  }

  harvest(t: Source | Mineral | undefined | null, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.harvest(t!) : ans;
  }


  build(t: ConstructionSite | undefined | null, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t, opt, 3);
    return ans === OK ? this.creep.build(t!) : ans;
  }

  repair(t: Structure | undefined | null, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t, opt, 3);
    return ans === OK ? this.creep.repair(t!) : ans;
  }

  upgradeController(t: StructureController | undefined | null, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t, opt, 3);
    return ans === OK ? this.creep.upgradeController(t!) : ans;
  }

  reserveController(t: StructureController | undefined | null, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.reserveController(t!) : ans;
  }

  claimController(t: StructureController | undefined | null, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.claimController(t!) : ans;
  }

  attackController(t: StructureController | undefined | null, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.attackController(t!) : ans;
  }

  repairRoadOnMove(ans: number = ERR_NOT_IN_RANGE) {
    if (ans === ERR_NOT_IN_RANGE)
      return this.repair(_.filter(this.pos.lookFor(LOOK_STRUCTURES), s => s.hits < s.hitsMax)[0]);
    return ans;
  }

  flee(enemy: Creep | Structure | PowerCreep, posToFlee: ProtoPos, opt?: TravelToOptions) {
    let poss = this.pos.getOpenPositions(true);
    if (!poss.length)
      return ERR_NOT_FOUND;

    let getTerrain = (pos: RoomPosition) => {
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
    });
    return this.goTo(open, opt);
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
    let moveMap: MoveMap = {};
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
      let nodeId = p.to_str;
      if (!moveMap[nodeId])
        moveMap[nodeId] = [];
      moveMap[nodeId].push({ bee: bee, priority: priority });
    }

    for (const nodeId in moveMap) {
      let [, roomName, x, y] = /^(\w*)_(\d*)_(\d*)/.exec(nodeId)!;
      this.beeMove(moveMap, new RoomPosition(+x, +y, roomName));
    }
  }

  private static beeMove(moveMap: MoveMap, pos: RoomPosition): OK | ERR_FULL | ERR_NOT_FOUND {
    let creepIn: Creep | undefined | null;
    if (pos.roomName in Game.rooms)
      creepIn = pos.lookFor(LOOK_CREEPS).filter(c => c.my)[0];
    let red = (prev: InfoMove, curr: InfoMove) => curr.priority < prev.priority ? curr : prev;
    let bee;
    if (creepIn) {
      if (creepIn.fatigue > 0)
        return ERR_FULL;
      let beeIn = Apiary.bees[creepIn.name];
      if (!beeIn.targetPosition) {
        bee = moveMap[pos.to_str].reduce(red).bee;
        if (bee.ref === beeIn.ref)
          return ERR_FULL;
        let target = beeIn.actionPosition ? beeIn.actionPosition : bee.pos;
        let open = beeIn.pos.getOpenPositions(true).filter(p => !moveMap[p.roomName + "_" + p.x + "_" + p.y]);
        if (!open.length)
          return ERR_NOT_FOUND;
        let pp = open.reduce((prev, curr) => {
          let ans = curr.getRangeTo(target) - prev.getRangeTo(target);
          if (ans === 0)
            ans = curr.lookFor(LOOK_CREEPS).length - prev.lookFor(LOOK_CREEPS).length;
          if (ans === 0)
            ans = Game.map.getRoomTerrain(curr.roomName).get(curr.x, curr.y) - Game.map.getRoomTerrain(prev.roomName).get(prev.x, prev.y);
          return ans < 0 ? curr : prev;
        });
        moveMap[pp.to_str] = [{ bee: beeIn, priority: beeIn.master ? beeIn.master.movePriority : 6 }];
        let ans = this.beeMove(moveMap, pp);
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
        };
        bee = moveMap[pos.to_str].reduce(red).bee;
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
