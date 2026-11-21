import type { Availability, Resource } from "../types/api.types.js";
import { request } from "./client.js";

export const listResources = () => request<Resource[]>("/resources");

export const checkAvailability = (resource: string, start: number, end: number, signal: AbortSignal) =>
  request<Availability>(`/resources/${encodeURIComponent(resource)}/availability?start=${start}&end=${end}`, {
    signal,
  });
