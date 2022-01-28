import { HordeDefenseMaster } from "./beeMasters/war/hordeDefense";
import { HordeMaster } from "./beeMasters/war/horde";
import { DowngradeMaster } from "./beeMasters/war/downgrader";
import { DismanleBoys } from "./beeMasters/squads/dismatleBoys";
import { AnnoyOBot } from "./beeMasters/squads/annoyObot";
import { WaiterMaster } from "./beeMasters/war/waiter";
import { SKMaster } from "./beeMasters/war/safeSK";

import { GangDuo } from "./beeMasters/squads/gangDuo";
import { GangQuad } from "./beeMasters/squads/quadSquad";
// import { TestSquad } from "./beeMasters/squads/test";

import { DepositMaster } from "./beeMasters/corridorMining/deposit";
import { PowerMaster } from "./beeMasters/corridorMining/power";

import { PuppetMaster } from "./beeMasters/civil/puppet";
import { PortalMaster } from "./beeMasters/civil/portal";
import { AnnexMaster } from "./beeMasters/civil/annexer";
import { PickupMaster } from "./beeMasters/civil/pickup";
import { HelpUpgradeMaster } from "./beeMasters/civil/helpUpgrade";
import { HelpTransferMaster } from "./beeMasters/civil/helpTransfer";
import { ContainerBuilderMaster } from "./beeMasters/civil/containerBuilder";
import { SignerMaster } from "./beeMasters/civil/randomSigner";
import { ClaimerMaster } from "./beeMasters/civil/claimer";

import { hiveStates, prefix, roomStates } from "./enums";
import { makeId, findOptimalResource } from "./abstract/utils";

import { profile } from "./profiler/decorator";

import type { SwarmMaster } from "./beeMasters/_SwarmMaster";
import type { Hive } from "./Hive";

const PASSIVE_BUILD_COLORS: number[] = [COLOR_PURPLE, COLOR_RED, COLOR_BROWN];

@profile
export class FlagOrder {
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
      if (!this.hive) {
        this.flag.remove();
        return;
      }
    } else {
      let filter: (h: Hive) => boolean = h => h.phase >= 2;
      let parsed: RegExpExecArray | null;
      switch (this.color) {
        case COLOR_CYAN:
          filter = h => h.roomName === this.pos.roomName && h.phase >= 1;
          break;
        case COLOR_PURPLE:
          if (this.secondaryColor === COLOR_WHITE)
            filter = h => h.roomName !== this.pos.roomName && h.state === hiveStates.economy && h.phase > 0;
          if (this.secondaryColor !== COLOR_PURPLE)
            break;
          parsed = /_room_([WE][0-9]+[NS][0-9]+)$/.exec(this.ref);
          if (parsed) {
            filter = h => h.roomName === parsed![1];
            break;
          }
        case COLOR_YELLOW: case COLOR_WHITE: case COLOR_GREY: case COLOR_BLUE:
          filter = _ => true;
          break;
        case COLOR_RED:
          parsed = /_room_([WE][0-9]+[NS][0-9]+)$/.exec(this.ref);
          if (parsed)
            filter = h => h.roomName === parsed![1];
          break;
      }
      this.hive = this.findHive(filter);
    }
    let newMemory: FlagMemory = {
      hive: this.hive.roomName,
      info: this.memory.info,
      extraPos: this.memory.extraPos,
      extraInfo: this.memory.extraInfo,
    };
    this.flag.memory = newMemory;
    Apiary.orders[this.ref] = this;
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
      validHives = _.map(Apiary.hives, h => h);

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
      if (!(name in Game.flags)) {
        let ans = this.pos.createFlag(name, this.color, this.secondaryColor);
        if (typeof ans === "string")
          Game.flags[ans].memory = this.memory;
      }
      this.delete();
      return false;
    }
    return true;
  }

  act() {
    this.acted = true;
    switch (this.color) {
      case COLOR_RED:
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
            if (this.pos.getRoomRangeTo(this.hive, true) >= 6) {
              this.delete();
              break;
            }

            if (!(this.pos.roomName in Game.rooms)) {
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
                  if (Apiary.hives[this.pos.roomName] && Apiary.hives[this.pos.roomName].phase > 0)
                    this.delete();
                  else
                    this.hive.addAnex(this.pos.roomName);
                  break;
                case roomStates.reservedByEnemy:
                case roomStates.reservedByInvader:
                case roomStates.noOwner:
                case roomStates.reservedByMe:
                  this.hive.addAnex(this.pos.roomName);
                  if (this.hive.room.energyCapacityAvailable < 650) {
                    this.master = new PuppetMaster(this);
                    this.master.maxSpawns = Infinity;
                  } else
                    this.master = new AnnexMaster(this);
                  break;
                case roomStates.SKfrontier:
                  if (this.hive.room.energyCapacityAvailable >= 5500) {
                    this.master = new SKMaster(this);
                    this.hive.addAnex(this.pos.roomName);
                  }
                  break;
                case roomStates.SKcentral:
                  if (this.hive.room.energyCapacityAvailable >= 5500)
                    this.hive.addAnex(this.pos.roomName);
                  this.master = new PuppetMaster(this);
                  this.master.maxSpawns = Infinity;
                  break;
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
              this.acted = false;
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
            _.forEach(Apiary.masters, c => {
              if (c.hive.roomName === this.pos.roomName)
                c.waitingForBees = 0;
            });
            if (hiveToBoos.cells.dev && hiveToBoos.cells.dev.master)
              hiveToBoos.cells.dev.master.recalculateTargetBee();
            break;
        }
        break;
      case COLOR_CYAN:
        this.uniqueFlag();
        if (this.hive.roomName === this.pos.roomName) {
          let cellType = "";
          let action = () => { };
          switch (this.secondaryColor) {
            case COLOR_BROWN:
              cellType = prefix.excavationCell;;
              action = () => _.forEach(this.hive.cells.excavation.resourceCells, cell => cell.restTime = cell.pos.getTimeForPath(this.hive.rest));
              break;
            case COLOR_CYAN:
              cellType = prefix.laboratoryCell;
              break;
            case COLOR_WHITE:
              cellType = prefix.defenseCell;
              action = () => _.forEach(this.hive.cells.excavation.resourceCells, cell => cell.roadTime = cell.pos.getTimeForPath(this.hive.pos));
              break;
            case COLOR_RED:
              cellType = prefix.powerCell;
              break;
            case COLOR_GREEN:
              cellType = prefix.fastRefillCell;
              break;
          }
          if (cellType) {
            if (!Memory.cache.hives[this.hive.roomName].cells[cellType])
              Memory.cache.hives[this.hive.roomName].cells[cellType] = {};
            Memory.cache.hives[this.hive.roomName].cells[cellType].poss = { x: this.pos.x, y: this.pos.y };
            action();
            if (Apiary.planner.activePlanning[this.hive.roomName]) {
              if (!Apiary.planner.activePlanning[this.hive.roomName].cellsCache[cellType])
                Apiary.planner.activePlanning[this.hive.roomName].cellsCache[cellType] = { poss: { x: this.pos.x, y: this.pos.y } };
              else
                Apiary.planner.activePlanning[this.hive.roomName].cellsCache[cellType].poss = { x: this.pos.x, y: this.pos.y };
            }
          }
        }
        this.delete();
        break;
      case COLOR_WHITE:
        if (!PASSIVE_BUILD_COLORS.includes(this.flag.secondaryColor))
          _.forEach(Apiary.orders, o => {
            if (o.color === COLOR_WHITE
              && (this.secondaryColor !== COLOR_BLUE || !PASSIVE_BUILD_COLORS.includes(o.secondaryColor))
              && o.ref !== this.ref)
              o.delete();
          });

        switch (this.secondaryColor) {
          case COLOR_BROWN:
            let room = Game.rooms[this.pos.roomName];
            if (room && room.controller && room.controller.my) {
              _.forEach(room.find(FIND_HOSTILE_STRUCTURES), s => s.destroy());
              _.forEach(room.find(FIND_HOSTILE_CONSTRUCTION_SITES), c => c.remove());
            }
            this.delete();
            break;
          case COLOR_BLUE:
            let baseRotation: ExitConstant = BOTTOM;
            if (this.ref.includes("right"))
              baseRotation = RIGHT;
            else if (this.ref.includes("top"))
              baseRotation = TOP;
            else if (this.ref.includes("left"))
              baseRotation = LEFT;
            Apiary.planner.generatePlan(this.pos, baseRotation);
            break;
          case COLOR_GREY:
            Apiary.planner.addUpgradeSite(this.hive.pos);
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
            if (this.pos.roomName in Game.rooms) {
              if (del > 1) {
                _.forEach(this.hive.cells.excavation.resourceCells, cell => {
                  cell.roadTime = Infinity;
                  cell.restTime = Infinity;
                  cell.operational = false;
                });
                this.delete();
                this.pos.createFlag("OK_" + makeId(4), COLOR_WHITE, COLOR_ORANGE);
              } else if (del === 1)
                this.pos.createFlag("FAIL_" + makeId(4), COLOR_WHITE, COLOR_ORANGE);
            } else
              this.flag.setColor(COLOR_WHITE, COLOR_ORANGE);
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
        if (!this.hive.cells.storage) {
          this.delete();
          break;
        }
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
            case COLOR_WHITE:
              if (Apiary.hives[this.pos.roomName])
                this.master = new HelpUpgradeMaster(this);
              else
                this.delete();
              break;
            case COLOR_GREY:
              if (Apiary.hives[this.pos.roomName])
                this.master = new HelpTransferMaster(this);
              else
                this.delete();
              break;
            case COLOR_YELLOW:
              if (this.hive.puller)
                this.master = new PowerMaster(this, this.hive.puller);
              break;
            case COLOR_BLUE:
              if (this.hive.puller)
                this.master = new DepositMaster(this, this.hive.puller);
              break;
          }
        break;
      case COLOR_BLUE:
        if (this.hive.roomName !== this.pos.roomName && this.secondaryColor !== COLOR_YELLOW) {
          this.delete();
          break;
        }
        switch (this.secondaryColor) {
          case COLOR_YELLOW:
            this.master = new ContainerBuilderMaster(this);
            break;
          case COLOR_PURPLE:
            this.master = new SignerMaster(this);
            break;
        }
        break;
      case COLOR_GREY:
        switch (this.secondaryColor) {
          case COLOR_BROWN:
            let parsed = /(sell|buy)_([A-Za-z0-9]*)(_\d*)?$/.exec(this.ref);
            let res = parsed && <ResourceConstant>parsed[2];
            let mode = parsed && parsed[1];
            this.acted = false;
            if (!Apiary.useBucket)
              break;
            if (res && mode && this.hive.roomName === this.pos.roomName && this.hive.cells.storage && this.hive.cells.storage.terminal) {
              let hurry = this.ref.includes("hurry");
              let fast = this.ref.includes("fast");
              let priceFix = parsed![3] && parsed![3].length > 1 && +parsed![3].slice(1);
              if ("all" === parsed![2]) {
                if (mode === "sell") {
                  // if (hurry || Game.time % 10 === 0)
                  Apiary.broker.update();
                  let getAmount = (res?: ResourceConstant) => this.hive.cells.storage!.storage.store.getUsedCapacity(res) + this.hive.cells.storage!.terminal!.store.getUsedCapacity(res);
                  _.forEach(Object.keys(this.hive.cells.storage.storage.store).concat(Object.keys(this.hive.cells.storage.terminal.store)), ress => {
                    let res = <ResourceConstant>ress;
                    if (res === RESOURCE_ENERGY && getAmount() - getAmount(RESOURCE_ENERGY) > 2 * getAmount(RESOURCE_ENERGY))
                      return;
                    // get rid of shit in this hive
                    Apiary.broker.sellOff(this.hive.cells.storage!.terminal!, res, Math.min(5000, getAmount(res))
                      , this.hive.cells.defense.isBreached, Infinity, hurry ? 10 : 100, priceFix || undefined);
                  });
                } else
                  this.delete();
                return;
              }
              if (RESOURCES_ALL.includes(res)) {
                if (hurry || Game.time % 10 === 0) {
                  switch (mode) {
                    case "sell":
                      if (this.hive.cells.storage.getUsedCapacity(res) + this.hive.cells.storage.terminal.store.getUsedCapacity(res) > 0) {
                        Apiary.broker.sellOff(this.hive.cells.storage.terminal, res, 500, hurry
                          , this.ref.includes("noinf") ? undefined : Infinity, fast ? 2 : 50, priceFix || undefined)
                        return;
                      }
                      break;
                    case "buy":
                      if (this.hive.cells.storage.getUsedCapacity(res) < (res === RESOURCE_ENERGY ? 500000 : 10000) * (fast ? 3 : 1)) {
                        Apiary.broker.buyIn(this.hive.cells.storage.terminal, res, (res === RESOURCE_ENERGY ? 16384 : 2048), hurry
                          , this.ref.includes("noinf") ? undefined : Infinity, fast ? 2 : 50, priceFix || undefined);
                        return;
                      }
                      break;
                  }
                  if (this.ref.includes("nokeep"))
                    this.delete();
                }
              } else
                this.delete();
            } else
              this.delete();
            break;
          case COLOR_RED:
            if (!this.memory.extraInfo)
              this.memory.extraInfo = Game.time;
            this.acted = false;
            if (Game.time % 25 !== 0)
              break;
            if (this.pos.roomName in Game.rooms && !this.pos.lookFor(LOOK_STRUCTURES).length || this.memory.extraInfo + 5000 < Game.time)
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
        if (this.pos.getRoomRangeTo(this.hive) >= 6) {
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
                this.hive.cells.excavation.addResource(resource);
              } else
                this.delete();
              break;
            case COLOR_RED:
              // do not mine the resource
              break;
          }
        } else
          this.acted = false;
        break;
    }
  }

  // what to do when delete if something neede
  delete() {

    if (Apiary.logger)
      Apiary.logger.reportOrder(this);

    switch (this.color) {
      case COLOR_PURPLE:
        switch (this.secondaryColor) {
          case COLOR_WHITE:
            let hiveBoosted = Apiary.hives[this.pos.roomName];
            if (hiveBoosted) {
              hiveBoosted.bassboost = null;
              if (hiveBoosted.cells.dev && hiveBoosted.cells.dev.master)
                hiveBoosted.cells.dev.master.recalculateTargetBee();
            }
            break;
          case COLOR_PURPLE:
            let index = this.hive.annexNames.indexOf(this.pos.roomName);
            if (index !== -1)
              this.hive.annexNames.splice(index, 1);
            if (!Apiary.hives[this.pos.roomName])
              _.forEach(_.filter(Game.flags, f => f.color === COLOR_YELLOW && f.pos.roomName === this.pos.roomName), f => f.remove());
            for (const ref in this.hive.cells.excavation.resourceCells)
              if (this.hive.cells.excavation.resourceCells[ref].pos.roomName === this.pos.roomName) {
                this.hive.cells.excavation.resourceCells[ref].master.delete();
                delete this.hive.cells.excavation.resourceCells[ref];
              }
            break;
        }
        break;
      case COLOR_RED:
        break;
      case COLOR_WHITE:
        if (!_.filter(Apiary.orders, o => {
          if (o.color !== COLOR_WHITE)
            return false;
          if (PASSIVE_BUILD_COLORS.includes(o.secondaryColor)) {
            if (this.secondaryColor !== COLOR_BLUE)
              o.flag.remove();
            return false;
          }
          return o.ref !== this.ref;
        }).length)
          for (let name in Apiary.planner.activePlanning)
            delete Apiary.planner.activePlanning[name];
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
      if (!Apiary.orders[name])
        new this(Game.flags[name]);
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
