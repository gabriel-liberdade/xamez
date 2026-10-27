import { writeFileSync } from 'node:fs';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { projectSchema } from '../packages/project-format/src/schema';
writeFileSync(
  'packages/project-format/project.schema.json',
  JSON.stringify(zodToJsonSchema(projectSchema, { name: 'XamezProject' }), null, 2) + '\n',
);
