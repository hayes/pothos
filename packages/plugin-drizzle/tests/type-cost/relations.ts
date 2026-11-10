import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';

export const relations = defineRelations(schema, (r) => ({
  table0: {
    parent: r.one.table1({ from: r.table0.parentId, to: r.table1.id, optional: false }),
    children: r.many.table99({ from: r.table0.id, to: r.table99.parentId }),
  },
  table1: {
    parent: r.one.table2({ from: r.table1.parentId, to: r.table2.id, optional: false }),
    children: r.many.table0({ from: r.table1.id, to: r.table0.parentId }),
  },
  table2: {
    parent: r.one.table3({ from: r.table2.parentId, to: r.table3.id, optional: false }),
    children: r.many.table1({ from: r.table2.id, to: r.table1.parentId }),
  },
  table3: {
    parent: r.one.table4({ from: r.table3.parentId, to: r.table4.id, optional: false }),
    children: r.many.table2({ from: r.table3.id, to: r.table2.parentId }),
  },
  table4: {
    parent: r.one.table5({ from: r.table4.parentId, to: r.table5.id, optional: false }),
    children: r.many.table3({ from: r.table4.id, to: r.table3.parentId }),
  },
  table5: {
    parent: r.one.table6({ from: r.table5.parentId, to: r.table6.id, optional: false }),
    children: r.many.table4({ from: r.table5.id, to: r.table4.parentId }),
  },
  table6: {
    parent: r.one.table7({ from: r.table6.parentId, to: r.table7.id, optional: false }),
    children: r.many.table5({ from: r.table6.id, to: r.table5.parentId }),
  },
  table7: {
    parent: r.one.table8({ from: r.table7.parentId, to: r.table8.id, optional: false }),
    children: r.many.table6({ from: r.table7.id, to: r.table6.parentId }),
  },
  table8: {
    parent: r.one.table9({ from: r.table8.parentId, to: r.table9.id, optional: false }),
    children: r.many.table7({ from: r.table8.id, to: r.table7.parentId }),
  },
  table9: {
    parent: r.one.table10({ from: r.table9.parentId, to: r.table10.id, optional: false }),
    children: r.many.table8({ from: r.table9.id, to: r.table8.parentId }),
  },
  table10: {
    parent: r.one.table11({ from: r.table10.parentId, to: r.table11.id, optional: false }),
    children: r.many.table9({ from: r.table10.id, to: r.table9.parentId }),
  },
  table11: {
    parent: r.one.table12({ from: r.table11.parentId, to: r.table12.id, optional: false }),
    children: r.many.table10({ from: r.table11.id, to: r.table10.parentId }),
  },
  table12: {
    parent: r.one.table13({ from: r.table12.parentId, to: r.table13.id, optional: false }),
    children: r.many.table11({ from: r.table12.id, to: r.table11.parentId }),
  },
  table13: {
    parent: r.one.table14({ from: r.table13.parentId, to: r.table14.id, optional: false }),
    children: r.many.table12({ from: r.table13.id, to: r.table12.parentId }),
  },
  table14: {
    parent: r.one.table15({ from: r.table14.parentId, to: r.table15.id, optional: false }),
    children: r.many.table13({ from: r.table14.id, to: r.table13.parentId }),
  },
  table15: {
    parent: r.one.table16({ from: r.table15.parentId, to: r.table16.id, optional: false }),
    children: r.many.table14({ from: r.table15.id, to: r.table14.parentId }),
  },
  table16: {
    parent: r.one.table17({ from: r.table16.parentId, to: r.table17.id, optional: false }),
    children: r.many.table15({ from: r.table16.id, to: r.table15.parentId }),
  },
  table17: {
    parent: r.one.table18({ from: r.table17.parentId, to: r.table18.id, optional: false }),
    children: r.many.table16({ from: r.table17.id, to: r.table16.parentId }),
  },
  table18: {
    parent: r.one.table19({ from: r.table18.parentId, to: r.table19.id, optional: false }),
    children: r.many.table17({ from: r.table18.id, to: r.table17.parentId }),
  },
  table19: {
    parent: r.one.table20({ from: r.table19.parentId, to: r.table20.id, optional: false }),
    children: r.many.table18({ from: r.table19.id, to: r.table18.parentId }),
  },
  table20: {
    parent: r.one.table21({ from: r.table20.parentId, to: r.table21.id, optional: false }),
    children: r.many.table19({ from: r.table20.id, to: r.table19.parentId }),
  },
  table21: {
    parent: r.one.table22({ from: r.table21.parentId, to: r.table22.id, optional: false }),
    children: r.many.table20({ from: r.table21.id, to: r.table20.parentId }),
  },
  table22: {
    parent: r.one.table23({ from: r.table22.parentId, to: r.table23.id, optional: false }),
    children: r.many.table21({ from: r.table22.id, to: r.table21.parentId }),
  },
  table23: {
    parent: r.one.table24({ from: r.table23.parentId, to: r.table24.id, optional: false }),
    children: r.many.table22({ from: r.table23.id, to: r.table22.parentId }),
  },
  table24: {
    parent: r.one.table25({ from: r.table24.parentId, to: r.table25.id, optional: false }),
    children: r.many.table23({ from: r.table24.id, to: r.table23.parentId }),
  },
  table25: {
    parent: r.one.table26({ from: r.table25.parentId, to: r.table26.id, optional: false }),
    children: r.many.table24({ from: r.table25.id, to: r.table24.parentId }),
  },
  table26: {
    parent: r.one.table27({ from: r.table26.parentId, to: r.table27.id, optional: false }),
    children: r.many.table25({ from: r.table26.id, to: r.table25.parentId }),
  },
  table27: {
    parent: r.one.table28({ from: r.table27.parentId, to: r.table28.id, optional: false }),
    children: r.many.table26({ from: r.table27.id, to: r.table26.parentId }),
  },
  table28: {
    parent: r.one.table29({ from: r.table28.parentId, to: r.table29.id, optional: false }),
    children: r.many.table27({ from: r.table28.id, to: r.table27.parentId }),
  },
  table29: {
    parent: r.one.table30({ from: r.table29.parentId, to: r.table30.id, optional: false }),
    children: r.many.table28({ from: r.table29.id, to: r.table28.parentId }),
  },
  table30: {
    parent: r.one.table31({ from: r.table30.parentId, to: r.table31.id, optional: false }),
    children: r.many.table29({ from: r.table30.id, to: r.table29.parentId }),
  },
  table31: {
    parent: r.one.table32({ from: r.table31.parentId, to: r.table32.id, optional: false }),
    children: r.many.table30({ from: r.table31.id, to: r.table30.parentId }),
  },
  table32: {
    parent: r.one.table33({ from: r.table32.parentId, to: r.table33.id, optional: false }),
    children: r.many.table31({ from: r.table32.id, to: r.table31.parentId }),
  },
  table33: {
    parent: r.one.table34({ from: r.table33.parentId, to: r.table34.id, optional: false }),
    children: r.many.table32({ from: r.table33.id, to: r.table32.parentId }),
  },
  table34: {
    parent: r.one.table35({ from: r.table34.parentId, to: r.table35.id, optional: false }),
    children: r.many.table33({ from: r.table34.id, to: r.table33.parentId }),
  },
  table35: {
    parent: r.one.table36({ from: r.table35.parentId, to: r.table36.id, optional: false }),
    children: r.many.table34({ from: r.table35.id, to: r.table34.parentId }),
  },
  table36: {
    parent: r.one.table37({ from: r.table36.parentId, to: r.table37.id, optional: false }),
    children: r.many.table35({ from: r.table36.id, to: r.table35.parentId }),
  },
  table37: {
    parent: r.one.table38({ from: r.table37.parentId, to: r.table38.id, optional: false }),
    children: r.many.table36({ from: r.table37.id, to: r.table36.parentId }),
  },
  table38: {
    parent: r.one.table39({ from: r.table38.parentId, to: r.table39.id, optional: false }),
    children: r.many.table37({ from: r.table38.id, to: r.table37.parentId }),
  },
  table39: {
    parent: r.one.table40({ from: r.table39.parentId, to: r.table40.id, optional: false }),
    children: r.many.table38({ from: r.table39.id, to: r.table38.parentId }),
  },
  table40: {
    parent: r.one.table41({ from: r.table40.parentId, to: r.table41.id, optional: false }),
    children: r.many.table39({ from: r.table40.id, to: r.table39.parentId }),
  },
  table41: {
    parent: r.one.table42({ from: r.table41.parentId, to: r.table42.id, optional: false }),
    children: r.many.table40({ from: r.table41.id, to: r.table40.parentId }),
  },
  table42: {
    parent: r.one.table43({ from: r.table42.parentId, to: r.table43.id, optional: false }),
    children: r.many.table41({ from: r.table42.id, to: r.table41.parentId }),
  },
  table43: {
    parent: r.one.table44({ from: r.table43.parentId, to: r.table44.id, optional: false }),
    children: r.many.table42({ from: r.table43.id, to: r.table42.parentId }),
  },
  table44: {
    parent: r.one.table45({ from: r.table44.parentId, to: r.table45.id, optional: false }),
    children: r.many.table43({ from: r.table44.id, to: r.table43.parentId }),
  },
  table45: {
    parent: r.one.table46({ from: r.table45.parentId, to: r.table46.id, optional: false }),
    children: r.many.table44({ from: r.table45.id, to: r.table44.parentId }),
  },
  table46: {
    parent: r.one.table47({ from: r.table46.parentId, to: r.table47.id, optional: false }),
    children: r.many.table45({ from: r.table46.id, to: r.table45.parentId }),
  },
  table47: {
    parent: r.one.table48({ from: r.table47.parentId, to: r.table48.id, optional: false }),
    children: r.many.table46({ from: r.table47.id, to: r.table46.parentId }),
  },
  table48: {
    parent: r.one.table49({ from: r.table48.parentId, to: r.table49.id, optional: false }),
    children: r.many.table47({ from: r.table48.id, to: r.table47.parentId }),
  },
  table49: {
    parent: r.one.table50({ from: r.table49.parentId, to: r.table50.id, optional: false }),
    children: r.many.table48({ from: r.table49.id, to: r.table48.parentId }),
  },
  table50: {
    parent: r.one.table51({ from: r.table50.parentId, to: r.table51.id, optional: false }),
    children: r.many.table49({ from: r.table50.id, to: r.table49.parentId }),
  },
  table51: {
    parent: r.one.table52({ from: r.table51.parentId, to: r.table52.id, optional: false }),
    children: r.many.table50({ from: r.table51.id, to: r.table50.parentId }),
  },
  table52: {
    parent: r.one.table53({ from: r.table52.parentId, to: r.table53.id, optional: false }),
    children: r.many.table51({ from: r.table52.id, to: r.table51.parentId }),
  },
  table53: {
    parent: r.one.table54({ from: r.table53.parentId, to: r.table54.id, optional: false }),
    children: r.many.table52({ from: r.table53.id, to: r.table52.parentId }),
  },
  table54: {
    parent: r.one.table55({ from: r.table54.parentId, to: r.table55.id, optional: false }),
    children: r.many.table53({ from: r.table54.id, to: r.table53.parentId }),
  },
  table55: {
    parent: r.one.table56({ from: r.table55.parentId, to: r.table56.id, optional: false }),
    children: r.many.table54({ from: r.table55.id, to: r.table54.parentId }),
  },
  table56: {
    parent: r.one.table57({ from: r.table56.parentId, to: r.table57.id, optional: false }),
    children: r.many.table55({ from: r.table56.id, to: r.table55.parentId }),
  },
  table57: {
    parent: r.one.table58({ from: r.table57.parentId, to: r.table58.id, optional: false }),
    children: r.many.table56({ from: r.table57.id, to: r.table56.parentId }),
  },
  table58: {
    parent: r.one.table59({ from: r.table58.parentId, to: r.table59.id, optional: false }),
    children: r.many.table57({ from: r.table58.id, to: r.table57.parentId }),
  },
  table59: {
    parent: r.one.table60({ from: r.table59.parentId, to: r.table60.id, optional: false }),
    children: r.many.table58({ from: r.table59.id, to: r.table58.parentId }),
  },
  table60: {
    parent: r.one.table61({ from: r.table60.parentId, to: r.table61.id, optional: false }),
    children: r.many.table59({ from: r.table60.id, to: r.table59.parentId }),
  },
  table61: {
    parent: r.one.table62({ from: r.table61.parentId, to: r.table62.id, optional: false }),
    children: r.many.table60({ from: r.table61.id, to: r.table60.parentId }),
  },
  table62: {
    parent: r.one.table63({ from: r.table62.parentId, to: r.table63.id, optional: false }),
    children: r.many.table61({ from: r.table62.id, to: r.table61.parentId }),
  },
  table63: {
    parent: r.one.table64({ from: r.table63.parentId, to: r.table64.id, optional: false }),
    children: r.many.table62({ from: r.table63.id, to: r.table62.parentId }),
  },
  table64: {
    parent: r.one.table65({ from: r.table64.parentId, to: r.table65.id, optional: false }),
    children: r.many.table63({ from: r.table64.id, to: r.table63.parentId }),
  },
  table65: {
    parent: r.one.table66({ from: r.table65.parentId, to: r.table66.id, optional: false }),
    children: r.many.table64({ from: r.table65.id, to: r.table64.parentId }),
  },
  table66: {
    parent: r.one.table67({ from: r.table66.parentId, to: r.table67.id, optional: false }),
    children: r.many.table65({ from: r.table66.id, to: r.table65.parentId }),
  },
  table67: {
    parent: r.one.table68({ from: r.table67.parentId, to: r.table68.id, optional: false }),
    children: r.many.table66({ from: r.table67.id, to: r.table66.parentId }),
  },
  table68: {
    parent: r.one.table69({ from: r.table68.parentId, to: r.table69.id, optional: false }),
    children: r.many.table67({ from: r.table68.id, to: r.table67.parentId }),
  },
  table69: {
    parent: r.one.table70({ from: r.table69.parentId, to: r.table70.id, optional: false }),
    children: r.many.table68({ from: r.table69.id, to: r.table68.parentId }),
  },
  table70: {
    parent: r.one.table71({ from: r.table70.parentId, to: r.table71.id, optional: false }),
    children: r.many.table69({ from: r.table70.id, to: r.table69.parentId }),
  },
  table71: {
    parent: r.one.table72({ from: r.table71.parentId, to: r.table72.id, optional: false }),
    children: r.many.table70({ from: r.table71.id, to: r.table70.parentId }),
  },
  table72: {
    parent: r.one.table73({ from: r.table72.parentId, to: r.table73.id, optional: false }),
    children: r.many.table71({ from: r.table72.id, to: r.table71.parentId }),
  },
  table73: {
    parent: r.one.table74({ from: r.table73.parentId, to: r.table74.id, optional: false }),
    children: r.many.table72({ from: r.table73.id, to: r.table72.parentId }),
  },
  table74: {
    parent: r.one.table75({ from: r.table74.parentId, to: r.table75.id, optional: false }),
    children: r.many.table73({ from: r.table74.id, to: r.table73.parentId }),
  },
  table75: {
    parent: r.one.table76({ from: r.table75.parentId, to: r.table76.id, optional: false }),
    children: r.many.table74({ from: r.table75.id, to: r.table74.parentId }),
  },
  table76: {
    parent: r.one.table77({ from: r.table76.parentId, to: r.table77.id, optional: false }),
    children: r.many.table75({ from: r.table76.id, to: r.table75.parentId }),
  },
  table77: {
    parent: r.one.table78({ from: r.table77.parentId, to: r.table78.id, optional: false }),
    children: r.many.table76({ from: r.table77.id, to: r.table76.parentId }),
  },
  table78: {
    parent: r.one.table79({ from: r.table78.parentId, to: r.table79.id, optional: false }),
    children: r.many.table77({ from: r.table78.id, to: r.table77.parentId }),
  },
  table79: {
    parent: r.one.table80({ from: r.table79.parentId, to: r.table80.id, optional: false }),
    children: r.many.table78({ from: r.table79.id, to: r.table78.parentId }),
  },
  table80: {
    parent: r.one.table81({ from: r.table80.parentId, to: r.table81.id, optional: false }),
    children: r.many.table79({ from: r.table80.id, to: r.table79.parentId }),
  },
  table81: {
    parent: r.one.table82({ from: r.table81.parentId, to: r.table82.id, optional: false }),
    children: r.many.table80({ from: r.table81.id, to: r.table80.parentId }),
  },
  table82: {
    parent: r.one.table83({ from: r.table82.parentId, to: r.table83.id, optional: false }),
    children: r.many.table81({ from: r.table82.id, to: r.table81.parentId }),
  },
  table83: {
    parent: r.one.table84({ from: r.table83.parentId, to: r.table84.id, optional: false }),
    children: r.many.table82({ from: r.table83.id, to: r.table82.parentId }),
  },
  table84: {
    parent: r.one.table85({ from: r.table84.parentId, to: r.table85.id, optional: false }),
    children: r.many.table83({ from: r.table84.id, to: r.table83.parentId }),
  },
  table85: {
    parent: r.one.table86({ from: r.table85.parentId, to: r.table86.id, optional: false }),
    children: r.many.table84({ from: r.table85.id, to: r.table84.parentId }),
  },
  table86: {
    parent: r.one.table87({ from: r.table86.parentId, to: r.table87.id, optional: false }),
    children: r.many.table85({ from: r.table86.id, to: r.table85.parentId }),
  },
  table87: {
    parent: r.one.table88({ from: r.table87.parentId, to: r.table88.id, optional: false }),
    children: r.many.table86({ from: r.table87.id, to: r.table86.parentId }),
  },
  table88: {
    parent: r.one.table89({ from: r.table88.parentId, to: r.table89.id, optional: false }),
    children: r.many.table87({ from: r.table88.id, to: r.table87.parentId }),
  },
  table89: {
    parent: r.one.table90({ from: r.table89.parentId, to: r.table90.id, optional: false }),
    children: r.many.table88({ from: r.table89.id, to: r.table88.parentId }),
  },
  table90: {
    parent: r.one.table91({ from: r.table90.parentId, to: r.table91.id, optional: false }),
    children: r.many.table89({ from: r.table90.id, to: r.table89.parentId }),
  },
  table91: {
    parent: r.one.table92({ from: r.table91.parentId, to: r.table92.id, optional: false }),
    children: r.many.table90({ from: r.table91.id, to: r.table90.parentId }),
  },
  table92: {
    parent: r.one.table93({ from: r.table92.parentId, to: r.table93.id, optional: false }),
    children: r.many.table91({ from: r.table92.id, to: r.table91.parentId }),
  },
  table93: {
    parent: r.one.table94({ from: r.table93.parentId, to: r.table94.id, optional: false }),
    children: r.many.table92({ from: r.table93.id, to: r.table92.parentId }),
  },
  table94: {
    parent: r.one.table95({ from: r.table94.parentId, to: r.table95.id, optional: false }),
    children: r.many.table93({ from: r.table94.id, to: r.table93.parentId }),
  },
  table95: {
    parent: r.one.table96({ from: r.table95.parentId, to: r.table96.id, optional: false }),
    children: r.many.table94({ from: r.table95.id, to: r.table94.parentId }),
  },
  table96: {
    parent: r.one.table97({ from: r.table96.parentId, to: r.table97.id, optional: false }),
    children: r.many.table95({ from: r.table96.id, to: r.table95.parentId }),
  },
  table97: {
    parent: r.one.table98({ from: r.table97.parentId, to: r.table98.id, optional: false }),
    children: r.many.table96({ from: r.table97.id, to: r.table96.parentId }),
  },
  table98: {
    parent: r.one.table99({ from: r.table98.parentId, to: r.table99.id, optional: false }),
    children: r.many.table97({ from: r.table98.id, to: r.table97.parentId }),
  },
  table99: {
    parent: r.one.table0({ from: r.table99.parentId, to: r.table0.id, optional: false }),
    children: r.many.table98({ from: r.table99.id, to: r.table98.parentId }),
  },
}));
