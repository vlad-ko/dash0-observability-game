// Writes docs/GLOSSARY.md from the files in content/core/glossary/ (#428, #427). Run: node tools/build-glossary-doc.mjs
// test/glossary.test.mjs fails when the committed doc differs from this output.
import { writeFileSync } from 'node:fs';
import { GLOSSARY } from '../content/core/glossary/index.mjs';
import { glossaryDoc } from '../lib/glossary.mjs';

const target = new URL('../docs/GLOSSARY.md', import.meta.url);
writeFileSync(target, glossaryDoc(GLOSSARY));
console.log(`wrote ${target.pathname} (${GLOSSARY.terms.length} terms)`);
