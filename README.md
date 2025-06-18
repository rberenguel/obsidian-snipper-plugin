# Snipper

A simple plugin for Obsidian to embed a daily, editable snippet into your notes. It helps you maintain atomic notes by storing the snippet content in a separate file, while still allowing for seamless, in-place editing.


---

## Features

- **Atomic Snippets:** Stores your snippet in a separate file (e.g., `Snippets/s-20250618.md`) while letting you edit it from your main note.
- **In-Place Editing:** Provides a simple text area to write and edit your snippet directly within the rendered block.
- **Live Character Counter:** Keeps track of your snippet's length against a configurable limit.
- **Customizable Styling:** Comes with several built-in visual styles (e.g., Floating Card, Gradient Glow) that can be applied on a per-snippet basis.
- **Configurable Defaults:** Set a default style, snippet folder, and character limit via the settings panel.

## How to Use

1.  Go to the plugin settings (`Settings` -> `Community Plugins` -> `Snipper`) and configure the **Snippet folder path**.
2.  In any note, create a code block with the language `snipper`:
    ````
    ```snipper
    ```
    ````
3.  This will render the widget. The corresponding snippet file will be created automatically in the folder you configured.

### Applying Styles

To apply one of the built-in styles, add the style's class name inside the code block. If you don't specify a style, the default from the settings will be used.

## Configuration

The following options are available in the plugin settings:

- **Snippet folder path:** The folder where your `s-` snippet files will be stored.
- **Character limit:** The maximum character count for the snippet.
- **Default style:** Choose a default look for your snippets from a dropdown of available styles.

## Installation

### Manual Installation

1.  Download the latest release files (`main.js`, `styles.css`, `manifest.json`) from the **Releases** page of the GitHub repository (or the zip file, contains all of these).
2.  Find your Obsidian vault's plugins folder by going to `Settings` > `About` and clicking `Open` next to `Override config folder`. Inside that folder, navigate into the `plugins` directory.
3.  Create a new folder named `snipper`.
4.  Copy the `main.js`, `manifest.json`, and `styles.css` files into the new `snipper` folder.
5.  In Obsidian, go to **Settings** > **Community Plugins**.
6.  Make sure "Restricted mode" is turned off. Click the "Reload plugins" button.
7.  Find "Snipper" in the list and **enable** it.
