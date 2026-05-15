//#region src/exports/pack.d.ts
declare const sqlFamilyPack: {
  readonly kind: "family";
  readonly id: "sql";
  readonly familyId: "sql";
  readonly version: "0.0.1";
  readonly authoring: {
    readonly field: {
      readonly uuid: {
        readonly kind: "fieldPreset";
        readonly output: {
          readonly codecId: "sql/char@1";
          readonly nativeType: "character";
          readonly typeParams: {
            readonly length: 36;
          };
        };
      };
      readonly ulid: {
        readonly kind: "fieldPreset";
        readonly output: {
          readonly codecId: "sql/char@1";
          readonly nativeType: "character";
          readonly typeParams: {
            readonly length: 26;
          };
        };
      };
      readonly nanoid: {
        readonly kind: "fieldPreset";
        readonly args: readonly [{
          readonly kind: "object";
          readonly optional: true;
          readonly properties: {
            readonly size: {
              readonly kind: "number";
              readonly optional: true;
              readonly integer: true;
              readonly minimum: 2;
              readonly maximum: 255;
            };
          };
        }];
        readonly output: {
          readonly codecId: "sql/char@1";
          readonly nativeType: "character";
          readonly typeParams: {
            readonly length: {
              readonly kind: "arg";
              readonly index: 0;
              readonly path: readonly ["size"];
              readonly default: 21;
            };
          };
        };
      };
      readonly cuid2: {
        readonly kind: "fieldPreset";
        readonly output: {
          readonly codecId: "sql/char@1";
          readonly nativeType: "character";
          readonly typeParams: {
            readonly length: 24;
          };
        };
      };
      readonly ksuid: {
        readonly kind: "fieldPreset";
        readonly output: {
          readonly codecId: "sql/char@1";
          readonly nativeType: "character";
          readonly typeParams: {
            readonly length: 27;
          };
        };
      };
      readonly id: {
        readonly uuidv4: {
          readonly kind: "fieldPreset";
          readonly output: {
            readonly codecId: "sql/char@1";
            readonly nativeType: "character";
            readonly typeParams: {
              readonly length: 36;
            };
            readonly executionDefault: {
              readonly kind: "generator";
              readonly id: "uuidv4";
            };
            readonly id: true;
          };
        };
        readonly uuidv7: {
          readonly kind: "fieldPreset";
          readonly output: {
            readonly codecId: "sql/char@1";
            readonly nativeType: "character";
            readonly typeParams: {
              readonly length: 36;
            };
            readonly executionDefault: {
              readonly kind: "generator";
              readonly id: "uuidv7";
            };
            readonly id: true;
          };
        };
        readonly ulid: {
          readonly kind: "fieldPreset";
          readonly output: {
            readonly codecId: "sql/char@1";
            readonly nativeType: "character";
            readonly typeParams: {
              readonly length: 26;
            };
            readonly executionDefault: {
              readonly kind: "generator";
              readonly id: "ulid";
            };
            readonly id: true;
          };
        };
        readonly nanoid: {
          readonly kind: "fieldPreset";
          readonly args: readonly [{
            readonly kind: "object";
            readonly optional: true;
            readonly properties: {
              readonly size: {
                readonly kind: "number";
                readonly optional: true;
                readonly integer: true;
                readonly minimum: 2;
                readonly maximum: 255;
              };
            };
          }];
          readonly output: {
            readonly codecId: "sql/char@1";
            readonly nativeType: "character";
            readonly typeParams: {
              readonly length: {
                readonly kind: "arg";
                readonly index: 0;
                readonly path: readonly ["size"];
                readonly default: 21;
              };
            };
            readonly executionDefault: {
              readonly kind: "generator";
              readonly id: "nanoid";
              readonly params: {
                readonly size: {
                  readonly kind: "arg";
                  readonly index: 0;
                  readonly path: readonly ["size"];
                };
              };
            };
            readonly id: true;
          };
        };
        readonly cuid2: {
          readonly kind: "fieldPreset";
          readonly output: {
            readonly codecId: "sql/char@1";
            readonly nativeType: "character";
            readonly typeParams: {
              readonly length: 24;
            };
            readonly executionDefault: {
              readonly kind: "generator";
              readonly id: "cuid2";
            };
            readonly id: true;
          };
        };
        readonly ksuid: {
          readonly kind: "fieldPreset";
          readonly output: {
            readonly codecId: "sql/char@1";
            readonly nativeType: "character";
            readonly typeParams: {
              readonly length: 27;
            };
            readonly executionDefault: {
              readonly kind: "generator";
              readonly id: "ksuid";
            };
            readonly id: true;
          };
        };
      };
    };
    readonly type: {
      readonly sql: {
        readonly String: {
          readonly kind: "typeConstructor";
          readonly args: readonly [{
            readonly kind: "number";
            readonly name: "length";
            readonly integer: true;
            readonly minimum: 1;
            readonly maximum: 10485760;
          }];
          readonly output: {
            readonly codecId: "sql/varchar@1";
            readonly nativeType: "character varying";
            readonly typeParams: {
              readonly length: {
                readonly kind: "arg";
                readonly index: 0;
              };
            };
          };
        };
      };
    };
  };
};
//#endregion
export { sqlFamilyPack as default };
//# sourceMappingURL=pack.d.mts.map