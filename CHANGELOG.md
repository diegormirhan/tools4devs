# Changelog

All notable changes to tools4devs. Versions follow [semantic versioning](https://semver.org/).

## Unreleased

### Changed

- Redesign the interface on Tailwind CSS 4 and shadcn/ui, with embedded Inter and JetBrains Mono, in light and dark.
- Replace the category tabs with a sidebar tree of every tool and each of its actions. Pin the tools you use. The sidebar folds to icons in a narrow window and remembers your choice.
- Search everything with Ctrl+K: actions first, then tools, in English or Portuguese, ignoring accents and word order.
- Open tools as pages in the main window instead of a dialog. The sidebar and the path above the page follow the action you choose, and leaving unsaved work asks first.
- Show every tool as a card with its group's colour, its engine and its actions. Hovering or focusing a card plays a six-second clip of the tool at work, or shows a still with reduced motion.
- Drop or choose a file on the home page to see the tools that can open it.
- Rebuild the queue, history, settings, install dialog, update notice, quick tools and chat and post mockups to match. A quick tool page is named after the tool and shows input and result side by side.
- Clearing the history asks for confirmation.
- Write the name as Tools4Devs wherever it is shown: window title, logo, About page and messages. The executable, installer keys, saved settings and update channel keep the lowercase identifier, so installed copies keep updating.
- Drop the Windows title bar: minimise, maximise and close sit in the page header, drawn with the system's own icons. The header moves the window, a double click maximises it, and a pause over maximise opens the Windows 11 snap layouts.
- Add a Back button (Alt+Left) and make the path above each page clickable, starting from Home.
- Add an About page, from Settings, listing every bundled or downloadable tool with its version, licence, hash and project.
- Open and close the sidebar smoothly; labels fade instead of shrinking. Groups and tools in the tree slide open and shut.

### Fixed

- The CSS generators' box sample now has a size of its own; box shadow and border radius previews used to draw nothing.
- An FFmpeg found on PATH without the encoders the app uses (Gyan's build has libx264, not libopenh264) counts as missing, so the app offers its own instead of failing to convert or compress video.
- Buttons and the sidebar tree show the hand cursor again, tool names in the tree no longer run under the pin star, and the settings drop-downs open below their field instead of over it.



### Changed

- Use tools4devs for the Windows application identity, publisher, installer registry keys, installation directory, component store and saved preference keys.
- Migrate existing profiles, settings, history and downloaded tools automatically. Keep the previous profile as a recovery copy and preserve downloaded components in the new tools4devs directory; never overwrite an existing tools4devs profile. The previous component directory may be removed with the old installation.
- Retarget existing shortcuts to the new installation and remove the previous app registration after the replacement installer has completed.
- Keep the legacy update channel pinned to the signed 3.4.0 bridge. The tools4devs channel advertises 4.0.0 and future releases.

### Fixed

- Stop migration before opening the new profile if data cannot be copied safely. Existing data remains intact, and migration can be retried.
- Preserve the original updater signing key and MSI upgrade family across the identity change.

## 3.4.0 (2026-09-27)

This is the required automatic-update bridge. Older clients install 3.4.0 first; after restarting, 3.4.0 follows the tools4devs update channel to 4.0.0 and later releases. Keep the signed v3.4.0 assets available while supporting those clients.

### Changed

- Rename ToolHaven to tools4devs across the app, installer, documentation and website, while retaining the original app icon.
- Add a scalable wordmark for light and dark themes and refresh the Windows and website branding.
- Regenerate all six screenshots at 3840 × 2580 pixels. The website serves lossless WebP with responsive sizes and the full-resolution source.

### Fixed

- Preserve the original updater signing key, manifest format and Windows installer identities across the rename, so existing ToolHaven installations can upgrade in place.
- Move 3.4.0 to the tools4devs.json update channel. Keep the legacy latest.json channel pinned to this bridge when newer releases are published.
- Keep existing language, theme, job history, settings and downloaded components when upgrading.
- Include third-party licence, source, version and hash notices in the installed and portable tools folders.

## 3.3.0 (2026-09-23)

### Changed

- The WhatsApp chat mockup now looks like the real app. The header has a back arrow, the contact's status ("typing...", "Online" or anything you type) and the video, call and menu icons. Incoming messages show the contact's avatar beside the bubble, a "Today" label sits above the conversation, and the bottom has the message bar with emoji, attach, camera and mic.
- The tweet mockup now has the same action bar as X: replies, reposts, likes in pink, bookmarks, views and share. The bookmark count can be edited like the others.
- The Chat mockup and Post mockup cards in the catalog have their own artwork instead of a blank placeholder.

### Added

- Voice messages in the chat mockup. The mic button beside a message turns it into an audio bubble with a play button, a waveform and the duration you set.

## 3.2.2 (2026-09-23)

### Fixed

- FFmpeg and ffprobe failed to install on a new machine, because the pinned build had been deleted upstream. They now use a build that stays available.
- ExifTool failed to install on a new machine with "The download does not contain exiftool(-k).exe".

## 3.2.1 (2026-09-22)

### Added

- **About ninety built-in quick tools** that run inside the app with nothing to install, in twelve groups:
  - Work on text: change case, reverse, upside down, remove duplicates, sort, shuffle, find and replace, tidy spacing, prefix and suffix, number lines, counts, slugs, lorem ipsum, bionic reading and letter styles.
  - Codes and hashes: Base64, URL encoding, HTML entities, binary, Morse, hashes, JWT decoder, UUIDs, passwords, Roman numerals, number bases, numbers written out and timestamps.
  - Test data: CPF, CNPJ, CEP, sandbox card numbers and UUIDs, for test environments only.
  - CSS generators: border radius, box shadow, gradient, glassmorphism, clip path, background patterns, triangle, loader, cubic bezier, text glitch, switch and checkbox, with a live preview.
  - Minify and format for CSS and HTML, with file upload.
  - QR codes, Wi-Fi QR codes and barcodes, saved as images.
  - Dates and time, math and finance, colour tools, everyday calculators, network lookups and random picks (dice, roulette, Mega-Sena, raffle, random numbers and words).
- **Chat mockup**: build a WhatsApp, iMessage or Instagram DM conversation and save it as an image.
- **Post mockup**: build a tweet or an Instagram post and save it as an image. The tweet has an optional verified badge, views and time.
- Two new catalog rows, **Calculators** and **Mockups**.
- Hovering a card lists the tools inside it.
- A colour picker on every colour field.
- CSS previews can be shown on a box, text, a button or a card.
- A **Regenerate** button for random tools, and a **Generate** button for CPF and CNPJ.

### Changed

- Inside a group, the tool list is now a row of buttons at the top of the panel instead of a dropdown.
- The **Everything** filter shows the total number of tools.
- Dates and time opens in a wider panel.
- The WhatsApp mockup uses the dark theme, and the tweet mockup matches the real X layout.
- The Deno card was removed. Deno is still installed automatically as a yt-dlp dependency.

### Fixed

- Opening the app a second time opened a second window. It now brings the existing window to the front.
- Tools showed an error before anything had been typed.
- The tweet preview was cut off at the left edge of the panel.

## 3.1.0 (2026-09-16)

### Added

- **Show in folder** on every finished job, next to **Copy path**.

### Fixed

- Tesseract failed to install because its installer asked for elevation.
- Dropdowns were narrower than their options.
- A downloading tool showed its name and status on the same line.
- Job rows were partly in English when the app was set to Portuguese.

## 3.0.0 (2026-09-16)

### Added

- Brazilian Portuguese, chosen in Settings. Every tool, option, hint, error and queue entry is translated.
- The version and a **Check now** button at the top of Settings.
- New versions are announced in a banner at the top of the page.

### Changed

- Number fields have full-height minus and plus buttons.
- Shorter descriptions in Settings.

### Fixed

- Updating closed the app before the download finished.

## 2.1.1

### Fixed

- Updating closed the app before the download finished. First version the app can install by itself.

## 2.1.0

### Added

- Automatic updates, verified by signature.
- 7-Zip, MKVToolNix, ImageMagick and ExifTool download inside the app.
- Stop a running job from the queue or its panel.
- The queue and history survive a restart.
- Music recognition from speakers or a microphone.
- Reverse image search with Google Lens, Yandex, Bing or TinEye.
- Photo upscaling with a model (Nomos8kSC).
- OCR with Tesseract, to text or a searchable PDF.
- Settings for parallel jobs and for existing files.
- Download sizes shown before installing.

## 2.0.0

### Added

- Music recognition, reverse image search, photo upscaling with Real-ESRGAN, 7-Zip archive support and download sizes.

## 1.0.0

- First release: 22 open-source tools in one interface, a background queue, light and dark themes, and drag and drop.
