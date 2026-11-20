// Every glossary file, in the order that decides a name clash (#427, docs/CONTENT.md "The glossary"): `general`
// first, then the acts in act order. One file per act, named after the act id; add a file by adding its import
// and one entry here. The join adds each term's `act` from its file name.
import { joinGlossaryFiles } from '../../../lib/glossary.mjs';
import general from './general.mjs';
import act0 from './act-0.mjs';
import act1 from './act-1.mjs';
import act2 from './act-2.mjs';
import act3 from './act-3.mjs';
import act4 from './act-4.mjs';
import act5 from './act-5.mjs';
import act6 from './act-6.mjs';
import act7 from './act-7.mjs';
import act8 from './act-8.mjs';
import act9 from './act-9.mjs';

export const GLOSSARY_FILES = [
  { name: 'general', glossary: general },
  { name: 'act-0', glossary: act0 },
  { name: 'act-1', glossary: act1 },
  { name: 'act-2', glossary: act2 },
  { name: 'act-3', glossary: act3 },
  { name: 'act-4', glossary: act4 },
  { name: 'act-5', glossary: act5 },
  { name: 'act-6', glossary: act6 },
  { name: 'act-7', glossary: act7 },
  { name: 'act-8', glossary: act8 },
  { name: 'act-9', glossary: act9 },
];

export const GLOSSARY = joinGlossaryFiles(GLOSSARY_FILES);

export default GLOSSARY;
