# Logo contrast

Relative luminance and contrast ratios use the WCAG sRGB formula. Logo text is exempt from WCAG text contrast requirements; 4.5:1 is used here as a voluntary benchmark. Overlapping colors are checked separately.

| Theme | Pair | Colors | Ratio | Meets 4.5:1 |
|---|---|---|---|---|
| light | Words / background | #2a55c4 / #f2f5fa | 6.01:1 | Yes |
| light | Four / background | #141821 / #f2f5fa | 16.25:1 | Yes |
| light | Four / words | #141821 / #2a55c4 | 2.70:1 | No |
| dark | Words / background | #88afff / #15171c | 8.22:1 | Yes |
| dark | Four / background | #f3f5fa / #15171c | 16.44:1 | Yes |
| dark | Four / words | #f3f5fa / #88afff | 2.00:1 | No |

SVG source files remain editable. Wordmarks use Segoe UI with Arial fallback; typography is not yet converted to outlines. PNG is a rendered preview only.

The raw four/words pairs fall below the voluntary benchmark. The final SVG adds a 3.2-unit separator in the intended background color around the foreground four. This separates the two fills, using the measured background contrast for both edges. Each version must be used on its specified background for this treatment to hold. Anti-aliased edge pixels and legibility at very small sizes are not guaranteed by a color-ratio calculation.
