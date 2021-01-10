/* eslint-disable max-classes-per-file */

import '@giraphql/core';
import { PermissionGrantMap } from './types';

export class GrantedPermissions {
  private type: string;

  private map: GrantMap;

  constructor(type: string, map: GrantMap) {
    this.type = type;
    this.map = map;
  }

  has(name: string) {
    return this.map.hasPermission(this.type, name);
  }

  add(name: string) {
    this.map.addPermission(this.type, name);

    return this;
  }

  delete(name: string) {
    const hadPerm = this.has(name);

    if (!hadPerm) {
      return false;
    }

    this.map.sharedPermissions.delete(name);

    this.map.removePermission(this.type, name);

    return true;
  }
}

export default class GrantMap {
  typePermissions = new Map<string, Set<string>>();

  sharedPermissions = new Set<string>();

  addPermission(type: string, name: string) {
    this.setForType(type).add(name);
  }

  addSharedPermission(name: string) {
    this.sharedPermissions.add(name);
  }

  hasPermission(type: string, name: string) {
    return this.sharedPermissions.has(name) || this.setForType(type).has(name);
  }

  removePermission(type: string, name: string) {
    return this.setForType(type).delete(name);
  }

  mergeGrants(type: string, newGrants: PermissionGrantMap) {
    Object.keys(newGrants).forEach((key) => {
      if (newGrants[key]) {
        this.addPermission(type, key);
      }
    });
  }

  mergeSharedGrants(newGrants: PermissionGrantMap) {
    Object.keys(newGrants).forEach((key) => {
      if (newGrants[key]) {
        this.addSharedPermission(key);
      }
    });

    return this;
  }

  clone() {
    const clone = new GrantMap();

    for (const [type, set] of this.typePermissions) {
      clone.typePermissions.set(type, new Set(set));
    }

    clone.sharedPermissions = new Set(this.sharedPermissions);

    return clone;
  }

  permissionsForType(type: string) {
    return new GrantedPermissions(type, this);
  }

  private setForType(type: string) {
    if (!this.typePermissions.has(type)) {
      this.typePermissions.set(type, new Set());
    }

    return this.typePermissions.get(type)!;
  }
}
