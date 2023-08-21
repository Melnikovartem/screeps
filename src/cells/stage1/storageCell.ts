import { ManagerMaster } from "../../beeMasters/economy/manager";
import { TransferRequest } from "../../bees/transferRequest";
import { hiveStates, prefix } from "../../enums";
import type { Hive, ResTarget } from "../../Hive";
import { profile } from "../../profiler/decorator";
import { Cell } from "../_Cell";
import { BASE_MINERALS } from "./laboratoryCell";

export const TERMINAL_ENERGY = Math.round(TERMINAL_CAPACITY * 0.1);

export const ENERGY_FOR_REVERTING_TO_DEV_CELLS = 3000;
const EXTREMLY_LOW_ENERGY = 10000;

@profile
export class StorageCell extends Cell {
  public storage: StructureStorage | StructureTerminal;
  public link: StructureLink | undefined;
  public linkState:
    | { using: string; priority: 0 | 1; lastUpdated: number }
    | undefined;
  public terminal: StructureTerminal | undefined;
  public master: ManagerMaster;

  public requests: { [id: string]: TransferRequest } = {};
  public resTargetTerminal: { energy: number } & ResTarget = {
    energy: TERMINAL_ENERGY,
  };

  public usedCapacity: ResTarget = {};

  public constructor(
    hive: Hive,
    storage: StructureStorage | StructureTerminal
  ) {
    super(hive, prefix.storageCell + "_" + hive.room.name);
    this.storage = storage;
    this.terminal = this.hive.room.terminal;
    this.master = new ManagerMaster(this);
    this.findLink();
  }

  public requestFromStorage(
    objects: TransferRequest["to"][],
    priority: TransferRequest["priority"],
    res: TransferRequest["resource"],
    amount: number = Infinity,
    fitStore = false
  ): number {
    let sum = 0;
    let prev: TransferRequest | undefined;
    for (const obj of objects) {
      const ref = obj.id;
      const existing = this.requests[ref];
      let amountCC = amount;
      if (fitStore)
        amountCC = Math.min(
          amountCC,
          (obj.store as Store<ResourceConstant, false>).getFreeCapacity(res)
        );
      if (existing && existing.priority <= priority) {
        if (existing.resource === res && existing.to.id === ref)
          existing.amount = amountCC;
        continue;
      }
      if (amountCC <= 0) continue;
      const request = new TransferRequest(
        ref,
        this.storage,
        obj,
        priority,
        res,
        amountCC
      );
      if (!request.isValid()) continue;
      this.requests[ref] = request;
      if (prev) this.requests[ref].nextup = prev;
      prev = this.requests[ref];
      sum += this.requests[ref].amount;
    }
    return sum;
  }

  public requestToStorage(
    objects: TransferRequest["from"][],
    priority: TransferRequest["priority"],
    res: TransferRequest["resource"],
    amount: number = Infinity,
    fitStore = false
  ): number {
    let sum = 0;
    let prev: TransferRequest | undefined;
    amount = Math.min(amount, this.storage.store.getFreeCapacity(res));
    for (const obj of objects) {
      const ref = obj.id;
      const existing = this.requests[ref];
      if (existing && existing.priority <= priority) continue;
      let amountCC = amount;
      if (fitStore && !(obj instanceof Resource))
        amountCC = Math.min(
          amountCC,
          (obj.store as Store<ResourceConstant, false>).getUsedCapacity(res)
        );
      if (amountCC <= 0) continue;
      const request = new TransferRequest(
        ref,
        obj,
        this.storage,
        priority,
        res,
        amountCC
      );
      if (!request.isValid()) continue;
      this.requests[ref] = request;
      if (prev) this.requests[ref].nextup = prev;
      prev = this.requests[ref];
      sum += this.requests[ref].amount;
    }
    return sum;
  }

  public pickupResources() {
    const resources = this.hive.room
      .find(FIND_DROPPED_RESOURCES)
      .filter((r) => r.resourceType !== RESOURCE_ENERGY || r.amount >= 100);
    const tombstones = this.hive.room
      .find(FIND_TOMBSTONES)
      .filter((t) => t.store.getUsedCapacity() > 0);
    const enemies = Apiary.intel
      .getInfo(this.hive.roomName, 10)
      .enemies.map((e) => e.object);
    let rrs = (resources as (Resource | Tombstone)[]).concat(tombstones);
    if (enemies.length)
      rrs = rrs.filter((rr) => {
        const enemy = rr.pos.findClosest(enemies)!;
        if (
          enemy.pos.getRangeTo(rr) > 4 &&
          !this.hive.cells.defense.wasBreached(enemy.pos, rr.pos)
        )
          return true;
        delete this.requests[rr.id];
        return false;
      });
    return this.requestToStorage(rrs, 6, undefined, 1200, true);
  }

  public findLink() {
    this.link = _.filter(
      this.pos.findInRange(FIND_MY_STRUCTURES, 2),
      (structure) => structure.structureType === STRUCTURE_LINK
    )[0] as StructureLink | undefined;
  }

  public update() {
    super.update();
    this.usedCapacity = {};
    if (!this.storage && Apiary.useBucket) {
      Apiary.destroyTime = Game.time;
      return;
    }

    if (!this.link && this.hive.controller.level >= 5) this.findLink();

    for (const k in this.requests) this.requests[k].update();

    if (!this.linkState) {
      if (
        this.link &&
        this.link.store.getUsedCapacity(RESOURCE_ENERGY) > LINK_CAPACITY * 0.5
      )
        this.requestToStorage(
          [this.link],
          this.hive.state >= hiveStates.battle ? 1 : 4,
          RESOURCE_ENERGY
        );
    } else if (this.linkState.lastUpdated + 5 <= Game.time)
      this.linkState = undefined;

    this.hive.stateChange(
      "lowenergy",
      this.storage.store.getUsedCapacity(RESOURCE_ENERGY) < EXTREMLY_LOW_ENERGY
    );
    if (
      this.storage.store.getUsedCapacity(RESOURCE_ENERGY) <
        ENERGY_FOR_REVERTING_TO_DEV_CELLS &&
      !this.hive.cells.dev &&
      Apiary.useBucket
    )
      Apiary.destroyTime = Game.time;

    // if (!Object.keys(this.requests).length)
    if (this.storage instanceof StructureStorage) this.updateTerminal();
    else if (this.hive.room.storage) Apiary.destroyTime = Game.time;
  }

  public updateTerminal() {
    if (Game.time % 4 !== 0) return;
    if (!this.terminal) {
      if (this.hive.room.terminal && Apiary.useBucket)
        Apiary.destroyTime = Game.time;
      return;
    }

    /* if (Game.flags[prefix.terminal + this.hive.roomName]) {
      if (this.terminal.store.getUsedCapacity(RESOURCE_ENERGY) < this.resTargetTerminal[RESOURCE_ENERGY])
        this.requestFromStorage([this.terminal], 4, RESOURCE_ENERGY);
      else {
        let res = findOptimalResource(this.storage.store, -1);
        this.requestFromStorage([this.terminal], 4, res);
      }
      return;
    } */

    for (const r in this.terminal.store) {
      const res = r as ResourceConstant;
      if (!this.resTargetTerminal[res]) {
        const used = this.terminal.store.getUsedCapacity(res);
        if (
          (used > 1000 || !Object.keys(this.requests).length) &&
          this.requestToStorage(
            [this.terminal],
            res === RESOURCE_ENERGY &&
              this.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 100000
              ? 4
              : 2,
            res,
            Math.min(used, 3000)
          ) > 0
        )
          return;
      }
    }

    for (const r in this.resTargetTerminal) {
      const res = r as ResourceConstant;
      const balance =
        this.terminal.store.getUsedCapacity(res) - this.resTargetTerminal[res]!;
      if (balance < 0) {
        if (
          this.requestFromStorage(
            [this.terminal],
            4,
            res,
            Math.min(-balance, 3000)
          ) > 0
        )
          return;
      } else if (balance > 1000 || !Object.keys(this.requests).length) {
        if (
          this.requestToStorage(
            [this.terminal],
            res === RESOURCE_ENERGY &&
              this.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 100000
              ? 4
              : 2,
            res,
            Math.min(balance, 3000)
          ) > 0
        )
          return;
      }
    }
  }

  public run() {
    for (const k in this.requests) {
      if (!this.requests[k].isValid()) delete this.requests[k];
    }
  }

  public getUsedCapacity(resource: ResourceConstant) {
    if (this.usedCapacity[resource]) return this.usedCapacity[resource]!;
    let amount = this.storage.store.getUsedCapacity(resource);
    if (this.terminal) {
      let toAdd = this.terminal.store.getUsedCapacity(resource);
      if (resource && resource in this.resTargetTerminal)
        toAdd = Math.max(0, toAdd - this.resTargetTerminal[resource]!);
      amount += toAdd;
    }

    _.forEach(this.master.activeBees, (bee) => {
      amount += bee.store.getUsedCapacity(resource);
    });

    if (
      (resource in REACTION_TIME || BASE_MINERALS.includes(resource)) &&
      this.hive.cells.lab
    )
      _.forEach(this.hive.cells.lab.laboratories, (lab) => {
        const toAdd = lab.store.getUsedCapacity(resource);
        if (toAdd) amount += toAdd;
      });

    if (this.hive.cells.factory)
      amount += this.hive.cells.factory.factory.store.getUsedCapacity(resource);
    if (this.hive.cells.power)
      switch (resource) {
        case RESOURCE_OPS:
          const powerManager = this.hive.cells.power.powerManagerBee;
          if (powerManager)
            amount += powerManager.store.getUsedCapacity(resource);
          break;
        case RESOURCE_POWER:
          amount +=
            this.hive.cells.power.powerSpawn.store.getUsedCapacity(resource);
          break;
      }
    this.usedCapacity[resource] = amount;
    return amount;
  }
}
