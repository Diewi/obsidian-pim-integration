import { Plugin } from 'obsidian';
import { Err, Ok, Result } from 'oxide.ts';
import { IBackendTypeDescriptor } from './pimbackend/IBackendType';
import { IBackendVariant, IBackendVariantDescriptor } from './pimbackend/IBackendVariant';
import { BackendVariantOutlook15PlusDescriptor } from './pimbackend/outlook/BackendVariantOutlook15Plus';
import { BackendTypeOutlookDescriptor } from './pimbackend/outlook/BackendTypeOutlook';

/**
 * Default .NET installation path for Windows systems.
 */
export const DEFAULT_DOTNET_PATH = 'C:\\Program Files\\dotnet';

export interface PimIntegrationSettings {
  // TODO: We need to restric this type to only refer to classes implementing IBackendType
  selectedPimBackend: IBackendTypeDescriptor<IBackendVariant>;
  selectedPimBackendVariant: IBackendVariantDescriptor<IBackendVariant>;
  contactFolderPath: string;
  targetTemplate: string;
  calendarFolderPath: string;
  calendarTemplate: string;
  /**
   * Whether to include private/confidential calendar events in the export.
   * Default: false (private events are excluded).
   */
  includePrivateCalendarEvents: boolean;
  /**
   * Outlook calendar folder name for calendar export.
   * Empty string means the user's default calendar.
   */
  outlookCalendarName: string;
  /**
   * Path to the .NET runtime installation directory.
   * Used by the Outlook backend for CoreCLR integration.
   */
  dotnetPath: string;
}

const DEFAULT_SETTINGS: PimIntegrationSettings = {
  selectedPimBackend: new BackendTypeOutlookDescriptor(),
  selectedPimBackendVariant: new BackendVariantOutlook15PlusDescriptor(),
  contactFolderPath: 'Resources/Contacts',
  targetTemplate: 'Resources/Templates/Contact.md',
  calendarFolderPath: 'Resources/Calendar',
  calendarTemplate: 'Resources/Templates/CalendarEvent.md',
  includePrivateCalendarEvents: false,
  outlookCalendarName: '',
  dotnetPath: DEFAULT_DOTNET_PATH,
};

export interface PimIntegrationSettingsMgr {
  getSettings(): Result<PimIntegrationSettings, string>;
  loadSettings(): Promise<void>;
  saveSettings(): Promise<void>;
  resetSettingsToDefault(): Promise<void>;
  getSettingValue<K extends keyof PimIntegrationSettings>(
    propertyName: K
  ): PimIntegrationSettings[K];
}

export class PimIntegrationSettingsMgrGeneric implements PimIntegrationSettingsMgr {
  private settings: PimIntegrationSettings = DEFAULT_SETTINGS;
  private plugin: Plugin;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  public getSettings(): Result<PimIntegrationSettings, string> {
    if (!this.settings) {
      return Err('Settings not loaded');
    }
    return Ok(this.settings);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.plugin.loadData());
    this.settings.selectedPimBackend = new BackendTypeOutlookDescriptor();
    this.settings.selectedPimBackendVariant = new BackendVariantOutlook15PlusDescriptor();
  }

  async saveSettings() {
    await this.plugin.saveData(this.settings);
  }

  async resetSettingsToDefault() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    await this.saveSettings();
  }

  getSettingValue<K extends keyof PimIntegrationSettings>(
    propertyName: K
  ): PimIntegrationSettings[K] {
    return this.getProperty(this.settings ?? DEFAULT_SETTINGS, propertyName);
  }

  // credit: Typescript documentation, src
  // https://www.typescriptlang.org/docs/handbook/advanced-types.html#index-types
  getProperty<T, K extends keyof T>(o: T, propertyName: K): T[K] {
    return o[propertyName]; // o[propertyName] is of type T[K]
  }
}
