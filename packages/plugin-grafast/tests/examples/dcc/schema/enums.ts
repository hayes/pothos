import { builder } from '../builder';

export const Species = builder.enumType('Species', {
  values: {
    HUMAN: { value: 'Human' },
    CAT: { value: 'Cat' },
    CROCODILIAN: { value: 'Crocodilian' },
    CHANGELING: { value: 'Changeling' },
    ROCK_MONSTER: { value: 'Rock Monster' },
    HALF_ELF: { value: 'Half Elf' },
    GONDII: { value: 'Gondii' },
    BOPCA: { value: 'Bopca Protector' },
  },
});

export const ItemType = builder.enumType('ItemType', {
  values: ['Equipment', 'Consumable', 'UtilityItem', 'MiscItem'],
});
