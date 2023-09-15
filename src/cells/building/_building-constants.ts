import { HIVE_ENERGY } from "cells/management/storageCell";

// Constants for update intervals
export const UPDATE_STRUCTURES = {
  battle: 100,
  normal: 1500,
};

export const WALLS_HEALTH = {
  /** start constat for wall health */
  start: 10_000,
  /** AVG case boosted ~75k energy
   *
   * worst case unboosted 200k energy */
  step: 200_000,
  /** KEEP BUFFING WALLS IF BATTLE */
  battle: 2_000_000,
};

/** add WALL_STEP to target wall health if energy surplus is more than cell */
export const HIVE_WALLS_UP = {
  [WALLS_HEALTH.step]: 1_000_000, // resState >= 0 so build up to a minimum of 1m health
  [5_000_000]: HIVE_ENERGY * 0.25, // +100_000 // prob can cell easy
  [25_000_000]: HIVE_ENERGY, // +200_000 // ok spot to be
  [50_000_000]: HIVE_ENERGY * 1.5, // +300_000 // kinda overkill
  // [WALL_HITS_MAX]: HIVE_ENERGY * 2, // big project
};

export const BUFFER_ZONE = {
  [STRUCTURE_RAMPART]: {
    aliveBees: 15_000, // 5_000 ticks
    noBees: 45_000, // 15_666 ticks
  },
  [STRUCTURE_ROAD]: {
    aliveBees: 500, // 5_000 ticks
    noBees: 1_500, // 15_0000 ticks
  },
  [STRUCTURE_CONTAINER]: {
    aliveBees: 50_000, // 5_000 ticks
    noBees: 150_000, // 15_000 ticks
  },
};
