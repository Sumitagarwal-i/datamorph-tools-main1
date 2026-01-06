const SUPPORT_EMAIL = "hello@datumintapp.com";

const enc = (s: string) => encodeURIComponent(s);

export function buildSupportMailto(params: { topic?: string } = {}) {
  const subject = "DatumInt – Feedback / Issue";

  const body = [
    "Hi DatumInt team,",
    "",
    "I'm using DatumInt and wanted to share:",
    "[Your message here]",
    "",
    "Thanks!",
    "[Your name]",
  ].join("\n");

  return `mailto:${SUPPORT_EMAIL}?subject=${enc(subject)}&body=${enc(body)}`;
}
