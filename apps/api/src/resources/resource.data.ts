import type { Resource } from "./resource.types.js";

export const RESOURCES: readonly Resource[] = [
  { id: "R1", name: "Meeting room 1" },
  { id: "R2", name: "Meeting room 2" },
  { id: "R3", name: "Projector" },
];

export function findResource(resources: readonly Resource[], id: string): Resource | undefined {
  return resources.find((r) => r.id === id);
}
