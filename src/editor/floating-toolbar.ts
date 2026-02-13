import { Facet } from "@codemirror/state";

/**
 * Facet to provide the author name.
 * Configured by the plugin with authorNameFacet.of(settings.authorName).
 */
export const authorNameFacet = Facet.define<string, string>({
  combine(values) {
    return values[values.length - 1] ?? "";
  },
});
