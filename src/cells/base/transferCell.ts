import { ManagerMaster } from "beeMasters/economy/manager";
import { TransferRequest } from "bees/transferRequest";
import type { Hive } from "hive/hive";
import { ResTarget } from "hive/hive-declarations";
import { profile } from "profiler/decorator";
import { prefix } from "static/enums";

import { Cell } from "../_Cell";

export const TERMINAL_ENERGY = Math.round(TERMINAL_CAPACITY * 0.1);

export const HIVE_ENERGY = Math.round(STORAGE_CAPACITY * 0.2);
export const ENERGY_FOR_REVERTING_TO_DEV_CELLS = 3000;
const EXTREMLY_LOW_ENERGY = 10000;

@profile
export class StorageCell extends Cell {
  public linkState:
    | { using: string; priority: 0 | 1; lastUpdated: number }
    | undefined;
  public master: ManagerMaster;

  public requests: { [id: string]: TransferRequest } = {};
  public resTargetTerminal: { energy: number } & ResTarget = {
    energy: TERMINAL_ENERGY,
  };

  public usedCapacity: ResTarget = {};

  public constructor(hive: Hive) {
    super(hive, prefix.storageCell);
    this.findLink();
    this.master = new ManagerMaster(this);
  }

  /** used to support terminal storage, but not helpful and pain in ass */
  public get storage() {
    return this.hive.room.storage!;
  }

  public get terminal() {
    return this.hive.room.terminal;
  }

  public link: StructureLink | undefined | null;
  public linkId: Id<StructureLink> | undefined | null;
  public findLink() {
    let link: typeof this.link =
      this.cache("linkId") && Game.getObjectById(this.cache("linkId")!);
    if (!link)
      link = this.pos
        .findInRange(FIND_MY_STRUCTURES, 2)
        .filter((s) => s.structureType === STRUCTURE_LINK)[0] as
        | StructureLink
        | undefined;
    this.link = link;
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
      .getInfo(this.hiveName, 10)
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

  public update() {
    super.update();
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
          this.hive.isBattle ? 1 : 4,
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

  /** Used to check all resources in hive
   *
   * called in terminal update
   */
  public updateUsedCapacity() {
    this.usedCapacity = {};
    const addFromStore = (storePar: { store: ResTarget }, mult = 1) => {
      for (const [res, amount] of Object.entries(storePar.store)) {
        const resource = res as ResourceConstant;
        if (this.usedCapacity[resource] === undefined)
          this.usedCapacity[resource] = 0;
        this.usedCapacity[resource]! += amount * mult;
      }
    };

    addFromStore(this.storage);
    if (this.terminal) {
      const disrupted =
        this.terminal.effects &&
        this.terminal.effects.filter((e) => e.effect === PWR_DISRUPT_TERMINAL);
      if (!disrupted) {
        addFromStore(this.terminal);
        addFromStore({ store: this.resTargetTerminal }, -1);
      }
    }

    _.forEach(this.master.activeBees, (b) => addFromStore(b));

    if (this.hive.cells.lab)
      _.forEach(this.hive.cells.lab.laboratories, (l) => addFromStore(l));

    if (this.hive.cells.factory) addFromStore(this.hive.cells.factory.factory);

    /*  no need to add this cause will be spent anyways
    if (this.hive.cells.power) {
      addFromStore(this.hive.cells.power.powerSpawn);
      if (this.hive.cells.power.powerManagerBee)
        addFromStore(this.hive.cells.power.powerManagerBee.creep);
    } */
  }

  public getUsedCapacity(resource: ResourceConstant) {
    return this.usedCapacity[resource] || 0;
  }
}
