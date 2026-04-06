import { defineField, defineType } from "sanity";

export const pillar = defineType({
  name: "pillar",
  title: "Pillar",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name" },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 2,
    }),
    defineField({
      name: "color",
      title: "CSS Color Class",
      type: "string",
      description: "Tailwind class suffix for pillar badge colour, e.g. pillar-markets",
    }),
    defineField({
      name: "icon",
      title: "Icon Name",
      type: "string",
      description: "Lucide icon name, e.g. TrendingUp",
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "description" },
  },
});
