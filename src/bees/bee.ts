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
      refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.builder)));
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
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.def)));
      if (refMaster)
        return refMaster;
      /* refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.defenseCell)));
      if (refMaster)
        return refMaster;*/
    } else if (this.ref.includes(setupsNames.knight)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.activeBees.length < 1 && m.ref.includes("harass")));
      if (refMaster)
        return refMaster;
      refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes("harass")));
      if (refMaster)
        return refMaster;
      refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.def)));
      if (refMaster)
        return refMaster;
    } else if (this.ref.includes(setupsNames.builder)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.builder)));
      if (refMaster)
        return refMaster;
    } else if (this.ref.includes(setupsNames.healer) || this.ref.includes(setupsNames.dismantler)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes("dismantle")));
      if (refMaster)
        return refMaster;
    }
    /* else if (this.ref.includes(setupsNames.miner)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.beesAmount < 1 && m.ref.includes(prefix.resourceCells)));
      if (refMaster)
        return refMaster;
    } */
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
    let ans = masters.reduce((prev, curr) => {
      let ans = curr.hive.pos.getRoomRangeTo(this) - prev.hive.pos.getRoomRangeTo(this);
      if (ans === 0)
        ans = (prev.targetBeeCount - prev.beesAmount) - (curr.targetBeeCount - curr.beesAmount);
      return ans < 0 ? curr : prev
    });
    if (ans.hive.pos.getRoomRangeTo(this) * 25 > this.ticksToLive)
      return null;
    return ans.ref;
  }

  // for future: could path to open position near object for targets that require isNearTo
  // but is it worh in terms of CPU?
  actionCheck(pos: RoomPosition, opt: TravelToOptions = {}, range: number = 1): ScreepsReturnCode {
    if (this.creep.pos.getRangeTo(pos) <= range) {
      this.actionPosition = pos;
      return OK;
    } else {
      /* if (range > 1 && pos.roomName !== this.pos.roomName)
        range = 1; */
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
    Apiary.intel.getInfo(this.pos.roomName, 50);
    let ans = this.creep.travelTo(target, opt);
    if (typeof ans === "number") {
      if (ans === OK)
        this.targetPosition = undefined;
      return ans;
    } else
      this.targetPosition = ans;
    return ERR_NOT_IN_RANGE;
  }

  getBodyParts(partType: BodyPartConstant, boosted: 1 | 0 | -1 = 0): number {
    return this.creep.getBodyParts(partType, boosted);
  }

  getActiveBodyParts(partType: BodyPartConstant): number {
    return this.creep.getBodyParts(partType, undefined, true);
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

  pull(t: Bee, pos: RoomPosition, opt: TravelToOptions): ScreepsReturnCode {
    if (!this.pos.isNearTo(t)) {
      let tEnt = t.pos.getEnteranceToRoom();
      if (!tEnt || tEnt.roomName !== this.pos.roomName) {
        if (opt.obstacles)
          opt.obstacles.push({ pos: t.pos })
        else
          opt.obstacles = [{ pos: t.pos }]
        this.goTo(t, opt);
      }
      return OK;
    }
    this.goTo(this.pos.equal(pos) ? t.pos : pos, opt);
    if (this.targetPosition && this.targetPosition.roomName !== this.pos.roomName && this.pos.getEnteranceToRoom()) {
      let anotherExit = this.pos.getOpenPositions(true).filter(p => p.getEnteranceToRoom() && p.getRangeTo(this) === 1)[0];
      if (anotherExit)
        this.targetPosition = anotherExit;
    }
    return this.creep.pull(t.creep) || t.creep.move(this.creep);
  }

  attack(t: Creep | Structure | PowerCreep, opt: TravelToOptions = {}): ScreepsReturnCode {
    opt.movingTarget = true;
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.attack(t) : ans;
  }

  rangedAttack(t: Creep | Structure | PowerCreep, opt: TravelToOptions = {}): ScreepsReturnCode {
    opt.movingTarget = true;
    let ans = this.actionCheck(t.pos, opt, 3);
    if (t && this.pos.getRangeTo(t) <= 1 && "owner" in t)
      return this.creep.rangedMassAttack();
    return ans === OK ? this.creep.rangedAttack(t) : ans;
  }

  rangedMassAttack(): ScreepsReturnCode {
    return this.creep.rangedMassAttack();
  }

  heal(t: Creep | PowerCreep | Bee, opt: TravelToOptions = {}) {
    opt.movingTarget = true;
    if (t instanceof Bee)
      t = t.creep;
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.heal(t) : ans;
  }

  rangedHeal(t: Creep | PowerCreep | Bee, opt: TravelToOptions = {}) {
    opt.movingTarget = true;
    if (t instanceof Bee)
      t = t.creep;
    let ans = this.actionCheck(t.pos, opt, 3);
    return ans === OK ? this.creep.rangedHeal(t) : ans;
  }

  dismantle(t: Structure, opt: TravelToOptions = {}): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.dismantle(t) : ans;
  }

  harvest(t: Source | Mineral | Deposit, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.harvest(t) : ans;
  }

  build(t: ConstructionSite, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt, 3);
    if (ans === OK && this.pos.getEnteranceToRoom())
      this.goTo(t);
    return ans === OK ? this.creep.build(t) : ans;
  }

  repair(t: Structure, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt, 3);
    if (ans === OK && this.pos.getEnteranceToRoom())
      this.goTo(t);
    return ans === OK ? this.creep.repair(t) : ans;
  }

  upgradeController(t: StructureController, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt, 3);
    return ans === OK ? this.creep.upgradeController(t) : ans;
  }

  reserveController(t: StructureController, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.reserveController(t) : ans;
  }

  claimController(t: StructureController, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.claimController(t) : ans;
  }

  attackController(t: StructureController, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.attackController(t) : ans;
  }

  repairRoadOnMove(ans: ScreepsReturnCode = ERR_NOT_IN_RANGE): ScreepsReturnCode {
    if (ans === ERR_NOT_IN_RANGE) {
      let road = _.filter(this.pos.lookFor(LOOK_STRUCTURES), s => s.hits < s.hitsMax && s.structureType === STRUCTURE_ROAD)[0];
      if (road)
        return this.repair(road);
    }
    return ans;
  }

  getFleeOpt(opt: TravelToOptions) {
    if (!opt.maxRooms || opt.maxRooms > 2)
      opt.maxRooms = 2;
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
          let padding = 0x10 * Math.sign(posRangeToEnemy - rangeToEnemy); // we wan't to get as far as we can from enemy
          let val = Math.min(0xf0, 0x32 * coef * (fleeDist + 1 - posRangeToEnemy) - padding);
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
      if (priority === 0 && !p)
        p = bee.pos; // 0 won't move
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
        let open = beeIn.pos.getOpenPositions(true).filter(p => !moveMap[p.to_str]);
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
        }
        let winner = moveMap[pos.to_str].reduce(red);
        bee = winner.bee;
        /* if (bee.pos.to_str !== pos.to_str && winner.priority <= 2) {
          // i know still can softlock, but this can solve most important cases
          let inPos = moveMap[pos.to_str].filter(m => m.bee.pos.to_str == pos.to_str)[0];
          if (inPos) {
            let open = beeIn.pos.getOpenPositions(true).filter(p => !moveMap[p.to_str]);
            if (!open.length)
              return ERR_NOT_FOUND;
            let pp = open.reduce((prev, curr) => {
              let ans = curr.lookFor(LOOK_CREEPS).length - prev.lookFor(LOOK_CREEPS).length;
              if (ans === 0)
                ans = Game.map.getRoomTerrain(curr.roomName).get(curr.x, curr.y) - Game.map.getRoomTerrain(prev.roomName).get(prev.x, prev.y);
              return ans < 0 ? curr : prev;
            });
            moveMap[pp.to_str] = [{ bee: beeIn, priority: beeIn.master ? beeIn.master.movePriority : 6 }];
            let ans = this.beeMove(moveMap, pp);
            if (ans !== OK)
              return ans;
          }
        } */
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
