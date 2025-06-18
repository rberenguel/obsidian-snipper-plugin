import {
	App,
	Editor,
	Plugin,
	PluginSettingTab,
	Setting,
	MarkdownPostProcessorContext,
	TFile,
	TAbstractFile,
} from "obsidian";
import * as path from "path";

const AVAILABLE_STYLES: Record<string, string> = {
	"": "None (Default)",
	"floating-card": "Floating Card (floating-card)",
	"gradient-glow": "Gradient Glow (gradient-glow)",
	"quote-icon": "Quote with Icon (quote-icon)",
	glass: "Glassmorphism (glass)",
};

interface SnippetPluginSettings {
	snippetFolderPath: string;
	characterLimit: number;
	defaultStyle: string;
}

const DEFAULT_SETTINGS: SnippetPluginSettings = {
	snippetFolderPath: "snippets",
	characterLimit: 140,
	defaultStyle: "",
};

export default class SnippetPlugin extends Plugin {
	settings: SnippetPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerMarkdownCodeBlockProcessor(
			"snippet",
			async (source, el, ctx) => {
				await this.createSnippetView(source, el, ctx);
			},
		);

		this.registerEvent(
			this.app.vault.on("rename", this.handleFileRename.bind(this)),
		);

		// TODO: Would deletion need to be handled?

		this.addCommand({
			id: "insert-snipper-block",
			name: "Insert Snipper block",
			editorCallback: (editor: Editor) => {
				const cursor = editor.getCursor();
				const block = "```snippet\n\n```";
				editor.replaceRange(block, cursor);
				// Move cursor to the line inside the block
				editor.setCursor({ line: cursor.line + 1, ch: 0 });
			},
		});

		this.addSettingTab(new SnippetSettingTab(this.app, this));
	}

	private async handleFileRename(
		file: TAbstractFile,
		oldPath: string,
	): Promise<void> {
		// 1. Ensure it's a Markdown file and not a folder
		if (!(file instanceof TFile) || file.extension !== "md") {
			return;
		}

		const oldBaseName = path.parse(oldPath).name;

		// 2. Ensure we are not renaming a snippet file itself to avoid loops
		if (oldBaseName.startsWith("s-")) {
			return;
		}

		const newBaseName = file.basename;

		const oldSnippetPath = `${this.settings.snippetFolderPath}/s-${oldBaseName}.md`;
		const newSnippetPath = `${this.settings.snippetFolderPath}/s-${newBaseName}.md`;

		// 3. Check if the corresponding snippet file exists before trying to rename it
		const snippetFileToRename =
			this.app.vault.getAbstractFileByPath(oldSnippetPath);
		if (!snippetFileToRename) {
			return;
		}

		// 4. Perform the rename
		try {
			await this.app.vault.rename(snippetFileToRename, newSnippetPath);
		} catch (err) {
			console.error(
				`Snipper: Failed to rename snippet file for ${newBaseName}.`,
				err,
			);
		}
	}

	async createSnippetView(
		source: string,
		targetEl: HTMLElement,
		ctx: MarkdownPostProcessorContext,
	) {
		let styleToApply =
			source.trim().split("\n")[0] || this.settings.defaultStyle;
		const currentFilePath = ctx.sourcePath;
		const currentFileName =
			currentFilePath.split("/").pop()?.split(".").shift() || "";
		const snippetFileName = `s-${currentFileName}.md`;
		const snippetFilePath = `${this.settings.snippetFolderPath}/${snippetFileName}`;

		const snippetFile =
			this.app.vault.getAbstractFileByPath(snippetFilePath);
		if (!snippetFile) {
			try {
				await this.app.vault.createFolder(
					this.settings.snippetFolderPath,
				);
			} catch (e) {
				/* Folder likely exists, ignore error */
			}
			await this.app.vault.create(snippetFilePath, "");
		}

		targetEl.empty();
		targetEl.addClass("snippet-widget");
		if (styleToApply) {
			targetEl.addClass(styleToApply);
		}

		const textarea = document.createElement("textarea");
		const charCount = document.createElement("span");
		let debounceTimer: NodeJS.Timeout;
		const charLimit = this.settings.characterLimit;

		const updateCharCount = (text: string) => {
			const remaining = charLimit - text.length;
			charCount.textContent = `${remaining}`;
			charCount.style.color =
				remaining < 0 ? "var(--text-error)" : "var(--text-muted)";
		};

		const initialContent =
			await this.app.vault.adapter.read(snippetFilePath);
		textarea.value = initialContent;
		updateCharCount(initialContent);

		textarea.placeholder = `Your ${charLimit}-character snippet...`;
		textarea.oninput = () => {
			const text = textarea.value;
			updateCharCount(text);
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				this.app.vault.adapter.write(snippetFilePath, text);
			}, 500);
		};

		targetEl.appendChild(textarea);
		targetEl.appendChild(charCount);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SnippetSettingTab extends PluginSettingTab {
	plugin: SnippetPlugin;

	constructor(app: App, plugin: SnippetPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Snipper Settings" });

		new Setting(containerEl)
			.setName("Snippet folder path")
			.setDesc(
				"The folder where your s-YYYYMMDD.md snippet files will be stored.",
			)
			.addText((text) =>
				text
					.setPlaceholder("Example: Journal/Snippets")
					.setValue(this.plugin.settings.snippetFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.snippetFolderPath = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Character limit")
			.setDesc("The maximum number of characters for the snippet.")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.characterLimit.toString())
					.onChange(async (value) => {
						this.plugin.settings.characterLimit =
							parseInt(value) || 140;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Default style")
			.setDesc(
				"Default style to apply if none is specified in the code block.",
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(AVAILABLE_STYLES)
					.setValue(this.plugin.settings.defaultStyle)
					.onChange(async (value) => {
						this.plugin.settings.defaultStyle = value;
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("p", {
			text: "To add your own styles:",
			cls: "setting-help-text",
		});
		const ul = containerEl.createEl("ul", { cls: "setting-help-text" });
		ul.createEl("li", {
			text: "Add a new CSS class (e.g., .snippet-widget.my-cool-style) to your styles.css file.",
		});
		ul.createEl("li", {
			text: "Add the new style to the AVAILABLE_STYLES list at the top of the main.ts file.",
		});
		ul.createEl("li", { text: "Rebuild the plugin." });
	}
}
