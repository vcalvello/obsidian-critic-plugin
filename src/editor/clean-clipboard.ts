import { EditorView } from "@codemirror/view";

/**
 * Strip CriticMarkup syntax from plain text (pure function).
 * Handles metadata prefixes (JSON@@) inside each markup block.
 */
export function stripCriticMarkupText(text: string): string {
  // Order matters: substitutions first (contain ~> which could confuse other patterns)
  // Substitution: {~~old~>new~~} → keep new (accept semantics for clipboard)
  text = text.replace(/\{~~(?:[\s\S]*?@@)?([\s\S]*?)~>([\s\S]*?)~~\}/g, "$2");
  // Addition: {++text++} → keep text
  text = text.replace(/\{\+\+(?:[\s\S]*?@@)?([\s\S]*?)\+\+\}/g, "$1");
  // Deletion: {--text--} → remove
  text = text.replace(/\{--(?:[\s\S]*?@@)?[\s\S]*?--\}/g, "");
  // Comment: {>>text<<} → remove
  text = text.replace(/\{>>[\s\S]*?<<\}/g, "");
  // Highlight: {==text==} → keep text
  text = text.replace(/\{==(?:[\s\S]*?@@)?([\s\S]*?)==\}/g, "$1");
  return text;
}

/** Quick check: does text contain any CriticMarkup delimiters? */
const CRITIC_DELIM = /\{(?:\+\+|--|~~|>>|==)/;

/**
 * CM6 domEventHandlers extension that cleans CriticMarkup from copy/cut.
 */
export function cleanClipboardHandler() {
  return EditorView.domEventHandlers({
    copy(event, view) {
      const sel = view.state.selection.main;
      if (sel.empty) return false;

      const text = view.state.sliceDoc(sel.from, sel.to);
      if (!CRITIC_DELIM.test(text)) return false;

      const clean = stripCriticMarkupText(text);
      event.preventDefault();
      event.clipboardData?.setData("text/plain", clean);
      return true;
    },
    cut(event, view) {
      const sel = view.state.selection.main;
      if (sel.empty) return false;

      const text = view.state.sliceDoc(sel.from, sel.to);
      if (!CRITIC_DELIM.test(text)) return false;

      const clean = stripCriticMarkupText(text);
      event.preventDefault();
      event.clipboardData?.setData("text/plain", clean);

      // Dispatch deletion (goes through suggesting filter if active)
      view.dispatch({
        changes: { from: sel.from, to: sel.to },
        selection: { anchor: sel.from },
      });
      return true;
    },
  });
}
