import type { BuildProject, Hive } from "hive/hive";
import { WALLS_START } from "static/constants";
import { getCase, makeId } from "static/utils";

const RAMPART_BUFFER_ZONE = {
  aliveBees: 20_000,
  noBees: 50_000,
};
const CONSTRUCTIONS_PER_TYPE = 5;

export function checkBuildings(
  roomName: string,
  queToCheck: BuildableStructureConstant[],
  fearNukes: boolean,
  specials: { [key in StructureConstant]?: number } = {}
): [BuildProject[], number] {
  if (!(roomName in Game.rooms) || !Memory.cache.roomPlanner[roomName])
    return [[], 0];

  const contr = Game.rooms[roomName].controller;
  const hive = Apiary.hives[roomName] as Hive | undefined;
  const nukeAlert =
    fearNukes && hive && Object.keys(hive.cells.defense.nukes).length > 0;
  let controller: StructureController | { level: number } | undefined = contr;
  if (!controller) controller = { level: 0 };

  const buildProjectList: BuildProject[] = [];
  let constructions = 0;
  let energyCost = 0;

  for (const sType of queToCheck) {
    const mem = Memory.cache.roomPlanner[roomName][sType];
    if (!mem) continue;

    const cc = getCase({
      structureType: sType,
      pos: { roomName },
      hitsMax: 0,
    });

    const toadd: RoomPosition[] = [];
    const isDefense = sType === STRUCTURE_RAMPART || sType === STRUCTURE_WALL;
    let placed = 0;

    for (const positionToPut of mem.pos) {
      const pos = new RoomPosition(positionToPut.x, positionToPut.y, roomName);
      const structure = _.filter(
        pos.lookFor(LOOK_STRUCTURES),
        (s) => s.structureType === sType
      )[0] as Structure<BuildableStructureConstant> | undefined;

      if (structure) {
        placed++;
        let heal = getCase(structure).heal;
        if (sType in specials) heal = specials[sType]!;
        if (sType === STRUCTURE_RAMPART)
          heal -= Math.min(
            heal * 0.5,
            hive && hive.builder && hive.builder.activeBees
              ? RAMPART_BUFFER_ZONE.aliveBees
              : RAMPART_BUFFER_ZONE.noBees
          );
        if (nukeAlert && isDefense) {
          const nukeDmg = _.sum(
            pos.findInRange(FIND_NUKES, 2),
            (n) =>
              NUKE_DAMAGE[2] +
              (n.pos.getRangeTo(pos) === 0 ? NUKE_DAMAGE[0] : 0)
          );
          if (nukeDmg > 0 && nukeDmg < 2 * heal) heal = nukeDmg + heal;
        }
        if (structure.hits < heal)
          buildProjectList.push({
            pos,
            sType,
            targetHits: heal,
            energyCost: Math.ceil((heal - structure.hits) / 100),
            type: "repair",
          });
      } else {
        const constructionSite = _.filter(
          pos.lookFor(LOOK_CONSTRUCTION_SITES),
          (s) => s.structureType === sType
        )[0] as ConstructionSite<BuildableStructureConstant> | undefined;

        if (!constructionSite) {
          // anything on this pos
          const place = _.filter(
            pos.lookFor(LOOK_STRUCTURES),
            (s) =>
              s.structureType !== STRUCTURE_RAMPART ||
              !(s as StructureRampart).my
          )[0];

          if (!place) toadd.push(pos);
          else if (hive) {
            if (
              sType !== STRUCTURE_SPAWN ||
              Object.keys(hive.cells.spawn).length > 1
            )
              // remove if i can and (should?)
              place.destroy();
          } else if (
            !place.pos
              .lookFor(LOOK_FLAGS)
              .filter(
                (f) => f.color === COLOR_GREY && f.secondaryColor === COLOR_RED
              ).length
          )
            // demolish whatever was there
            place.pos.createFlag("remove_" + makeId(4), COLOR_GREY, COLOR_RED);
        } else if (constructionSite) {
          ++constructions;
          buildProjectList.push({
            pos,
            sType,
            targetHits: 0,
            energyCost:
              constructionSite.progressTotal - constructionSite.progress,
            type: "construction",
          });
          if (isDefense) {
            let heal = getCase(constructionSite).heal;
            if (sType in specials) heal = specials[sType]!;
            buildProjectList.push({
              pos,
              sType,
              targetHits: heal,
              energyCost: Math.ceil(heal / 100),
              type: "repair",
            });
          }
        }
      }
    }

    energyCost += _.sum(buildProjectList, (bProject) => bProject.energyCost);
    if (!constructions)
      for (let i = 0; i < toadd.length && i < cc.amount - placed; ++i) {
        let createAns;
        if (nukeAlert && toadd[i].findInRange(FIND_NUKES, 2).length) continue;
        if (constructions >= CONSTRUCTIONS_PER_TYPE) break;

        if (sType === STRUCTURE_SPAWN)
          // @todo more original name for spawn
          createAns = toadd[i].createConstructionSite(
            sType,
            roomName.toLowerCase() + "_" + makeId(4)
          );
        else createAns = toadd[i].createConstructionSite(sType);

        if (createAns === OK) {
          buildProjectList.push({
            pos: toadd[i],
            sType,
            targetHits: 0,
            energyCost: CONSTRUCTION_COST[sType],
            type: "construction",
          });
          ++constructions;
        }
        // add even if no construction cost so we can plan bases at all volume of jobs
        energyCost += CONSTRUCTION_COST[sType];

        if (isDefense) {
          let heal = WALLS_START;
          if (sType in specials) heal = specials[sType]!;

          // need only 1 energy so also add building them u
          if (createAns === OK)
            buildProjectList.push({
              pos: toadd[i],
              sType,
              targetHits: heal,
              energyCost: Math.ceil(heal / 100),
              type: "repair",
            });
          // also add energy Cost
          energyCost += Math.ceil(heal / 100);
        }
      }
  }
  return [buildProjectList, energyCost];
}

export function checkMinWallHealth(roomName: string) {
  const mem = Memory.cache.roomPlanner[roomName];
  if (!mem) return 0;
  let minHealth = Infinity;

  const check = (sType: STRUCTURE_RAMPART | STRUCTURE_WALL) => {
    if (!mem[sType]) return;
    _.forEach(mem[sType]!.pos, (pos) => {
      const struct = new RoomPosition(pos.x, pos.y, roomName)
        .lookFor(LOOK_STRUCTURES)
        .filter((s) => s.structureType === sType)[0];
      if (struct && struct.hits < minHealth) minHealth = struct.hits;
    });
  };

  check(STRUCTURE_RAMPART);
  check(STRUCTURE_WALL);

  return minHealth === Infinity ? 0 : minHealth;
}