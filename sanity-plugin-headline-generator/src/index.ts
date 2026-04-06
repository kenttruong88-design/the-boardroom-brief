import { definePlugin } from "sanity";
import { HeadlineGeneratorAction } from "./HeadlineGeneratorAction";
import { SeoGeneratorAction } from "./SeoGeneratorAction";

export const headlineGeneratorPlugin = definePlugin({
  name: "headline-generator",
  document: {
    actions: (prev, context) => {
      if (context.schemaType !== "article") return prev;
      return [...prev, HeadlineGeneratorAction, SeoGeneratorAction];
    },
  },
});
