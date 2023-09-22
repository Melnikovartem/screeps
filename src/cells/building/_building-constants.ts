import { HIVE_ENERGY } from "cells/management/storageCell";

// Constants for update intervals
export const UPDATE_STRUCTURES = {
  battle: 100,
  normal: 750,
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

/** how much of walls to build when hive.phase is [key] */
export const MAX_WALLS = {
  0: 0,
  "1_minimum": WALLS_HEALTH.step,
  "1_force": 1_000_000,
  1: 5_000_000,
  "2_normal": 25_000_000,
  /** overkill target for hive */
  2: 50_000_000, // WALL_HITS_MAX
};

/** add WALL_STEP to target wall health if energy surplus is more than cell */
export const HIVE_WALLS_UP = {
  /**  minimal walls after we build storage */
  [MAX_WALLS["1_minimum"]]: -HIVE_ENERGY * 0.75, // -150_000 (50K in storage)
  /** force build up some actual walls */
  [MAX_WALLS["1_force"]]: -HIVE_ENERGY * 0.5, // -100_000 (100K in storage)
  /** balanced hive build up the walls to 5mil */
  [MAX_WALLS[1]]: 0,
  /** have some energy to build up walls */
  [MAX_WALLS["2_normal"]]: HIVE_ENERGY, // + 200_000
  /** max out walls if have a lot of spare energy */
  [MAX_WALLS[2]]: HIVE_ENERGY * 1.5, // +300_000
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
