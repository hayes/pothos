import { ObjectType } from '../types';

// To get the type name of an object type, extract the `target`s `__name__` prop.
// eg. { target: { __name__: "default::User" } } -> "default::User" -> "User"
export function extractTargetTypeName(target: ObjectType): string {
  const targetName = target.__name__;
  if (!targetName || typeof targetName !== 'string') {
    throw new Error(`Target type has no name: ${target}.`);
  }

  let prefix: string = '';
  if (targetName.startsWith('default::')) {
    prefix = 'default::';
  }

  return targetName.replace(prefix, '');
}
