import { defineField, defineType } from "sanity";

export const article = defineType({
  name: "article",
  title: "Article",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "satiricalHeadline",
      title: "Satirical Subheadline",
      type: "string",
      description: "The dry-wit one-liner that appears in red italic under the title.",
    }),
    defineField({
      name: "excerpt",
      title: "Excerpt",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      of: [
        { type: "block" },
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({ name: "alt", title: "Alt text", type: "string" }),
            defineField({ name: "caption", title: "Caption", type: "string" }),
          ],
        },
      ],
    }),
    defineField({
      name: "coverImage",
      title: "Cover Image",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({ name: "alt", title: "Alt text", type: "string" }),
      ],
    }),
    defineField({
      name: "pillar",
      title: "Pillar / Section",
      type: "reference",
      to: [{ type: "pillar" }],
      validation: (r) => r.required(),
    }),
    defineField({
      name: "author",
      title: "Author",
      type: "reference",
      to: [{ type: "author" }],
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [{ type: "reference", to: [{ type: "tag" }] }],
    }),
    defineField({
      name: "countries",
      title: "Countries / Economies",
      type: "array",
      of: [{ type: "reference", to: [{ type: "country" }] }],
    }),
    defineField({
      name: "publishedAt",
      title: "Published At",
      type: "datetime",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "readTime",
      title: "Read Time (minutes)",
      type: "number",
    }),
    defineField({
      name: "featured",
      title: "Featured",
      type: "boolean",
      description: "Pin this article as featured on the homepage or section page.",
      initialValue: false,
    }),
    defineField({
      name: "seoTitle",
      title: "SEO Title",
      type: "string",
      group: "seo",
    }),
    defineField({
      name: "seoDescription",
      title: "SEO Description",
      type: "text",
      rows: 2,
      group: "seo",
    }),
    defineField({
      name: "ogImage",
      title: "OG Image URL",
      type: "url",
      description: "Cloudinary OG image URL (auto-generated).",
      group: "seo",
    }),
    defineField({
      name: "imagePrompt",
      title: "Image Generation Prompt",
      type: "text",
      rows: 3,
      description: "The prompt used to generate the cover image. For audit purposes.",
      group: "ai",
    }),
    defineField({
      name: "imageGeneratedWith",
      title: "Image Model",
      type: "string",
      description: "Which model generated the cover image (e.g. flux-schnell, unsplash).",
      group: "ai",
    }),
  ],
  groups: [
    { name: "seo", title: "SEO" },
    { name: "ai",  title: "AI Metadata" },
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "satiricalHeadline",
      media: "coverImage",
    },
  },
  orderings: [
    {
      title: "Published Date (newest)",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
});
