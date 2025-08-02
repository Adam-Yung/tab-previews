## [1.0.1] - 2025-08-02

### Fixed

* Fixed opening non-maximized preview window causes parent webpage to reset rendering and scroll to top issue

---

## [1.0.0] - 2025-08-02

### Changed

* Reverted the build process to use a simpler and more flexible `build.sh` script, removing the `npm` wrapper for better compatibility, including for BSD `sed`.

---

## [0.9.0] - 2025-08-01

### Added

* Added Git LFS for handling large `.gif` files to keep the repository lightweight.
* Re-added extension icons that were previously missing.

### Changed

* Updated the demo GIFs for the settings panel and Firefox functionality.

---

## [0.8.0] - 2025-08-01

### Added

* **New Feature**: You can now enable or disable the link previewer on a per-site basis directly from the extension's options panel.

---

## [0.7.0] - 2025-08-01

### Added

* Added demonstrative GIFs to the `README.md` to showcase the extension's features and settings.

### Changed

* Updated the `README.md` with more detailed information and usage instructions.
* Renamed icon files for better organization and consistency.

---

## [0.6.0] - 2025-08-01

### Fixed

* Improved Firefox compatibility by adding `sandbox` rules, allowing the preview `iframe` to load a wider range of content securely.

---

## [0.5.0] - 2025-07-31

### Changed

* Updated the `LICENSE.md` and `README.md` files with the latest project information.
* Transitioned the build process to use `package.json` scripts for a more standardized approach.

---

## [0.4.0] - 2025-07-31

### Changed

* Tuned performance by optimizing CSS rules and leveraging the `content-visibility` property to prevent off-screen elements on the parent page from rendering.

### Fixed

* Resolved several bugs in the options panel, improving the reliability of saving settings.
* Walked back overly restrictive sandboxing rules to improve compatibility.

---

## [0.3.0] - 2025-07-30

### Fixed

* Fixed a critical bug where mouse dragging and resizing events were being captured by the `iframe`, preventing smooth movement of the preview window.
* Corrected an issue with the dark mode toggle on the options page.

### Changed

* Made the loading animation more impactful and visually appealing.
* The header filtering mechanism is now stateful, remaining active as long as a preview is open for more reliable content loading.

---

## [0.2.0] - 2025-07-29

### Added

* **New Feature**: The preview window is now **draggable** and **resizable**, giving you full control over its placement and size.

### Changed

* Major performance boost by replacing an `overflow: hidden` rule with `clip-path`, resulting in smoother animations and a more responsive feel.

---

## [0.1.0] - 2025-07-25

### Added

* Initial release of the Link Previewer extension.
* Core functionality: long-press a link or use a modifier key + click to open a preview in a floating pop-up window.
* Basic UI with light and dark themes, configurable through an options page.