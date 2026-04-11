import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./sanity/schemas";
import { headlineGeneratorPlugin } from "./sanity-plugin-headline-generator/src";

export default defineConfig({
  name: "the-alignment-times",
  title: "The Alignment Times",

  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "placeholder",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",

  plugins: [
    structureTool(),
    visionTool(),
    headlineGeneratorPlugin(),
  ],

  schema: {
    types: schemaTypes,
  },
});
