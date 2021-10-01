import { setups } from "../../bees/creepsetups";
import { SquadMaster, FormationPosition } from "./squad";

export class TestSquad extends SquadMaster {
  formation = [
    <FormationPosition>[{ x: 0, y: 0 }, setups.puppet],
    <FormationPosition>[{ x: 1, y: 0 }, setups.puppet],
    <FormationPosition>[{ x: 0, y: 1 }, setups.puppet],
    <FormationPosition>[{ x: 1, y: 1 }, setups.puppet]];
}
