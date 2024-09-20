import { App, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';
import { GenericTextSuggester } from './suggesters/genericTextSuggester';
import {
  PimIntegrationSettings,
  PimIntegrationSettingsMgr,
  DEFAULT_DOTNET_PATH,
} from '../settings';
import PimIntegrationPlugin from '../main';
import { Result } from 'oxide.ts';
import { IBackendManager } from '../pimbackend/IBackendManager';
import { IBackendType, IBackendTypeDescriptor } from '../pimbackend/IBackendType';
import { IBackendVariant, IBackendVariantDescriptor } from '../pimbackend/IBackendVariant';

export class PimIntegrationSettingsController extends PluginSettingTab {
  private settingsMgr: PimIntegrationSettingsMgr;
  private backendManager: IBackendManager;
  // TODO: Use some bimap package or similar
  private backendIds: Map<
    string,
    IBackendTypeDescriptor<IBackendVariant, IBackendType<IBackendVariant>>
  > = new Map();
  private backendIdsReverse: Map<
    IBackendTypeDescriptor<IBackendVariant, IBackendType<IBackendVariant>>,
    string
  > = new Map();
  private backendIdsLabelMap: Record<string, string> = {};
  private backendVariantIds: Map<string, IBackendVariantDescriptor<IBackendVariant>> = new Map();
  private backendVariantIdsReverse: Map<IBackendVariantDescriptor<IBackendVariant>, string> =
    new Map();
  private backendVariantIdsLabelMap: Record<string, string> = {};
  private settings: PimIntegrationSettings;

  private constructor(
    app: App,
    plugin: PimIntegrationPlugin,
    settingsMgr: PimIntegrationSettingsMgr,
    backendManager: IBackendManager
  ) {
    super(app, plugin);
    this.settingsMgr = settingsMgr;
    this.backendManager = backendManager;
    const settings = settingsMgr.getSettings();
    if (settings.isErr()) {
      throw new Error(settings.unwrapErr());
    }
    this.settings = settings.unwrap();
  }

  public static create(
    app: App,
    plugin: PimIntegrationPlugin,
    settingsMgr: PimIntegrationSettingsMgr,
    backendManager: IBackendManager
  ): Result<PimIntegrationSettingsController, Error> {
    return Result.safe(
      () => new PimIntegrationSettingsController(app, plugin, settingsMgr, backendManager)
    );
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h1', { text: 'Obsidian PIM Integration Settings' });

    this.addBackendSetting();
    this.addBackendVariantSetting();
    this.addDotnetPathSetting();
    this.addContactFolderPathSetting();
    this.addContactTemplatePathSetting();
  }

  // TODO: Provide generic setting modules for different setting types (List: Enum, file picker, folder picker, text, number, boolean)
  private addBackendSetting() {
    const setting = new Setting(this.containerEl);

    // Create stringID --> Backend mapping for dropdown support
    const supportedBackends = this.backendManager.getSupportedBackends();
    for (let id: number = 0; id < supportedBackends.length; id++) {
      console.log(`Adding backend to settings dropdown: ${id}: ${supportedBackends[id].getName()}`);
      const backendId: string = `${supportedBackends[id].getName()}_${id}`;
      this.backendIds.set(backendId, supportedBackends[id]);
      this.backendIdsReverse.set(supportedBackends[id], backendId);
      this.backendIdsLabelMap[backendId] = supportedBackends[id].getName(); // For now, use the same string as label
    }

    setting.setName('PIM Backend');
    setting.setDesc('Backend used to fetch contacts and calendar entries');

    setting.addDropdown((dropdown) => {
      dropdown
        .addOptions(this.backendIdsLabelMap)
        .setValue(this.findBackendIdByName(this.settings.selectedPimBackend.getName()))
        .onChange(async (value) => {
          const backend = this.backendIds.get(value);
          if (backend) {
            const res = this.backendManager.selectBackend(backend);
            if (res.isOk()) {
              this.settings.selectedPimBackend = backend;
              this.updateBackendVariantSetting(res.unwrap());
            } else {
              console.error(`Error selecting backend: ${res.unwrapErr()}`);
            }
          } else {
            console.error(`Selected backend ${value} not found in backend mapping`);
          }
          await this.settingsMgr.saveSettings();
        });
    });
  }

  private addBackendVariantSetting() {
    const setting = new Setting(this.containerEl);

    const selectedPimBackend = this.backendManager.getSelectedBackendType();
    if (selectedPimBackend.isErr()) {
      console.error(`Error getting selected backend: ${selectedPimBackend.unwrapErr()}`);
    } else {
      this.updateBackendVariantSetting(selectedPimBackend.unwrap());
    }

    setting.setName('PIM Backend Variant');
    setting.setDesc('Variant of the selected PIM backend (e.g., Outlook version)');

    setting.addDropdown((dropdown) => {
      dropdown
        .addOptions(this.backendVariantIdsLabelMap)
        .setValue(
          this.findBackendVariantIdByName(this.settings.selectedPimBackendVariant.getName())
        )
        .onChange(async (value) => {
          const backendVariant = this.backendVariantIds.get(value);
          if (backendVariant) {
            const backend = this.backendManager.getSelectedBackendType();
            if (backend.isErr()) {
              console.error(`Error getting selected backend: ${backend.unwrapErr()}`);
              return;
            }
            const res = backend.unwrap().selectBackendVariant(backendVariant);
            if (res.isErr()) {
              console.error(`Error selecting backend variant: ${res.unwrapErr()}`);
              return;
            }
            // User explicitly changed settings - generate deps.json files
            const initResult = await backend.unwrap().onSelectBackendType(res.unwrap());
            if (initResult.isErr()) {
              console.error(`Error initializing backend: ${initResult.unwrapErr()}`);
              return;
            }
            this.settings.selectedPimBackendVariant = backendVariant;
          } else {
            console.error(`Selected backend ${value} not found in backend mapping`);
          }
          await this.settingsMgr.saveSettings();
        });
    });
  }

  private updateBackendVariantSetting(selectedPimBackend: IBackendType) {
    // Create stringID --> Backend variant mapping for dropdown support
    const supportedVariants = selectedPimBackend.getVariants();
    for (let id: number = 0; id < supportedVariants.length; id++) {
      console.log(
        `Adding backend variant to settings dropdown: ${id}: ${supportedVariants[id].getName()}`
      );
      const backendId: string = `${supportedVariants[id].getName()}_${id}`;
      this.backendVariantIds.set(backendId, supportedVariants[id]);
      this.backendVariantIdsReverse.set(supportedVariants[id], backendId);
      this.backendVariantIdsLabelMap[backendId] = supportedVariants[id].getName();
    }
  }

  private addDotnetPathSetting() {
    const setting = new Setting(this.containerEl);

    setting.setName('.NET Runtime Path');
    setting.setDesc(
      'Path to the .NET runtime installation directory. Used by the Outlook backend for CoreCLR integration.'
    );

    setting.addText((text) => {
      text
        .setPlaceholder(DEFAULT_DOTNET_PATH)
        .setValue(this.settings.dotnetPath)
        .onChange(async (value) => {
          this.settings.dotnetPath = value || DEFAULT_DOTNET_PATH;
          // Update the backend with the new dotnet path
          const backend = this.backendManager.getSelectedBackendType();
          if (backend.isOk()) {
            const selectedBackend = backend.unwrap();
            if (
              'setDotnetPath' in selectedBackend &&
              typeof selectedBackend.setDotnetPath === 'function'
            ) {
              selectedBackend.setDotnetPath(this.settings.dotnetPath);
            }
          }
          await this.settingsMgr.saveSettings();
        });
      // Make the input wider for path entry
      text.inputEl.style.width = '300px';
    });

    // Add a reset button to restore default path
    setting.addButton((button) => {
      button.setButtonText('Reset to Default').onClick(async () => {
        this.settings.dotnetPath = DEFAULT_DOTNET_PATH;
        // Update the backend with the default dotnet path
        const backend = this.backendManager.getSelectedBackendType();
        if (backend.isOk()) {
          const selectedBackend = backend.unwrap();
          if (
            'setDotnetPath' in selectedBackend &&
            typeof selectedBackend.setDotnetPath === 'function'
          ) {
            selectedBackend.setDotnetPath(DEFAULT_DOTNET_PATH);
          }
        }
        await this.settingsMgr.saveSettings();
        // Refresh the display to show updated value
        this.display();
      });
    });
  }

  private addContactFolderPathSetting() {
    const setting = new Setting(this.containerEl);

    setting.setName('Contact Folder');
    setting.setDesc('Folder in Obsidian to store the contact files');

    setting.addText((text) => {
      text
        .setPlaceholder('Resources/Contacts')
        .setValue(this.settings.contactFolderPath)
        .onChange(async (value) => {
          this.settings.contactFolderPath = value;
          await this.settingsMgr.saveSettings();
        });

      new GenericTextSuggester(
        this.app,
        text.inputEl,
        this.app.vault
          .getAllLoadedFiles()
          .filter((f: { path: string }) => f instanceof TFolder && f.path !== '/')
          .map((f: { path: any }) => f.path)
      );
    });
  }

  private addContactTemplatePathSetting() {
    const setting = new Setting(this.containerEl);

    setting.setName('Contact Template');
    setting.setDesc('Template file for new contact notes');

    setting.addText((text) => {
      text
        .setPlaceholder('Resources/Templates/Contact.md')
        .setValue(this.settings.targetTemplate)
        .onChange(async (value) => {
          this.settings.targetTemplate = value;
          await this.settingsMgr.saveSettings();
        });

      new GenericTextSuggester(
        this.app,
        text.inputEl,
        this.app.vault
          .getAllLoadedFiles()
          .filter((f: { path: string }) => f instanceof TFile && f.path.endsWith('.md'))
          .map((f: { path: any }) => f.path)
      );
    });
  }

  /**
   * Find the backend ID string by matching the backend name.
   * This is needed because settings contain deserialized object instances
   * that don't match the instances in the reverse map by reference.
   */
  private findBackendIdByName(name: string): string {
    for (const [id, descriptor] of this.backendIds.entries()) {
      if (descriptor.getName() === name) {
        return id;
      }
    }
    return '';
  }

  /**
   * Find the backend variant ID string by matching the variant name.
   * This is needed because settings contain deserialized object instances
   * that don't match the instances in the reverse map by reference.
   */
  private findBackendVariantIdByName(name: string): string {
    for (const [id, descriptor] of this.backendVariantIds.entries()) {
      if (descriptor.getName() === name) {
        return id;
      }
    }
    return '';
  }
}
