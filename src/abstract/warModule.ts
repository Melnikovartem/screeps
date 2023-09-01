import { SquadWarCrimesMaster } from "../beeMasters/squads/squadWarcrimes";
import { setups } from "../bees/creepSetups";
import { profile } from "../profiler/decorator";
import type { Enemy } from "../spiderSense/intelligence";
import { enemyTypes, prefix, roomStates } from "../static/enums";
import { getEnterances, makeId, towerCoef } from "../static/utils";
import { Traveler } from "../Traveler/TravelerModified";

const HEAL_COEF = 2; // HEAL/TOUGH setup for my bees

@profile
export class WarcrimesModule {
  public squads: { [id: string]: SquadWarCrimesMaster } = {};

  public init() {
    _.forEach(Memory.cache.war.squadsInfo, (info) => {
      if (!Apiary.hives[info.hive]) {
        if (info.spawned === info.setup.length)
          info.hive = Object.keys(Apiary.hives)[0];
        else delete Memory.cache.war.squadsInfo[info.ref];
      }
      this.squads[info.ref] = new SquadWarCrimesMaster(this, info);
    });
  }

  private getOpt(
    obstacles: { pos: RoomPosition; perc: number }[],
    existingPoints: { x: number; y: number }[]
  ): TravelToOptions {
    return {
      maxRooms: 1,
      offRoad: true,
      ignoreCreeps: true,
      ignoreStructures: true,
      roomCallback: (roomName, matrix) => {
        if (!(roomName in Game.rooms)) return matrix;
        matrix = new PathFinder.CostMatrix();
        const terrain = Game.map.getRoomTerrain(roomName);
        for (let x = 0; x <= 49; ++x)
          for (let y = 0; y <= 49; ++y)
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) matrix.set(x, y, 0xff);
        _.forEach(obstacles, (o) =>
          matrix.set(
            o.pos.x,
            o.pos.y,
            Math.floor(
              (o.pos.x <= 2 || o.pos.x >= 47 || o.pos.y <= 1 || o.pos.y >= 47
                ? 0xba
                : 0xa4) *
                o.perc *
                (existingPoints.filter(
                  (e) =>
                    o.pos.getRangeTo(new RoomPosition(e.x, e.y, roomName)) <= 4
                ).length
                  ? 2
                  : 1)
            )
          )
        );
        _.forEach(existingPoints, (e) =>
          matrix.set(e.x, e.y, existingPoints.length < 5 ? 0xba : 0x2c)
        );
        return matrix;
      },
    };
  }

  public get siedge() {
    return Memory.cache.war.siedgeInfo;
  }

  public updateRoom(roomName: string, attackTime?: number | null) {
    if (!this.siedge[roomName])
      this.siedge[roomName] = {
        lastUpdated: -500,
        breakIn: [],
        freeTargets: [],
        towerDmgBreach: 0,
        attackTime: null, // for now we dont attack if not asked
        threatLvl: 2,
        squadSlots: {},
      };
    const siedge = this.siedge[roomName];
    if (attackTime !== undefined) siedge.attackTime = attackTime;
    if (
      siedge.lastUpdated +
        (siedge.attackTime ? CREEP_LIFE_TIME / 4 : CREEP_LIFE_TIME) <
        Game.time ||
      attackTime !== undefined
    ) {
      const room = Game.rooms[roomName];
      if (!room) {
        siedge.lastUpdated = -1;
        Apiary.requestSight(roomName);
        return;
      }
      siedge.lastUpdated = Game.time;
      const roomInfo = Apiary.intel.getInfo(roomName);
      const invaderRaid =
        roomInfo.roomState === roomStates.SKfrontier ||
        roomInfo.roomState === roomStates.SKcentral;
      if (
        roomInfo.roomState !== roomStates.ownedByEnemy &&
        (!invaderRaid || roomInfo.dangerlvlmax < 8)
      ) {
        if (invaderRaid) {
          const containers = room
            .find(FIND_STRUCTURES)
            .filter(
              (s) => s.structureType === STRUCTURE_CONTAINER
            ) as StructureContainer[];
          const resourcesAmount = _.sum(containers, (s) =>
            s.store.getUsedCapacity()
          );
          if (resourcesAmount > 0) {
            const haulers = Math.min(
              Math.ceil(
                resourcesAmount / ((MAX_CREEP_SIZE * CARRY_CAPACITY) / 2)
              ),
              2
            );
            containers[0].pos.createFlag(
              haulers + "_" + prefix.steal + roomName,
              COLOR_ORANGE,
              COLOR_GREEN
            );
          }
        }
        delete Memory.cache.war.siedgeInfo[roomName];
        return;
      }

      let enterances = getEnterances(roomName).filter(
        (ent) =>
          ent.enteranceToRoom &&
          Apiary.intel.getRoomState(ent.enteranceToRoom) !==
            roomStates.ownedByEnemy
      );
      const closesHive = Object.values(Apiary.hives).reduce((prev, curr) =>
        curr.pos.getRoomRangeTo(roomName) < prev.pos.getRoomRangeTo(roomName)
          ? curr
          : prev
      );
      enterances = enterances.sort(
        (a, b) =>
          closesHive.pos.getRoomRangeTo(a.enteranceToRoom!) -
          closesHive.pos.getRoomRangeTo(b.enteranceToRoom!)
      );

      const matrix: { [id: number]: { [id: number]: number } } = {};
      for (let x = 0; x <= 49; ++x) {
        matrix[x] = {};
        for (let y = 0; y <= 49; ++y) matrix[x][y] = 0xff;
      }

      _.forEach(enterances, (ent) => this.dfs(ent, matrix));

      // find breach points
      let wallsHealthMax = 1;
      let obstacles: Structure[] = [];
      siedge.threatLvl = 0;
      let labs = 0;
      let targets = room.find(FIND_STRUCTURES).filter((s) => {
        switch (s.structureType) {
          case STRUCTURE_INVADER_CORE:
            labs += 1;
          case STRUCTURE_SPAWN:
          case STRUCTURE_STORAGE:
          case STRUCTURE_STORAGE:
          case STRUCTURE_SPAWN:
          case STRUCTURE_TOWER:
            return true;
          case STRUCTURE_LAB:
            ++labs;
            return false;
          case STRUCTURE_WALL:
          case STRUCTURE_RAMPART:
            if (s.hits > wallsHealthMax) wallsHealthMax = s.hits;
            obstacles.push(s);
          default:
            return false;
        }
      });

      if (roomInfo.towers.length >= 6) {
        siedge.threatLvl = 2;
      } else if (roomInfo.towers.length) siedge.threatLvl = labs ? 2 : 1;
      if (
        siedge.threatLvl > 1 &&
        ((room.storage &&
          room.storage.store.getUsedCapacity(RESOURCE_ENERGY) <= 20000) ||
          (!room.storage && roomInfo.roomState === roomStates.ownedByEnemy))
      )
        siedge.threatLvl = 1;

      let addGuard = false;
      if (!targets.length)
        if (room.controller && room.controller.owner) {
          targets = [room.controller];
          if (
            !room.controller.pos
              .lookFor(LOOK_FLAGS)
              .filter(
                (f) =>
                  f.color === COLOR_RED && f.secondaryColor === COLOR_PURPLE
              ).length
          )
            room.controller.pos.createFlag(
              prefix.downgrade + room.name,
              COLOR_RED,
              COLOR_PURPLE
            );
          addGuard = true;
        } else return; // not sure when this will be case but ok

      const target = targets.reduce((prev, curr) => {
        let ans =
          matrix[curr.pos.x][curr.pos.y] - matrix[prev.pos.x][prev.pos.y];
        if (ans === 0)
          ans =
            Apiary.intel.getTowerAttack(curr.pos) -
            Apiary.intel.getTowerAttack(prev.pos);
        return ans < 0 ? curr : prev;
      });

      siedge.breakIn = [];
      siedge.freeTargets = [];

      const isController = target instanceof StructureController;
      const brokeIn =
        matrix[target.pos.x][target.pos.y] <= 2 ||
        (isController &&
          target.pos
            .getPositionsInRange(1)
            .filter((b) => matrix[b.x] && matrix[b.x][b.y] <= 2).length);
      const squadsToEnteranses: string[] = [];
      if (!isController || !brokeIn)
        _.some(enterances, (ent) => {
          if (!obstacles.length) return true;
          if (siedge.breakIn.length >= 2 && squadsToEnteranses.length >= 2)
            return true;
          const path = Traveler.findTravelPath(
            ent,
            target,
            this.getOpt(
              obstacles.map((s) => {
                return { pos: s.pos, perc: s.hits / wallsHealthMax };
              }),
              brokeIn ? [] : siedge.breakIn
            )
          ).path;
          const addBreak = obstacles
            .filter(
              (o) =>
                path.filter((p) => o.pos.getRangeTo(p) < 1).length &&
                !siedge.breakIn.filter(
                  (b) =>
                    o.pos.getRangeTo(new RoomPosition(b.x, b.y, roomName)) < 4
                ).length
            )
            .map((p) => {
              return { x: p.pos.x, y: p.pos.y };
            });
          const enteranceRoomName = (ent.enteranceToRoom || ent).roomName;
          _.forEach(addBreak, (b) =>
            siedge.breakIn.push({
              x: b.x,
              y: b.y,
              ent: enteranceRoomName,
              state: (matrix[b.x] && matrix[b.x][b.y]) || 255,
            })
          );
          if (!squadsToEnteranses.includes(enteranceRoomName))
            squadsToEnteranses.push(enteranceRoomName);
          const last = brokeIn && path.pop();
          if (
            last &&
            last.getRangeTo(target) <= 1 &&
            !path.filter((b) => matrix[b.x] && matrix[b.x][b.y] > 1).length
          ) {
            siedge.breakIn = [
              {
                x: target.pos.x,
                y: target.pos.y,
                ent: (ent.enteranceToRoom || ent).roomName,
                state: 1,
              },
            ];
            return true;
          }
          obstacles = obstacles.filter(
            (o) =>
              !siedge.breakIn.filter((p) => o.pos.x === p.x && o.pos.y === p.y)
                .length
          );
          return false;
        });

      if (!siedge.breakIn.length && !isController)
        siedge.breakIn = [
          {
            x: target.pos.x,
            y: target.pos.y,
            ent: roomName,
            state: 1,
          },
        ];

      if (roomInfo.safeModeEndTime > 0)
        siedge.attackTime = Math.max(
          roomInfo.safeModeEndTime - 100,
          siedge.attackTime || 0
        );
      /* if (target instanceof StructureController
        && target.pos.getOpenPositions(true).filter(p => matrix[p.x][p.y] <= 1
          && !p.lookFor(LOOK_STRUCTURES).filter(s => s.structureType !== STRUCTURE_ROAD).length).length)
        siedge.attackTime = null; */

      const store = brokeIn && (room.storage || room.terminal);
      if (
        store &&
        !store.pos
          .lookFor(LOOK_STRUCTURES)
          .filter(
            (s) => s.structureType === STRUCTURE_RAMPART && s.hits > 25000
          ).length &&
        !Apiary.intel.getTowerAttack(store.pos) &&
        !store.pos
          .lookFor(LOOK_FLAGS)
          .filter(
            (f) => f.color === COLOR_ORANGE && f.secondaryColor === COLOR_GREEN
          )
      ) {
        const resourcesAmount = store.store.getUsedCapacity();
        if (resourcesAmount > 0) {
          const haulers = Math.min(
            Math.ceil(
              resourcesAmount / ((MAX_CREEP_SIZE * CARRY_CAPACITY) / 2)
            ),
            4
          );
          store.pos.createFlag(
            haulers + "_" + prefix.steal + roomName,
            COLOR_ORANGE,
            COLOR_GREEN
          );
        }
      }

      if (
        brokeIn &&
        !Apiary.intel.getTowerAttack(target.pos) &&
        !Game.flags["dismantle_" + roomName]
      )
        target.pos.createFlag("dismantle_" + roomName, COLOR_RED, COLOR_RED);
      if (
        !siedge.squadSlots.length &&
        addGuard &&
        !Game.flags["guard_" + roomName]
      )
        new RoomPosition(25, 25, roomName).createFlag(
          "guard_" + roomName,
          COLOR_RED,
          COLOR_RED
        );

      const extraSquads: number[] = [];
      const getType = (prob: number) => {
        if (invaderRaid) return "range";
        if (
          brokeIn &&
          !target.pos
            .lookFor(LOOK_STRUCTURES)
            .filter(
              (s) => s.structureType === STRUCTURE_RAMPART && s.hits > 25000
            ).length
        )
          return "duo";
        return Math.random() <= prob ? "dism" : "range";
      };

      const emptyTowers = _.sum(roomInfo.towers, (t) =>
        t.store.getUsedCapacity(RESOURCE_ENERGY) <= 200 ? 1 : 0
      ); // showing signs of cracs under pressure

      for (const br in siedge.squadSlots) {
        const parsed = /(\d*)_(\d*)/.exec(br);
        if (
          !siedge.breakIn.filter(
            (b) => b.x === +parsed![0] && b.y === +parsed![1]
          ).length
        ) {
          extraSquads.push(siedge.squadSlots[br].lastSpawned);
          delete siedge.squadSlots[br];
        } else
          siedge.squadSlots[br].type = getType(
            brokeIn ? 0.9 : emptyTowers ? 0.8 : 0.5
          );
      }

      _.forEach(siedge.breakIn, (b) => {
        if (!siedge.squadSlots[b.x + "_" + b.y] && b.state <= 2)
          siedge.squadSlots[b.x + "_" + b.y] = {
            lastSpawned: extraSquads.pop() || -1,
            type: getType(brokeIn ? 0.9 : emptyTowers ? 0.7 : 0.2),
            breakIn: b,
          };
      });

      /* if (!siedge.squadSlots.length && siedge.attackTime)
        siedge.squadSlots[target.pos.x + "_" + target.pos.y] = {
          lastSpawned: extraSquads.pop() || -1,
          type: "duo",
          breakIn: {
            x: target.pos.x,
            y: target.pos.y,
            ent: roomName,
            state: 2,
          },
        } */

      if (attackTime)
        for (const br in siedge.squadSlots)
          siedge.squadSlots[br].lastSpawned = Math.max(
            attackTime - CREEP_LIFE_TIME,
            siedge.squadSlots[br].lastSpawned
          );

      let powerCreepCoef = 1;
      _.forEach(roomInfo.enemies, (e) => {
        if (!(e.object instanceof PowerCreep)) return;
        for (const power in e.object.powers) {
          if (+power !== PWR_OPERATE_TOWER) continue;
          const powerInfo = e.object.powers[+power as PowerConstant];
          powerCreepCoef = Math.max(powerCreepCoef, 1 + powerInfo.level * 0.1);
        }
      });

      const positions: { x: number; y: number }[] = siedge.breakIn.length
        ? siedge.breakIn
        : [target.pos];
      const towerDmg = _.map(positions, (p) => {
        let coef = 0;
        const pos = new RoomPosition(p.x, p.y, roomName);
        _.forEach(roomInfo.towers, (t) => (coef += towerCoef(t, pos)));
        return { pos, dmg: coef * powerCreepCoef * TOWER_POWER_ATTACK };
      });

      siedge.towerDmgBreach = !towerDmg.length
        ? 0
        : Math.ceil(
            towerDmg.reduce((curr, prev) => {
              let ans =
                matrix[curr.pos.x][curr.pos.y] - matrix[prev.pos.x][prev.pos.y];
              if (ans === 0) ans = prev.dmg - curr.dmg;
              return ans < 0 ? curr : prev;
            }).dmg - 0.0001
          );

      // find free targets
      if (matrix[target.pos.x][target.pos.y] > 4)
        siedge.freeTargets = roomInfo.enemies
          .filter(
            (e) =>
              e.type === enemyTypes.static &&
              e.object.hitsMax < 25000 &&
              (matrix[e.object.pos.x][e.object.pos.y] <= 4 ||
                e.object instanceof StructureExtractor) &&
              !e.object.pos
                .lookFor(LOOK_STRUCTURES)
                .filter(
                  (s) => s.structureType === STRUCTURE_RAMPART && s.hits > 10000
                ).length
          )
          .map((e) => {
            return { x: e.object.pos.x, y: e.object.pos.y };
          });
    }
  }

  private dfs(
    pos: RoomPosition,
    matrix: { [id: number]: { [id: number]: number } },
    depth: number = 1,
    call = 0
  ) {
    if (call > 500) return;
    if (
      (depth > 1 && depth < 4) ||
      pos
        .lookFor(LOOK_STRUCTURES)
        .filter(
          (s) =>
            s.structureType === STRUCTURE_WALL ||
            (s.structureType === STRUCTURE_RAMPART &&
              !(s as StructureRampart).my)
        ).length
    )
      ++depth;
    matrix[pos.x][pos.y] = depth;
    if (depth < 4) {
      const terrain = Game.map.getRoomTerrain(pos.roomName);
      _.forEach(pos.getPositionsInRange(1), (p) => {
        if (terrain.get(p.x, p.y) === TERRAIN_MASK_WALL) return;
        const curr = matrix[p.x][p.y];
        if (curr <= depth) return;
        this.dfs(p, matrix, depth, call + 1);
      });
    }
  }

  public getEasyEnemy(pos: RoomPosition): Enemy["object"] | undefined {
    const roomInfo = Apiary.intel.getInfo(pos.roomName, 20);
    const enemiesPos = roomInfo.enemies
      .filter((e) => {
        if (e.object.pos.getRangeTo(pos) >= 20) return false;
        if (
          !(
            e.object instanceof StructureWall ||
            e.object instanceof StructureRampart
          )
        )
          return false;
        const stats = Apiary.intel.getComplexStats(e.object.pos, 3, 1).current;
        const creepDmg = stats.dmgClose + stats.dmgRange;
        return !creepDmg;
      })
      .map((e) => e.object);
    if (!enemiesPos.length) return;
    const enemy = enemiesPos.reduce((prev, curr) => {
      const currS = Apiary.intel.getComplexStats(curr, 4, 2).current;
      const prevS = Apiary.intel.getComplexStats(prev, 4, 2).current;
      let ans =
        currS.dmgClose + currS.dmgRange - prevS.dmgClose + prevS.dmgRange;
      if (ans === 0) {
        ans = curr.hits - prev.hits;
        if (Math.abs(ans) <= 50000)
          ans = pos.getRangeTo(curr) - pos.getRangeTo(prev);
      }
      return ans < 0 ? curr : prev;
    });
    const siedge = this.siedge[pos.roomName];
    if (siedge) {
      /* if (!siedge.breakIn.filter(b => b.x === enemy.pos.x && b.y === enemy.pos.y).length)
        siedge.breakIn.push({
          x: enemy.pos.x,
          y: enemy.pos.y,
          ent: pos.roomName,
          state: 255,
        }); */
    }
    return enemy;
  }

  public getEnemy(
    pos: RoomPosition,
    dismantle: boolean = false
  ): Enemy["object"] | undefined {
    let enemy: Enemy["object"] | undefined;
    let roomInfo = Apiary.intel.getInfo(pos.roomName, 20);
    const noRamp = (e: { object: { pos: RoomPosition } }) =>
      !e.object.pos.lookFor(LOOK_STRUCTURES).filter((s) => s.hits > 10000)
        .length;
    if (roomInfo.roomState === roomStates.ownedByEnemy)
      roomInfo = Apiary.intel.getInfo(pos.roomName, 4);
    const siedge = this.siedge[pos.roomName];

    let enemies: Enemy[] = [];
    if (!dismantle)
      roomInfo.enemies.filter(
        (e) => pos.getRangeTo(e.object) <= 4 && noRamp(e)
      ); // havoc enemies
    if (siedge && pos.roomName in Game.rooms) {
      if (roomInfo.safeModeEndTime > 0)
        siedge.attackTime = Math.max(
          roomInfo.safeModeEndTime - 100,
          siedge.attackTime || 0
        );
      for (let i = 0; i < siedge.freeTargets.length; ++i) {
        const roomEnemies = new RoomPosition(
          siedge.freeTargets[i].x,
          siedge.freeTargets[i].y,
          pos.roomName
        ).lookFor(LOOK_STRUCTURES);
        const enemy = roomEnemies.length
          ? roomEnemies.reduce((prev, curr) => ("owner" in curr ? curr : prev))
          : undefined;
        if (enemy)
          enemies.push({
            object: enemy,
            type: enemyTypes.static,
            dangerlvl: 9,
          });
        else {
          siedge.freeTargets.splice(i, 1);
          --i;
        }
      }
      for (let i = 0; i < siedge.breakIn.length; ++i) {
        const roomEnemies = new RoomPosition(
          siedge.breakIn[i].x,
          siedge.breakIn[i].y,
          pos.roomName
        ).lookFor(LOOK_STRUCTURES);
        const enemy = roomEnemies.length
          ? roomEnemies.reduce((prev, curr) => ("owner" in curr ? curr : prev))
          : undefined;
        if (enemy)
          enemies.push({
            object: enemy,
            type: enemyTypes.static,
            dangerlvl: 9,
          });
        else {
          siedge.breakIn.splice(i, 1);
          --i;
        }
      }
    }
    if (!enemies.length)
      enemies = roomInfo.enemies.filter(
        (e) => e.dangerlvl === roomInfo.dangerlvlmax
      );
    if (enemies.length)
      enemy = enemies.reduce((prev, curr) => {
        let ans = pos.getRangeTo(curr.object) - pos.getRangeTo(prev.object);
        if (ans === 0) ans = prev.dangerlvl - curr.dangerlvl;
        return ans < 0 ? curr : prev;
      }).object;
    return enemy;
  }

  private getLegionFormation(dmg: number) {
    const formationBee = setups.archer.copy();
    const dmgAfterTough = dmg * BOOSTS.tough.XGHO2.damage;
    const healNeeded =
      (dmgAfterTough / HEAL_POWER / BOOSTS.heal.XLHO2.heal) * HEAL_COEF;

    const healPerBee = Math.ceil(healNeeded / 4);
    const toughPerBee = Math.ceil(
      Math.max(
        dmgAfterTough,
        (dmgAfterTough - healPerBee * HEAL_POWER * BOOSTS.heal.XLHO2.heal) * 2
      ) / 100
    );
    // toughPerBee = Math.ceil(dmgAfterTough * 2 / 100);

    formationBee.fixed = Array(healPerBee)
      .fill(HEAL)
      .concat(Array(toughPerBee).fill(TOUGH));
    formationBee.patternLimit = 50;

    const formation = [formationBee, formationBee, formationBee, formationBee];
    return formation;
  }

  private getDuoFormation(dmg: number) {
    const formationBee = setups.archer.copy();
    const dmgAfterTough = dmg * BOOSTS.tough.XGHO2.damage;
    const healNeeded =
      (dmgAfterTough / HEAL_POWER / BOOSTS.heal.XLHO2.heal) * HEAL_COEF;

    const healPerBee = Math.ceil(healNeeded / 2);
    const toughPerBee = Math.ceil(
      Math.max(
        dmgAfterTough,
        (dmgAfterTough - healPerBee * HEAL_POWER * BOOSTS.heal.XLHO2.heal) * 2
      ) / 100
    );

    formationBee.fixed = Array(healPerBee)
      .fill(HEAL)
      .concat(Array(toughPerBee).fill(TOUGH));
    formationBee.patternLimit = 50;
    const formation = [formationBee, formationBee];
    return formation;
  }

  private getBrigadeFormation(dmg: number) {
    const formationHealerBee = setups.healer.copy();

    const dmgAfterTough = dmg * BOOSTS.tough.XGHO2.damage;
    const healNeeded =
      (dmgAfterTough / HEAL_POWER / BOOSTS.heal.XLHO2.heal) * HEAL_COEF;

    const healPerBee = Math.ceil(healNeeded / 2);
    const toughPerHealerBee = Math.ceil(
      Math.max(
        dmgAfterTough,
        (dmgAfterTough - healPerBee * HEAL_POWER * BOOSTS.heal.XLHO2.heal) * 2
      ) / 100
    );
    const rangedAttackHealer = Math.max(
      MAX_CREEP_SIZE - healPerBee - toughPerHealerBee - 10,
      0
    );
    formationHealerBee.fixed = Array(rangedAttackHealer)
      .fill(RANGED_ATTACK)
      .concat(Array(toughPerHealerBee).fill(TOUGH));
    formationHealerBee.patternLimit = healPerBee;

    const formationDismantleBee = setups.dismantler.copy();
    const toughtPerDismantleBee = Math.ceil((dmgAfterTough * 2) / 100);
    formationDismantleBee.fixed = Array(toughtPerDismantleBee).fill(TOUGH);

    const formation = [
      formationDismantleBee,
      formationDismantleBee,
      formationHealerBee,
      formationHealerBee,
    ];
    return formation;
  }

  private sendSquad(roomName: string) {
    const siedge = this.siedge[roomName];
    if (!siedge || siedge.lastUpdated + CREEP_LIFE_TIME < Game.time) return;
    const hives = _.filter(
      Apiary.hives,
      (h) =>
        h.phase === 2 &&
        h.mode.war &&
        h.resState[RESOURCE_ENERGY] >= 0 &&
        h.pos.getRoomRangeTo(roomName) <= 12
    );
    if (!hives.length) return;
    const slot = _.min(siedge.squadSlots, (s) => s.lastSpawned);
    const hive = hives.reduce((prev, curr) => {
      let ans =
        curr.pos.getRoomRangeTo(roomName) - prev.pos.getRoomRangeTo(roomName);
      if (ans === 0)
        ans = prev.resState[RESOURCE_ENERGY] - curr.resState[RESOURCE_ENERGY];
      return ans < 0 ? curr : prev;
    });
    const ref = makeId(8);
    if (ref in this.squads) return; // try next tick bro (can do a while cycle)

    let formation;

    let dmg = siedge.towerDmgBreach;
    if (siedge.threatLvl > 1) dmg += 660;
    dmg = Math.max(dmg, 330);

    switch (slot.type) {
      case "dism":
        formation = this.getBrigadeFormation(dmg);
        break;
      case "range":
        formation = this.getLegionFormation(dmg);
        break;
      case "duo":
      default:
        formation = this.getDuoFormation(dmg);
    }

    this.squads[ref] = new SquadWarCrimesMaster(this, {
      ref,
      hive: hive.roomName,
      target: { x: slot.breakIn.x, y: slot.breakIn.y, roomName },
      ent: slot.breakIn.ent,
      setup: formation,
      poss: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ].slice(0, formation.length),
      possEnt: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: -2, y: 0 },
      ].slice(0, formation.length),
    });
    // could use getTimeForPath, but this saves some cpu
    slot.lastSpawned = Game.time;
    siedge.attackTime =
      _.min(siedge.squadSlots, (s) => s.lastSpawned).lastSpawned +
      CREEP_LIFE_TIME;
  }

  public update() {
    for (const roomName in this.siedge) {
      this.updateRoom(roomName);
      const attackTime =
        this.siedge[roomName] && this.siedge[roomName].attackTime;
      if (
        attackTime !== null &&
        attackTime <= Game.time &&
        Object.keys(this.siedge[roomName].squadSlots).length &&
        !_.filter(
          this.squads,
          (sq) => sq.pos.roomName === roomName && sq.spawned < sq.targetBeeCount
        ).length
      )
        this.sendSquad(roomName);
    }
  }

  run() {}
}
