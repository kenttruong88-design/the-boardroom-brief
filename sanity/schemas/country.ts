import { defineField, defineType } from "sanity";

export const country = defineType({
  name: "country",
  title: "Country / Economy",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Country Name",
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
      name: "flag",
      title: "Flag Emoji",
      type: "string",
    }),
    defineField({
      name: "region",
      title: "Region",
      type: "string",
      options: {
        list: [
          { title: "Americas", value: "Americas" },
          { title: "Europe", value: "Europe" },
          { title: "Asia-Pacific", value: "Asia-Pacific" },
          { title: "Middle East & Africa", value: "Middle East & Africa" },
        ],
      },
    }),
    defineField({
      name: "economyRank",
      title: "Economy Rank (1–30)",
      type: "number",
    }),
    defineField({
      name: "currencyCode",
      title: "Currency Code",
      type: "string",
      description: "ISO 4217 code, e.g. USD, GBP, EUR",
    }),
    defineField({
      name: "code",
      title: "Country Code",
      type: "string",
      description: "ISO 3166-1 alpha-2 code, e.g. US, GB, DE",
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "region" },
  },
  orderings: [
    { title: "Economy Rank", name: "rankAsc", by: [{ field: "economyRank", direction: "asc" }] },
  ],
});
