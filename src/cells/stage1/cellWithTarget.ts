import { Cell } from "cells/_Cell";

export const PRODUCTION_COOLDOWNS = {
  prod: {
    lab: 100,
    factory: 50,
  },
  target: {
    lab: 200,
    factory: 50,
  },
};

export abstract class CellWithTarget extends Cell {
  // #region Properties (6)

  private patience = 0;
  private patienceShrinkProd = 0;
  private targetCooldown = Game.time + 1;

  protected abstract readonly cooldownProd: number;
  protected abstract readonly cooldownTarget: number;

  protected abstract prod: { plan: number } | undefined;

  // #endregion Properties (6)

  // #region Public Accessors (2)

  /** [0, 1+] of how colse we are to checking new target */
  public get progressToNewTarget() {
    if (!this.shouldProduce) {
      this.invalidateTarget();
      return -1;
    }
    const countDown = this.targetCooldown - Game.time;
    return 1 - countDown / this.cooldownTarget;
  }

  public get progressToProd() {
    return this.patience / this.cooldownProd;
  }

  // #endregion Public Accessors (2)

  // #region Protected Accessors (2)

  protected get cooldownProdShrink() {
    return 100;
  }

  protected get shouldFindTarget() {
    return this.progressToNewTarget >= 1;
  }

  // #endregion Protected Accessors (2)

  // #region Protected Abstract Accessors (1)

  protected abstract get shouldProduce(): boolean;

  // #endregion Protected Abstract Accessors (1)

  // #region Protected Methods (5)

  protected CanProduceNow(fact: number, minAmount: number) {
    if (!this.prod) return;
    if (this.prod.plan <= minAmount) {
      this.prod = undefined;
      return;
    }
    if (fact >= this.prod.plan) {
      this.patienceShrinkProd = 0;
      return;
    }
    if (this.patienceShrinkProd < this.cooldownProdShrink) {
      ++this.patienceShrinkProd;
      return;
    }
    this.prod.plan = fact;
    this.patienceShrinkProd = 0;
    if (this.prod.plan <= minAmount) this.prod = undefined;
  }

  protected foundTarget() {
    this.targetCooldown = Game.time + this.cooldownProd;
    this.patience = 0;
  }

  protected notFoundTarget() {
    this.targetCooldown = Game.time + this.cooldownTarget;
    this.patience = 0;
  }

  protected prodPatienceCheck(amount: number) {
    if (amount) {
      this.patience = 0;
      return;
    }
    this.prodWaitingToStart();
  }

  /** if we can't produce stuff lose patience */
  protected prodWaitingToStart() {
    ++this.patience;
    if (!this.shouldFindTarget) return;
    this.patience = 0;
    this.invalidateTarget();
  }

  // #endregion Protected Methods (5)

  // #region Protected Abstract Methods (1)

  public abstract invalidateTarget(): void;

  // #endregion Protected Abstract Methods (1)
}
