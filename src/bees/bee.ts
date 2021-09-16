import { states } from "../beeMasters/_Master";
import type { Master } from "../beeMasters/_Master";
import { profile } from "../profiler/decorator";

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
  state: states;
  target: string | null;

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

    if (!this.master && Apiary.masters[this.creep.memory.refMaster]) {
      this.master = Apiary.masters[this.creep.memory.refMaster];
      this.master.newBee(this);
    }
  }

  // for future: could path to open position near object for targets that require isNearTo
  // but is it worh in terms of CPU?
  actionCheck<Obj extends RoomObject | RoomPosition | undefined>(target: Obj, opt: TravelToOptions = {}, range: number = 1): number {
    if (!target)
      return ERR_NOT_FOUND;
    if (this.creep.pos.inRangeTo(target!, range))
      return OK;
    else {
      let targetPos = <RoomPosition>(target instanceof RoomObject && target.pos) || (target instanceof RoomPosition && target);
      if (range > 1 && targetPos.roomName !== this.pos.roomName)
        range = 1;
      opt.range = range;
      this.goTo(targetPos, opt);
    }
    return ERR_NOT_IN_RANGE;
  }

  goRest(pos: RoomPosition, opt?: TravelToOptions): number {
    if ((this.pos.x !== pos.x || this.pos.y !== pos.y) && (!this.pos.isNearTo(pos) || pos.isFree()) || this.pos.roomName !== pos.roomName)
      this.goTo(pos, opt);
    else
      return OK;
    return ERR_NOT_IN_RANGE;
  }

  goToRoom(roomName: string, opt?: TravelToOptions): number {
    return this.goTo(new RoomPosition(25, 25, roomName), opt);
  }

  goTo(target: RoomPosition | RoomObject, opt: TravelToOptions = {}): number {
    // opt.allowSK = true;
    /* Not sure how useful is this
    if (Game.cpu.bucket < 20 && Game.shard.name === "shard3") {
      // extreme low on cpu
      opt.maxOps = 2000;
      opt.maxRooms = 3;
      opt.useFindRoute = false;
      opt.ignoreCreeps = false;
    } */
    return this.creep.travelTo(target, opt);
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
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.attack(t!) : ans;
  }

  rangedAttack(t: Creep | Structure | PowerCreep | undefined, opt: TravelToOptions = {}): number {
    opt.movingTarget = true;
    let ans = this.actionCheck(t, opt, 3);
    return ans === OK ? this.creep.rangedAttack(t!) : ans;
  }

  heal(t: Creep | PowerCreep | Bee | undefined, opt: TravelToOptions = {}) {
    opt.movingTarget = true;
    if (t instanceof Bee)
      t = t.creep;
    let ans = this.actionCheck(t, opt);
    return ans === OK ? this.creep.heal(<Creep | PowerCreep>t) : ans;
  }

  rangedHeal(t: Creep | PowerCreep | Bee | undefined, opt: TravelToOptions = {}) {
    opt.movingTarget = true;
    if (t instanceof Bee)
      t = t.creep;
    let ans = this.actionCheck(t, opt, 3);
    return ans === OK ? this.creep.rangedHeal(<Creep | PowerCreep>t) : ans;
  }

  dismantle(t: Structure | undefined, opt?: TravelToOptions): number {
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
    // after all the masters where created and retrived if it was needed
    for (const name in Game.creeps) {
      let bee = Apiary.bees[name];
      if (!bee)
        Apiary.bees[name] = new Bee(Game.creeps[name]);
      else if (bee.state === states.idle) {
        let regex = /^masterDevelopmentCell_(.*)/.exec(bee.memory.refMaster);
        if (regex) {
          let viableMasters = _.map(_.filter(Apiary.masters, (m) => m.hive.roomName === regex![1]), (m) => m.ref);
          let randomMaster = viableMasters[Math.floor(Math.random() * viableMasters.length)];
          if (randomMaster) {
            bee.memory.refMaster = randomMaster;
            Apiary.masters[randomMaster].newBee(bee);
          }
        }
      }
    }
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
