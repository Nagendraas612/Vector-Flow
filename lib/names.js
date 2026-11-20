// Display names: Google profile names arrive in whatever case the
// account holds ("P G AYUSH RAI AIML"), and printing them raw looks
// like a debug label. These helpers re-case a name for display and
// derive avatar initials. They never change the stored name.

// Words that stay uppercase when a name is re-cased: the branch
// codes and college abbreviations students carry in their profile
// names. Without this list "AIML" would come out as "Aiml".
const KEEP_UPPERCASE = new Set([
  "AIML",
  "AI",
  "ML",
  "CSE",
  "CS",
  "EC",
  "EE",
  "ME",
  "CV",
  "IS",
  "VVCE",
]);

function titleWord(word) {
  // Dotted initials ("A.S.") and short initials ("P", "G") stay
  // uppercase; hyphenated parts are each capitalised.
  if (word.includes(".")) return word.toUpperCase();
  if (word.length <= 2) return word.toUpperCase();
  if (KEEP_UPPERCASE.has(word.toUpperCase())) return word.toUpperCase();
  return word
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("-");
}

// "P G AYUSH RAI AIML" -> "P G Ayush Rai AIML".
export function formatDisplayName(name) {
  if (!name) return "";
  return String(name).split(/\s+/).filter(Boolean).map(titleWord).join(" ");
}

// Initials for the avatar circle: first letters of the first and
// last real name words, skipping single-letter initials and acronyms.
// "P G AYUSH RAI AIML" -> "AR"; "Vector Flow Club" -> "VC".
export function initialsFor(name) {
  if (!name) return "?";
  const words = String(name)
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => word.length > 1 && !KEEP_UPPERCASE.has(word.toUpperCase()));
  if (words.length === 0) return String(name).replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
