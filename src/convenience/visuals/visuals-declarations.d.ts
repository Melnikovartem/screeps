import type { ResourceColors } from "./visluals-planning";

// neural net generated so be careful

declare global {
  interface StructureOptions {
    opacity?: number;
  }

  interface SpeechOptions {
    background?: string;
    textcolor?: string;
    textstyle?: string;
    textsize?: number;
    textfont?: string;
    opacity?: number;
  }

  interface AnimatedPositionOptions {
    color?: string;
    opacity?: number;
    radius?: number;
    frames?: number;
  }

  interface RoadOptions {
    color?: string;
    opacity?: number;
  }

  interface RoomVisual {
    roads: [number, number][];
    structure(
      x: number,
      y: number,
      type: string,
      opts?: StructureOptions
    ): RoomVisual;

    speech(
      text: string,
      x: number,
      y: number,
      opts?: SpeechOptions
    ): RoomVisual;

    animatedPosition(
      x: number,
      y: number,
      opts?: AnimatedPositionOptions
    ): RoomVisual;

    connectRoads(opts?: RoadOptions): RoomVisual;

    test(): RoomVisual;

    resource(
      type: keyof typeof ResourceColors,
      x: number,
      y: number,
      size?: number
    ): OK | ERR_INVALID_ARGS;

    _fluid(
      type: keyof typeof ResourceColors,
      x: number,
      y: number,
      size?: number
    ): void;
    _mineral(
      type: keyof typeof ResourceColors,
      x: number,
      y: number,
      size?: number
    ): void;
    _compound(
      type: keyof typeof ResourceColors,
      x: number,
      y: number,
      size?: number
    ): void;
  }
}
