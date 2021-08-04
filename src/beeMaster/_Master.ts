
// i will need to do something so i can build up structure from memory
export abstract class Master {
  constructor() { }

  // first stage of decision making like do i need to spawn new creeps
  abstract init(): void;

  // second stage of decision making like where do i need to move
  abstract run(): void;

}
