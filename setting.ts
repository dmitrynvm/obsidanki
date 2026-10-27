import ObsidankiPlugin, { getAppInstance, log } from "main";
import { App, Modifier, Notice, Platform, PluginSettingTab, Setting, normalizePath } from "obsidian";
import i18n from 'i18next';

export interface ObsidankiSettings {
    DefaultEase: number;
    EasyBonus: number;
    HardBonus: number;
    OneLineDelimeter: string;
    OneLineReversedDelimeter: string;
    MultiLineDelimeter: string;
    ObsidankiDbPath: string;
    ExcludeWorkingPathesPattern: string;
    SourceNavigationModifier: Exclude<Modifier, "Mod">;
    CollapsedTreeNodes: string[];
	UseNewLineAsSplitter: boolean;
}

export const OBSIDANKI_DEFAULT_SETTINGS: ObsidankiSettings = {
    DefaultEase: 250,
    EasyBonus: 1,
    HardBonus: 1,
    OneLineDelimeter: "::",
    OneLineReversedDelimeter: ":::",
    MultiLineDelimeter: "?",
    // Empty means the default file inside the vault's config folder.
    ObsidankiDbPath: "",
    ExcludeWorkingPathesPattern: "",
    SourceNavigationModifier: Platform.isMacOS ? "Meta" : "Ctrl",
    CollapsedTreeNodes: [],
	UseNewLineAsSplitter: false
}

export function defaultDbPath(): string {
    return normalizePath(`${getAppInstance().vault.configDir}/obsidanki.db`);
}

export function resolveDbPath(path: string): string {
    const trimmed = path.trim();
    return trimmed.length > 0 ? normalizePath(trimmed) : defaultDbPath();
}

// 排除规则一行一条。Obsidian 的路径相对 vault 根目录、不带开头的 /、分隔符是 /，
// 所以顺手去掉首尾空白和开头的 / 或 ./，并把 Windows 风格的 \ 换成 /
export function parseExcludePatterns(setting: string): string[] {
    return setting.split("\n")
        .map((p) => p.trim().replace(/\\/g, "/").replace(/^\.?\/+/, ""))
        .filter((p) => p.length > 0)
}

export let GlobalSettings: ObsidankiSettings

export function setGlobalSettings(s: Partial<ObsidankiSettings> | null) {
    let settings: ObsidankiSettings = Object.assign({}, OBSIDANKI_DEFAULT_SETTINGS, s);
    // Discard the retired TTS option from older saved settings.
    delete (settings as ObsidankiSettings & { WordTTSURL?: string }).WordTTSURL;
    log(() => ["GlobalSettings", settings]);
    GlobalSettings = settings
}

export class ObsidankiSettingTab extends PluginSettingTab {
    plugin: ObsidankiPlugin;
    private exclusionsAtOpen = "";

    constructor(app: App, plugin: ObsidankiPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        this.exclusionsAtOpen = GlobalSettings.ExcludeWorkingPathesPattern;
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('obsidanki-ui');

        new Setting(containerEl)
            .setName(i18n.t('SettingsSourceNavigationModifier') || "")
            .setDesc(i18n.t('SettingsSourceNavigationModifierDesc') || "")
            .addDropdown(dropdown => dropdown
                .addOptions({
                    Meta: i18n.t(Platform.isMacOS ? 'ModifierCommand' : 'ModifierMeta'),
                    Ctrl: i18n.t('ModifierControl'),
                    Alt: i18n.t(Platform.isMacOS ? 'ModifierOption' : 'ModifierAlt'),
                    Shift: i18n.t('ModifierShift'),
                })
                .setValue(GlobalSettings.SourceNavigationModifier)
                .onChange(async (value) => {
                    GlobalSettings.SourceNavigationModifier = value as ObsidankiSettings['SourceNavigationModifier'];
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(i18n.t('SettingTextInitEase') || "")
            .setDesc(i18n.t('SettingTextInitEaseDesc') || "")
            .addText(text => text
                .setPlaceholder('100-500')
                .setValue(GlobalSettings.DefaultEase.toString())
                .onChange(async (value) => {
                    GlobalSettings.DefaultEase = Number(value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(i18n.t('SettingTextEasyChoice') || "")
            .setDesc(i18n.t('SettingTextEaseChoiceDesc') || "")
            .addText(text => text
                .setPlaceholder('0-10')
                .setValue(GlobalSettings.EasyBonus.toString())
                .onChange(async (value) => {
                    GlobalSettings.EasyBonus = Number(value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(i18n.t('SettingTextHardChoice') || "")
            .setDesc(i18n.t('SettingTextHardChoiceDesc') || "")
            .addText(text => text
                .setPlaceholder('0-10')
                .setValue(GlobalSettings.HardBonus.toString())
                .onChange(async (value) => {
                    GlobalSettings.HardBonus = Number(value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(i18n.t('SettingsOneLineDelimeter') || '')
            .setDesc(i18n.t('SettingsOneLineDelimeterDesc') || "")
            .addText(text => text
                .setPlaceholder('::')
                .setValue(GlobalSettings.OneLineDelimeter)
                .onChange(async (value) => {
                    if (value.length > 0 && !(/^\s*$/.test(value))) {
                        GlobalSettings.OneLineDelimeter = value
                        await this.plugin.saveSettings();
                    } else {
                        new Notice(i18n.t('SettingsOneLineDelimeterError') || "Cannot be empty or whitespace only.");
                    }
                }))

        new Setting(containerEl)
            .setName(i18n.t('SettingsOneLineReversedDelimeter') || '')
            .setDesc(i18n.t('SettingsOneLineReversedDelimeterDesc') || "")
            .addText(text => text
                .setPlaceholder('::')
                .setValue(GlobalSettings.OneLineReversedDelimeter)
                .onChange(async (value) => {
                    if (value.length > 0 && !(/^\s*$/.test(value))) {
                        GlobalSettings.OneLineReversedDelimeter = value
                        await this.plugin.saveSettings();
                    } else {
                        new Notice(i18n.t('SettingsOneLineReversedDelimeterError') || "Cannot be empty or whitespace only.");
                    }
                }))

        new Setting(containerEl)
            .setName(i18n.t('SettingsMultiLineDelimeter') || '')
            .setDesc(i18n.t('SettingsMultiLineDelimeterDesc') || "")
            .addText(text => text
                .setPlaceholder('?')
                .setValue(GlobalSettings.MultiLineDelimeter)
                .onChange(async (value) => {
                    if (value.length > 0 && !(/^\s*$/.test(value))) {
                        GlobalSettings.MultiLineDelimeter = value
                        await this.plugin.saveSettings();
                    } else {
                        new Notice(i18n.t('SettingsMultiLineDelimeterError') || "Cannot be empty or whitespace only.");
                    }
                }))

        new Setting(containerEl)
            .setName(i18n.t('SettingsDbPath') || '')
            .setDesc(i18n.t('SettingsDbPathDesc', { path: defaultDbPath() }) || "")
            .addText(text => text
                .setPlaceholder(defaultDbPath())
                .setValue(GlobalSettings.ObsidankiDbPath)
                .onChange(async (value) => {
                    GlobalSettings.ObsidankiDbPath = value.trim().length > 0 ? normalizePath(value) : "";
                    await this.plugin.saveSettings();
                }))
        new Setting(containerEl)
            .setName(i18n.t('SettingsExcludeDirectories') || '')
            .setDesc(i18n.t('SettingsExcludeDirectoriesDesc') || "")
            .addTextArea(text => {
                // 一行一条，默认两行高会把后面的规则藏起来
                text.inputEl.rows = 5
                return text
                    .setPlaceholder('Archive/\n**/Templates/**\nNotes/Todo.md')
                    .setValue(GlobalSettings.ExcludeWorkingPathesPattern)
                    .onChange(async (value) => {
                        GlobalSettings.ExcludeWorkingPathesPattern = value;
                        await this.plugin.saveSettings();
                    })
            })

		new Setting(containerEl)
			.setName(i18n.t('SettingsNewLineAsSplitter') || '')
			.setDesc(i18n.t('SettingsNewLineAsSplitterDesc') || "")
			.addToggle(toggle => toggle
				.setValue(GlobalSettings.UseNewLineAsSplitter)
				.onChange(async (value) => {
					GlobalSettings.UseNewLineAsSplitter = value;
					await this.plugin.saveSettings();
				}))
	}

    hide(): void {
        super.hide();
        const exclusions = GlobalSettings.ExcludeWorkingPathesPattern;
        if (exclusions !== this.exclusionsAtOpen) {
            this.exclusionsAtOpen = exclusions;
            void this.plugin.refreshTreeViews();
        }
    }
}
