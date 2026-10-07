import { loadFont } from "@remotion/fonts";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

/**
 * Heebo — פונט עברי מודרני עם משקלים כבדים (עד 900),
 * מתאים לכותרות ראווה בסגנון ריאלס.
 *
 * הקבצים יושבים ב-public/fonts כדי שהרינדור לא יהיה תלוי ברשת
 * ויֵצא זהה בכל סביבה.
 */
export const fontFamily = "Heebo";

const handle = delayRender("Loading Heebo font");

Promise.all(
  (["400", "700", "900"] as const).map((weight) =>
    loadFont({
      family: fontFamily,
      url: staticFile(`fonts/Heebo-${weight}.ttf`),
      format: "truetype",
      weight,
      display: "block",
    }),
  ),
)
  .then(() => continueRender(handle))
  .catch((err) => cancelRender(err));
