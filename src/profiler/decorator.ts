import profiler from "screeps-profiler";

import { PROFILER } from "../settings";

// This is a *not yet modified* version of screeps-profiler taken from https://github.com/bencbartlett/Overmind

export function profile(target: Function): void;
export function profile(
  target: object,
  key: string | symbol,
  _descriptor: TypedPropertyDescriptor<Function>
): void;
export function profile(
  target: object | Function,
  key?: string | symbol,
  _descriptor?: TypedPropertyDescriptor<Function>
): void {
  if (!PROFILER) {
    return;
  }

  if (key) {
    // case of method decorator
    profiler.registerFN(target as Function, key as string);
    return;
  }

  // case of class decorator
  const ctor = target as any;
  if (!ctor.prototype) {
    return;
  }

  const className = ctor.name;
  profiler.registerClass(target as Function, className);
}
