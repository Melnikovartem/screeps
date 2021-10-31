import { HordeDefenseMaster } from "./beeMasters/war/hordeDefense";
import { HordeMaster } from "./beeMasters/war/horde";
import { DowngradeMaster } from "./beeMasters/war/downgrader";
import { DismanleBoys } from "./beeMasters/squads/dismatleBoys";
import { AnnoyOBot } from "./beeMasters/squads/annoyObot";
import { WaiterMaster } from "./beeMasters/war/waiter";

import { GangDuo } from "./beeMasters/squads/gangDuo";
import { GangQuad } from "./beeMasters/squads/quadSquad";
// import { TestSquad } from "./beeMasters/squads/test";

import { DupletMaster } from "./beeMasters/civil/miningDuplet";
import { PuppetMaster } from "./beeMasters/civil/puppet";
import { PortalMaster } from "./beeMasters/civil/portal";
import { AnnexMaster } from "./beeMasters/civil/annexer";
import { PickupMaster } from "./beeMasters/civil/pickup";
import { ClaimerMaster } from "./beeMasters/civil/claimer";
import { SKMaster } from "./beeMasters/civil/safeSK";

import { hiveStates, prefix, roomStates } from "./enums";
import { makeId, findOptimalResource } from "./abstract/utils";
import { REACTION_MAP } from "./cells/stage1/laboratoryCell";
import { BOOST_MINERAL } from "./cells/stage1/laboratoryCell";

import { LOGGING_CYCLE } from "./settings";
import { profile } from "./profiler/decorator";

import type { ReactionConstant } from "./cells/stage1/laboratoryCell";
import type { SwarmMaster } from "./beeMasters/_SwarmMaster";
import type { Hive, HivePositions } from "./Hive";

@profile
export class Order {
  flag: Flag;
  master?: SwarmMaster;
  hive: Hive;
  acted: boolean = false;
  prevpos: string = "";

  get ref() {
    return this.flag.name;
  }

  constructor(flag: Flag) {
    this.flag = flag;

    if (this.memory.hive) {
      this.hive = Apiary.hives[this.memory.hive];
      if (!this.hive)
        return;
    } else {
      let filter: (h: Hive) => boolean = h => h.phase >= 2;;
      switch (this.color) {
        case COLOR_CYAN:
          filter = h => h.roomName === this.pos.roomName && h.phase >= 1;
          break;
        case COLOR_PURPLE:
          if (this.secondaryColor === COLOR_WHITE)
            filter = h => h.roomName !== this.pos.roomName && h.state === hiveStates.economy && h.phase > 0;
          if (this.secondaryColor !== COLOR_PURPLE)
            break;
        case COLOR_YELLOW: case COLOR_WHITE: case COLOR_GREY: case COLOR_BLUE:
          filter = _ => true;
          break;
        case COLOR_RED:
          let parsed = /_room\_([WE][0-9]+[NS][0-9]+)$/.exec(this.ref);
          if (parsed)
            filter = h => h.roomName === parsed![1];
          break;
      }
      this.hive = this.findHive(filter);
    }
    let newMemory: FlagMemory = {
      hive: this.hive.roomName,
      info: this.memory.info,
      repeat: this.memory.repeat,
      extraPos: this.memory.extraPos,
      extraInfo: this.memory.extraInfo,
    };
    this.flag.memory = newMemory;
  }

  get memory() {
    return this.flag.memory;
  }

  findHive(filter: (h: Hive) => boolean = () => true): Hive {
    if (Apiary.hives[this.pos.roomName] && filter(Apiary.hives[this.pos.roomName]))
      return Apiary.hives[this.pos.roomName];

    for (const k in Game.map.describeExits(this.pos.roomName)) {
      let exit = Game.map.describeExits(this.pos.roomName)[<ExitKey>k];
      if (exit && Apiary.hives[exit] && filter(Apiary.hives[exit]))
        return Apiary.hives[exit];
    }

    // well time to look for faraway boys
    let validHives = _.filter(Apiary.hives, filter);
    if (!validHives.length)
      validHives = _.map(Apiary.hives);

    let bestHive = validHives.pop()!; // if i don't have a single hive wtf am i doing
    let dist = this.pos.getRoomRangeTo(bestHive);
    _.forEach(validHives, h => {
      let newDist = this.pos.getRoomRangeTo(h);
      if (newDist < dist) {
        dist = newDist;
        bestHive = h;
      }
    });
    return bestHive;
  }

  uniqueFlag(local: boolean = true) {
    if (this.pos.roomName in Game.rooms) {
      _.forEach(Game.flags, f => {
        if (f.color === this.color && f.secondaryColor === this.secondaryColor
          && (!local || f.pos.roomName === this.pos.roomName) && f.name !== this.ref && Apiary.orders[f.name])
          Apiary.orders[f.name].delete();
      });
      return OK;
    }
    return ERR_NOT_FOUND;
  }

  fixedName(name: string) {
    if (this.ref !== name && this.pos.roomName in Game.rooms) {
      if (!(name in Game.flags))
        this.pos.createFlag(name, this.color, this.secondaryColor);
      this.delete(true);
      return false;
    }
    return true;
  }

  act() {
    this.acted = true;
    switch (this.color) {
      case COLOR_RED:
        this.flag.memory.repeat = this.flag.memory.repeat ? this.flag.memory.repeat : 0;
        if (!this.master)
          switch (this.secondaryColor) {
            case COLOR_BLUE:
              this.master = new HordeDefenseMaster(this);
              break;
            case COLOR_RED:
              this.master = new HordeMaster(this);
              let regex = /^\d*/.exec(this.ref);
              if (regex && regex[0])
                this.master.maxSpawns = +regex[0];
              break;
            case COLOR_PURPLE:
              this.master = new DowngradeMaster(this);
              break;
            case COLOR_GREEN:
              this.master = new WaiterMaster(this);
              break;
            case COLOR_ORANGE:
              this.master = new GangDuo(this);
              break;
            case COLOR_GREY:
              this.master = new GangQuad(this);
              break;
            case COLOR_YELLOW:
              this.master = new DismanleBoys(this);
              break;
            case COLOR_BROWN:
              this.master = new AnnoyOBot(this);
              break;
            case COLOR_CYAN:
              this.master = new SKMaster(this);
              break;
            case COLOR_WHITE:
              this.fixedName(prefix.surrender + this.hive.roomName);
              if (!this.flag.memory.info)
                this.flag.memory.info = Game.time;
              if (Game.time - this.flag.memory.info > CREEP_LIFE_TIME)
                this.delete();
              this.acted = false;
              break;
          }
        break;
      case COLOR_PURPLE:
        switch (this.secondaryColor) {
          case COLOR_PURPLE:
            if (this.pos.getRoomRangeTo(this.hive) > 5) {
              this.delete(true);
              break;
            }

            if (this.hive.addAnex(this.pos.roomName) !== OK) {
              if (this.hive.cells.observe)
                Apiary.requestSight(this.pos.roomName)
              else if (!this.master && !Game.flags[prefix.puppet + this.pos.roomName]) {
                this.master = new PuppetMaster(this);
                this.master.maxSpawns = this.master.spawned + 1;
              }
              this.acted = false;
              break;
            }

            if (this.master instanceof PuppetMaster) {
              let nonClaim = this.master.beesAmount;
              _.forEach(this.master.bees, b => !b.getBodyParts(CLAIM) ? b.creep.memory.refMaster = prefix.master + prefix.swarm + prefix.puppet + this.pos.roomName : --nonClaim);
              if (nonClaim) {
                let ans = this.pos.createFlag(prefix.puppet + this.pos.roomName, COLOR_GREY, COLOR_PURPLE);
                if (typeof ans === "string")
                  Game.flags[ans].memory = { hive: this.hive.roomName, info: this.master.spawned };
              }
              this.master.delete();
              this.master = undefined;
            }

            if (!this.fixedName(prefix.annex + this.pos.roomName))
              break;

            if (!this.master) {
              let roomState = Apiary.intel.getInfo(this.pos.roomName, Infinity).roomState;
              switch (roomState) {
                case roomStates.ownedByMe:
                  break;
                case roomStates.reservedByEnemy:
                case roomStates.reservedByInvader:
                case roomStates.noOwner:
                case roomStates.reservedByMe:
                  this.master = new AnnexMaster(this);
                  break;
                case roomStates.SKfrontier:
                  this.master = new SKMaster(this);
                  if (!this.hive.resTarget[BOOST_MINERAL.rangedAttack[0]])
                    this.hive.resTarget[BOOST_MINERAL.rangedAttack[0]] = 0
                  this.hive.resTarget[BOOST_MINERAL.rangedAttack[0]]! += LAB_BOOST_MINERAL * MAX_CREEP_SIZE;
                default:
                  this.delete();
              }
            }
            break;
          case COLOR_GREY:
            if (Object.keys(Apiary.hives).length < Game.gcl.level) {
              if (!this.master)
                this.master = new ClaimerMaster(this);
            } else
              this.delete();
            break;
          case COLOR_WHITE:
            this.acted = false;
            let hiveToBoos = Apiary.hives[this.pos.roomName];
            if (!hiveToBoos || this.pos.roomName === this.hive.roomName) {
              this.delete();
              break;
            }

            if (!this.fixedName(prefix.boost + this.pos.roomName))
              break;

            if (this.hive.state !== hiveStates.economy) {
              hiveToBoos.bassboost = null;
              break;
            }

            if (hiveToBoos.bassboost) {
              if (this.hive.phase > 0 && hiveToBoos.state === hiveStates.economy)
                this.delete();
              break;
            }

            hiveToBoos.bassboost = this.hive;
            hiveToBoos.spawOrders = {};
            _.forEach(this.hive.cells, c => {
              if (c.master)
                c.master.waitingForBees = 0;
            });
            if (hiveToBoos.cells.dev && hiveToBoos.cells.dev.master)
              hiveToBoos.cells.dev.master.recalculateTargetBee();
            break;
        }
        break;
      case COLOR_CYAN:
        this.uniqueFlag();
        if (this.hive.roomName === this.pos.roomName) {
          let type: keyof HivePositions | undefined;
          switch (this.secondaryColor) {
            case COLOR_CYAN:
              type = "rest";
              _.forEach(this.hive.cells.excavation.resourceCells, cell => {
                cell.restTime = Infinity;
              });
              break;
            case COLOR_GREEN:
              type = "queen1";
              break;
            case COLOR_YELLOW:
              type = "queen2";
              break;
            case COLOR_GREY:
              type = "lab";
              break;
            case COLOR_WHITE:
              type = "center";
              _.forEach(this.hive.cells.excavation.resourceCells, cell => {
                cell.roadTime = Infinity;
              });
              break;
          }
          if (type) {
            Memory.cache.hives[this.hive.roomName].positions[type] = { x: this.pos.x, y: this.pos.y };
            let active = Apiary.planner.activePlanning[this.hive.roomName];
            if (active)
              active.poss[type] = { x: this.pos.x, y: this.pos.y }
          }
        }
        this.delete();
        break;
      case COLOR_WHITE:
        if (this.secondaryColor !== COLOR_PURPLE && this.secondaryColor !== COLOR_RED)
          _.forEach(Game.flags, f => {
            if (f.color === COLOR_WHITE && f.secondaryColor !== COLOR_PURPLE && f.name !== this.ref && Apiary.orders[f.name])
              Apiary.orders[f.name].delete();
          });

        switch (this.secondaryColor) {
          case COLOR_BLUE:
            let baseRotation: ExitConstant = BOTTOM;
            if (this.ref.includes("right"))
              baseRotation = RIGHT;
            else if (this.ref.includes("up"))
              baseRotation = TOP;
            else if (this.ref.includes("left"))
              baseRotation = LEFT;

            Apiary.planner.generatePlan(this.pos, baseRotation, !this.ref.includes("safe"));
            break;
          case COLOR_ORANGE:
            if (Memory.cache.roomPlanner[this.pos.roomName] && Object.keys(Memory.cache.roomPlanner[this.pos.roomName]).length) {
              Apiary.planner.toActive(this.hive.pos, this.pos.roomName);
              if (this.hive.shouldRecalc < 3)
                if (this.hive.roomName === this.pos.roomName)
                  this.hive.shouldRecalc = 1;
                else
                  this.hive.shouldRecalc = 2;
            } else
              this.delete();
            break;
          case COLOR_RED:
            switch (this.ref) {
              case "all":
                Apiary.planner.currentToActive(this.pos.roomName, this.hive.pos);
                break;
              case "add":
                if (!Apiary.planner.activePlanning[this.pos.roomName])
                  Apiary.planner.toActive(this.hive.pos, this.pos.roomName);
                Apiary.planner.addToPlan(this.pos, this.pos.roomName, undefined, true);
                _.forEach(this.pos.lookFor(LOOK_STRUCTURES), s => {
                  if (s.structureType in CONTROLLER_STRUCTURES)
                    Apiary.planner.addToPlan(this.pos, this.pos.roomName, <BuildableStructureConstant>s.structureType, true);
                });
                _.forEach(this.pos.lookFor(LOOK_CONSTRUCTION_SITES), s => {
                  if (s.structureType in CONTROLLER_STRUCTURES)
                    Apiary.planner.addToPlan(this.pos, this.pos.roomName, s.structureType, true);
                });
                break;
              default:
                if (!Apiary.planner.activePlanning[this.pos.roomName])
                  Apiary.planner.toActive(this.hive.pos, this.pos.roomName);
                let sType = this.ref.split("_")[0];
                if (sType === "wall")
                  sType = STRUCTURE_WALL;
                if (sType in CONTROLLER_STRUCTURES)
                  Apiary.planner.addToPlan(this.pos, this.pos.roomName, <BuildableStructureConstant>sType, true);
                else if (sType === "norampart") {
                  let plan = Apiary.planner.activePlanning[this.pos.roomName].plan;
                  if (plan[this.pos.x] && plan[this.pos.x][this.pos.y])
                    plan[this.pos.x][this.pos.y].r = false;
                } else
                  Apiary.planner.addToPlan(this.pos, this.pos.roomName, undefined, true);
            }
            this.acted = false;
            break;
          case COLOR_GREEN:
            let del: 0 | 1 | 2 = 0;
            for (let name in Apiary.planner.activePlanning) {
              if (Apiary.planner.activePlanning[name].correct !== "ok")
                del = 1;
            }
            if (!del || /^force/.exec(this.ref)) {
              for (let name in Apiary.planner.activePlanning) {
                console.log("SAVED: ", name, Apiary.planner.activePlanning[name].anchor);
                Apiary.planner.saveActive(name);
                delete Apiary.planner.activePlanning[name];
              }
              if (!Object.keys(Apiary.planner.activePlanning).length)
                del = 2;
            }
            if (del > 1) {
              _.forEach(this.hive.cells.excavation.resourceCells, cell => {
                cell.roadTime = Infinity;
                cell.restTime = Infinity;
              });
              this.delete();
              this.pos.createFlag("OK_" + makeId(4), COLOR_WHITE, COLOR_ORANGE);
            } else if (del === 1)
              this.pos.createFlag("FAIL_" + makeId(4), COLOR_WHITE, COLOR_ORANGE);
            break;
          case COLOR_PURPLE:
            let planner = false;
            _.forEach(Game.flags, f => {
              if (f.color === COLOR_WHITE && f.secondaryColor === COLOR_WHITE && Apiary.orders[f.name] && Game.time !== Apiary.createTime) {
                Apiary.orders[f.name].acted = false;
                planner = true;
              }
            });
            if (!planner)
              Apiary.planner.addCustomRoad(this.hive.pos, this.pos);
            break;
          case COLOR_YELLOW:
            Apiary.planner.addResourceRoads(this.hive.pos, true);
            break;
        }
        break;
      case COLOR_ORANGE:
        if (!this.master)
          switch (this.secondaryColor) {
            case COLOR_GREEN:
              if (!this.master) {
                let hive = Apiary.hives[this.pos.roomName];
                if (hive && hive.cells.storage && !this.ref.includes("manual")) {
                  let targets: (Tombstone | Ruin | Resource | StructureStorage)[] = this.pos.lookFor(LOOK_RESOURCES).filter(r => r.amount > 0);
                  targets = targets.concat(this.pos.lookFor(LOOK_RUINS).filter(r => r.store.getUsedCapacity() > 0));
                  targets = targets.concat(this.pos.lookFor(LOOK_TOMBSTONES).filter(r => r.store.getUsedCapacity() > 0));
                  let resources: Resource[] = [];
                  _.forEach(targets, t => {
                    if (t instanceof Resource)
                      resources.push(t);
                    else
                      hive.cells.storage!.requestToStorage([t], 1, findOptimalResource(t.store));
                  });
                  hive.cells.storage.requestToStorage(resources, 1, undefined);
                  if (!targets.length)
                    this.delete();
                  this.acted = false;
                  return;
                }
                this.master = new PickupMaster(this);
                let regex = /^\d*/.exec(this.ref);
                if (regex && regex[0])
                  this.master.maxSpawns = +regex[0];
                this.master.targetBeeCount = this.master.maxSpawns;
              }
              break;
            case COLOR_YELLOW:
              this.master = new DupletMaster(this);
              break;
          }
        break;
      case COLOR_BLUE:
        if (this.hive.roomName !== this.pos.roomName) {
          this.delete();
          break;
        }
        switch (this.secondaryColor) {
          case COLOR_CYAN:
            if (!this.hive.cells.lab) {
              this.delete();
              break;
            }
            this.hive.cells.lab.synthesizeRes = undefined;
            this.hive.cells.lab.prod = undefined;
            if (this.ref.includes("produce")) {
              let final = <ReactionConstant>this.flag.name.split("_")[1];
              if (!final || !REACTION_MAP[final]) {
                this.delete();
                break;
              }
              this.hive.cells.lab.synthesizeTarget = { res: final, amount: Infinity };
            } else {
              this.hive.cells.lab.synthesizeTarget = undefined;
              this.fixedName(prefix.haltlab + this.hive.roomName);
            }
            break;
          case COLOR_YELLOW:
            this.fixedName(prefix.upgrade + this.hive.roomName);
            break;
          case COLOR_WHITE:
            this.fixedName(prefix.build + this.hive.roomName);
            break;
          case COLOR_RED:
            this.fixedName(prefix.nukes + this.hive.roomName);
            if (this.ref === prefix.nukes + this.hive.roomName)
              this.hive.cells.defense.updateNukes();
            break;
          case COLOR_ORANGE:
            this.fixedName(prefix.terminal + this.hive.roomName);
            break;
        }
        break;
      case COLOR_GREY:
        switch (this.secondaryColor) {
          case COLOR_BROWN:
            let parsed = /(sell|buy)_(.*)$/.exec(this.ref);
            let res = parsed && <ResourceConstant>parsed[2];
            let mode = parsed && parsed[1];
            this.acted = false;
            if (res && mode && this.hive.roomName === this.pos.roomName && this.hive.cells.storage && this.hive.cells.storage.terminal) {
              let hurry = this.ref.includes("hurry");
              if ("all" === parsed![2]) {
                if (mode === "sell") {
                  if (hurry || Game.time % 10 === 0)
                    _.forEach(Object.keys(this.hive.cells.storage.storage.store).concat(Object.keys(this.hive.cells.storage.terminal.store)), ress => {
                      if (ress === RESOURCE_ENERGY)
                        return;
                      // get rid of shit in this hive
                      Apiary.broker.sellOff(this.hive.cells.storage!.terminal!, <ResourceConstant>ress, 500, hurry, Infinity);
                    });
                } else
                  this.delete();
                return;
              }
              if (RESOURCES_ALL.includes(res)) {
                if (hurry || Game.time % 10 === 0)
                  if (mode === "sell" && this.hive.cells.storage.getUsedCapacity(res) + this.hive.cells.storage.terminal.store.getUsedCapacity(res))
                    Apiary.broker.sellOff(this.hive.cells.storage.terminal, res, 500, hurry, this.ref.includes("noinf") ? undefined : Infinity);
                  else if (mode === "buy" && this.hive.cells.storage.getUsedCapacity(res) < 4096)
                    Apiary.broker.buyIn(this.hive.cells.storage.terminal, res, 500, hurry, this.ref.includes("noinf") ? undefined : Infinity);
                  else if (this.ref.includes("nokeep"))
                    this.delete();
              } else
                this.delete();
            } else
              this.delete();
            break;
          case COLOR_RED:
            if (this.ref.includes("keep"))
              break;
            this.acted = false;
            if (this.pos.roomName in Game.rooms && this.pos.lookFor(LOOK_STRUCTURES).length === 0)
              this.delete();
            break;
          case COLOR_PURPLE:
            if (!this.master)
              this.master = new PuppetMaster(this);
            break;
          case COLOR_BLUE:
            if (!this.master)
              this.master = new PortalMaster(this);
            break;
        }
        break;
      case COLOR_YELLOW:
        if (this.pos.getRoomRangeTo(this.hive) >= 5) {
          this.delete();
          break;
        }
        if (this.pos.roomName in Game.rooms) {
          let resource: Source | Mineral | undefined;
          switch (this.secondaryColor) {
            case COLOR_YELLOW:
              resource = this.pos.lookFor(LOOK_SOURCES)[0];
              if (resource) {
                this.hive.cells.excavation.addResource(resource);
              } else
                this.delete();
              break;
            case COLOR_CYAN:
              resource = this.pos.lookFor(LOOK_MINERALS)[0];
              if (resource) {
                if (this.hive.cells.excavation)
                  this.hive.cells.excavation.addResource(resource);
              } else
                this.delete();
              break;
          }
        } else
          this.acted = false;
        break;
    }
  }

  // what to do when delete if something neede
  delete(force = false) {
    if (!force && this.flag.memory.repeat && this.flag.memory.repeat > 0) {
      if (!Memory.log.orders)
        Memory.log.orders = {};
      if (LOGGING_CYCLE) Memory.log.orders[this.ref + "_" + this.flag.memory.repeat] = {
        time: Game.time,
        name: this.flag.name,
        pos: this.pos,
        destroyTime: Game.time,
        master: this.master ? true : false,
      }
      this.flag.memory.repeat -= 1;
      if (this.master)
        Apiary.masters[this.master.ref].delete();
      this.acted = false;
      return;
    }

    if (LOGGING_CYCLE) {
      if (!Memory.log.orders)
        Memory.log.orders = {};
      Memory.log.orders[this.ref] = {
        time: Game.time,
        name: this.flag.name,
        pos: this.pos,
        destroyTime: Game.time,
        master: this.master ? true : false,
      }
    }

    switch (this.color) {
      case COLOR_PURPLE:
        switch (this.secondaryColor) {
          case COLOR_WHITE:
            let hiveBoosted = Apiary.hives[this.pos.roomName];
            if (hiveBoosted) {
              hiveBoosted.bassboost = null;
              if (hiveBoosted.cells.dev && hiveBoosted.cells.dev.master)
                hiveBoosted.cells.dev.master.recalculateTargetBee();

              let pos = hiveBoosted.room.controller && hiveBoosted.room.controller.pos;
              if (pos) {
                let newPos = [new RoomPosition(pos.x, pos.y + 1, pos.roomName), new RoomPosition(pos.x, pos.y - 1, pos.roomName)]
                  .filter(p => p.lookFor(LOOK_FLAGS).length == 0)[0] || new RoomPosition(pos.x, pos.y, pos.roomName);
                newPos.createFlag(prefix.upgrade + hiveBoosted.roomName, COLOR_GREY, COLOR_YELLOW);
              }
            }
            break;
          case COLOR_PURPLE:
            if (!force)
              return;
            break;
        }
        break;
      case COLOR_BLUE:
        switch (this.secondaryColor) {
          case COLOR_YELLOW:
            if (this.ref == prefix.upgrade + this.hive.roomName && this.pos.roomName === this.hive.roomName && this.hive.cells.upgrade) {
              this.hive.cells.upgrade.master.waitingForBees = 0;
              for (const key in this.hive.spawOrders)
                if (key.includes(this.hive.cells.upgrade.master.ref))
                  delete this.hive.spawOrders[key];
            }
            break;
          case COLOR_GREY:
            if (this.hive.cells.lab) {
              this.hive.cells.lab.synthesizeTarget = undefined;
              this.hive.cells.lab.synthesizeRes = undefined;
              this.hive.cells.lab.prod = undefined;
            }
            break;
          case COLOR_RED:
            this.hive.cells.defense.updateNukes();
            break;
        }
        break;
      case COLOR_RED:
        for (const key in Apiary.defenseSwarms)
          if (Apiary.defenseSwarms[key].ref === this.ref)
            delete Apiary.defenseSwarms[key];
        break;
      case COLOR_WHITE:
        if (!_.filter(Apiary.orders, o => {
          if (o.flag.color !== COLOR_WHITE)
            return false;
          if (o.flag.secondaryColor === COLOR_PURPLE) {
            o.flag.remove();
            return false;
          }
          return o.ref !== this.ref;
        }).length) {
          for (let name in Apiary.planner.activePlanning)
            delete Apiary.planner.activePlanning[name];
        }
        break;
    }

    if (this.master)
      this.master.delete();
    this.master = undefined;

    this.flag.remove();
    delete Apiary.orders[this.ref];
  }

  get pos() {
    return this.flag.pos;
  }

  get color() {
    return this.flag.color;
  }

  get secondaryColor() {
    return this.flag.secondaryColor;
  }


  update() {
    this.flag = Game.flags[this.ref];
    this.acted = this.acted && this.prevpos === this.pos.to_str;
    this.prevpos = this.pos.to_str;
    if (!this.acted)
      this.act();
  }

  static checkFlags() {
    for (const name in Game.flags)
      if (!Apiary.orders[name]) {
        let order = new this(Game.flags[name]);
        if (order.hive)
          Apiary.orders[name] = order;
        else
          Game.flags[name].remove();
      }
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
