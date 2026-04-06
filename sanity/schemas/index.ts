import type { SchemaTypeDefinition } from "sanity";
import { article } from "./article";
import { author } from "./author";
import { pillar } from "./pillar";
import { country } from "./country";
import { tag } from "./tag";

export const schemaTypes: SchemaTypeDefinition[] = [
  article,
  author,
  pillar,
  country,
  tag,
];
