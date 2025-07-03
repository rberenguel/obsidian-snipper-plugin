import {
	App,
	Editor,
	Plugin,
	PluginSettingTab,
	Setting,
	MarkdownPostProcessorContext,
	MarkdownRenderer,
	TFile,
	TAbstractFile,
} from "obsidian";
import * as path from "path";

const AVAILABLE_STYLES: Record<string, string> = {
	"": "None (Default)",
	card: "Floating Card (card)",
	glow: "Gradient Glow (glow)",
	quote: "Quote with Icon (quote)",
	glass: "Glassmorphism (glass)",
	terminal: "Terminal (terminal)",
	notebook: "Notebook Paper (notebook)",
	neumorphic: "Neumorphic (neumorphic)",
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

		this.addCommand({
			id: "insert-snipper-block",
			name: "Insert Snipper block",
			editorCallback: (editor: Editor) => {
				const cursor = editor.getCursor();
				const block = "```snipper\n\n```";
				editor.replaceRange(block, cursor);
				editor.setCursor({ line: cursor.line + 1, ch: 0 });
			},
		});
		this.addCommand({
			id: "insert-snippet-filtered-view",
			name: "Insert Snippet Filter View",
			editorCallback: async (editor: Editor) => {
				// Construct the path to the template file within your plugin's folder
				const templatePath = `${this.app.vault.configDir}/plugins/${this.manifest.id}/view-template.md`;
				try {
					const template =
						await this.app.vault.adapter.read(templatePath);
					editor.replaceSelection(template);
				} catch (e) {
					console.error(
						"Snipper: Could not read view-template.md",
						e,
					);
					// Let the user know the template is missing
					editor.replaceSelection(
						"Error: Snipper template file not found.",
					);
				}
			},
		});

		this.addSettingTab(new SnippetSettingTab(this.app, this));
	}

	async createSnippetView(
		source: string,
		targetEl: HTMLElement,
		ctx: MarkdownPostProcessorContext,
	) {
		// FIX 1: Always start with a clean container to prevent duplication on re-render.
		targetEl.empty();

		const styleToApply =
			source.trim().split("\n")[0] || this.settings.defaultStyle;
		const snippetFilePath = this.getSnippetPath(ctx);

		await this.ensureSnippetFileExists(snippetFilePath);

		const renderViewMode = async () => {
			targetEl.empty();
			targetEl.addClass("snippet-view-mode");
			const content = await this.app.vault.adapter.read(snippetFilePath);

			if (content) {
				await MarkdownRenderer.render(
					this.app,
					content,
					targetEl,
					snippetFilePath,
					this,
				);
			} else {
				targetEl.setText("Empty snippet. Click to edit.");
			}

			targetEl.onClickEvent(() => {
				renderEditMode(content);
			});
		};

		const renderEditMode = (currentContent: string) => {
			targetEl.empty();
			targetEl.removeClass("snippet-view-mode");

			const textarea = document.createElement("textarea");
			const charCount = document.createElement("span");
			let debounceTimer: NodeJS.Timeout;
			const charLimit = this.settings.characterLimit;

			const saveAndSwitchView = async () => {
				clearTimeout(debounceTimer);
				await this.app.vault.adapter.write(
					snippetFilePath,
					textarea.value,
				);
				renderViewMode();
			};

			const updateCharCount = (text: string) => {
				const remaining = charLimit - text.length;
				charCount.textContent = `${remaining}`;
				charCount.style.color =
					remaining < 0 ? "var(--text-error)" : "var(--text-muted)";
			};

			textarea.value = currentContent;
			updateCharCount(currentContent);

			textarea.oninput = () => {
				updateCharCount(textarea.value);
				clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					this.app.vault.adapter.write(
						snippetFilePath,
						textarea.value,
					);
				}, 500);
			};

			textarea.onblur = saveAndSwitchView;

			// FIX 2: Stop click events inside the textarea from bubbling up to the parent.
			textarea.onclick = (e) => e.stopPropagation();

			targetEl.appendChild(textarea);
			targetEl.appendChild(charCount);

			setTimeout(() => textarea.focus(), 0);
		};

		targetEl.addClass("snippet-widget");
		if (styleToApply) {
			targetEl.addClass(styleToApply);
		}
		await renderViewMode();
	}

	// ... (Helper functions and settings tab are unchanged) ...
	private getSnippetPath(ctx: MarkdownPostProcessorContext): string {
		const currentFileName =
			ctx.sourcePath.split("/").pop()?.split(".").shift() || "";
		return `${this.settings.snippetFolderPath}/s-${currentFileName}.md`;
	}

	private async ensureSnippetFileExists(path: string): Promise<void> {
		if (!(await this.app.vault.adapter.exists(path))) {
			try {
				await this.app.vault.createFolder(
					this.settings.snippetFolderPath,
				);
			} catch (e) {
				/* Folder likely exists, ignore error */
			}
			await this.app.vault.create(path, "");
		}
	}

	private async handleFileRename(
		file: TAbstractFile,
		oldPath: string,
	): Promise<void> {
		if (!(file instanceof TFile) || file.extension !== "md") return;
		const oldBaseName = path.parse(oldPath).name;
		if (oldBaseName.startsWith("s-")) return;
		const newBaseName = file.basename;
		const oldSnippetPath = `${this.settings.snippetFolderPath}/s-${oldBaseName}.md`;
		const newSnippetPath = `${this.settings.snippetFolderPath}/s-${newBaseName}.md`;
		const snippetFileToRename =
			this.app.vault.getAbstractFileByPath(oldSnippetPath);
		if (!snippetFileToRename) return;
		try {
			await this.app.vault.rename(snippetFileToRename, newSnippetPath);
		} catch (err) {
			console.error(
				`Snipper: Failed to rename snippet file for ${newBaseName}.`,
				err,
			);
		}
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
