# Hebrew / English

The app ships in Hebrew and can be switched to English from two places:

* the **login card** — so someone who cannot read Hebrew can switch before
  signing in, which is the case for a store reviewer;
* **Settings → 🌐 Language**.

Switching writes `cubefinance_web:lang` and reloads the page. The reload is not
laziness: the swap is applied to the rendered DOM in place, so there is no map
back from an English string to the Hebrew one it replaced.

## How it works

Every screen is built by DOM calls that write Hebrew directly — around 1,300
string literals spread across nearly every function in `cubefinance-web.html`.
Rewriting each call site into `t("key")` would have touched the whole file and
risked breaking working screens for what is a presentational feature. So the
translation is applied one layer later instead:

1. `applyLangDir()` sets `<html lang dir>` and adds `.lang-en`.
2. `translateTree(root)` walks the built DOM and swaps Hebrew text nodes, plus
   `placeholder`, `aria-label`, `title` and `alt`, using `DICT`.
3. A `MutationObserver` runs the same pass over anything injected later —
   toasts, sheets, chat bubbles — so those call sites need no changes. The pass
   only rewrites nodes containing Hebrew, so its own output cannot retrigger it
   and the loop settles after one round.

## The two rules that keep it honest

`DICT` is consulted twice: an exact match on the trimmed string, and failing
that a fragment pass for sentences assembled around a live number. The fragment
pass is where translation of this shape usually goes wrong, so it has two
guards, both added in response to real breakage:

**A fragment must not sit inside a longer Hebrew word.** Hebrew glues prefixes
onto words, so a plain `indexOf` turned `המספרים` ("the numbers") into
`המBooks` by matching `ספרים` ("books"). Both neighbouring characters must now
be non-letters.

**All or nothing.** If Hebrew survives the fragment pass, the original is
returned untouched. A half-translated sentence — `₪12,000 נכנסים a month` —
reads worse than one left in Hebrew, so a sentence is either fully translated
or fully Hebrew.

A consequence worth stating plainly: **a string with no `DICT` entry stays
Hebrew.** That is the intended failure mode.

## Direction

`dir` on `<html>` is not enough on its own. `body { direction: rtl }` was
hard-coded in CSS as a fallback for hosts that strip the attribute, and a CSS
declaration beats the attribute — the interface stayed mirrored while the words
read left-to-right. `html.lang-en body { direction: ltr }` overrides it.

`text-align: right` had the same problem in ten rules and is now
`text-align: start`, which means the same thing in Hebrew and follows the flip.
The checkmark's `border-left` is deliberately still physical: a tick is a glyph
shape, not a direction, and must not mirror.

## The advisor

The chat's intent matcher was written against Hebrew keywords with a handful of
English words bolted on, so an English speaker fell through to the generic
fallback for nearly every question. Each intent now carries English synonyms
(`should i buy`, `emergency`, `how much can i save`, …). Its replies are
assembled from stems around live numbers and are translated by the fragment
pass, so **adding a new reply template means adding its stems to `DICT`** — or
that reply will show in Hebrew.

## Coverage

The dictionary was built by driving the running app and collecting every
visible Hebrew string across the auth screen, dashboard, all nine module pages,
settings and its sub-pages, the chat and the calm flow — 386 strings — plus the
runtime stems for toasts and advisor replies. It is ~520 entries.

Strings only reachable from a state the walk never entered are the gap this
leaves: the owned-book labels ("read now", the library note) were missing for
exactly that reason and had to be added by hand after testing the review
account. It is not a guarantee of total coverage. Screens reachable only from states the
walk did not enter (some error paths, the kids-mode onboarding branch, the
print worksheet) may still show Hebrew strings. To extend it, add entries to
`DICT`; nothing else has to change.
