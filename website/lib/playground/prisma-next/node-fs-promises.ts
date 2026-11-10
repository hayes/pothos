// The ORM's runtime entry also reaches its migration tooling, which never runs in the playground.
function unavailable(): never {
  throw new Error('The file system is not available in the playground.');
}

export const copyFile = unavailable;
export const mkdir = unavailable;
export const readFile = unavailable;
export const readdir = unavailable;
export const rename = unavailable;
export const rm = unavailable;
export const stat = unavailable;
export const writeFile = unavailable;
