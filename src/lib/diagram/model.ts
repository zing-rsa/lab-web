import { buildLayout } from "./layout";

export const LAID = buildLayout();
export const LAID_BY_ID = new Map(LAID.map((n) => [n.id, n]));
