console.log('PimIntegrationPlugin early loading');

import { Plugin, Notice, Modal, App } from 'obsidian';
import * as child_process from 'child_process';
import * as path from 'path';
import {
  PimIntegrationSettingsMgr,
  PimIntegrationSettingsMgrGeneric as PimIntegrationSettingsMgrSimple,
} from './settings';
import { PimIntegrationSettingsController } from './gui/settingsController';
import { PimIntegrationImportContacts } from './gui/modals';
import { PimIntegrationImportCalendar } from './gui/calendarModals';
import { DatePickerModal } from './gui/datePickerModal';
import { ObsidianUtils } from './utils/obsidianUtils';
import { IBackendManager } from './pimbackend/IBackendManager';
import { match } from 'oxide.ts';

// Extend global type for edge-js path patching
declare global {
  var __OBSIDIAN_PLUGIN_DIR__: string | null;
}

console.log('PimIntegrationPlugin loading');

export default class PimIntegrationPlugin extends Plugin {
  pimBackendManager: IBackendManager | null = null;
  settingsMgr: PimIntegrationSettingsMgr = new PimIntegrationSettingsMgrSimple(this);

  pluginDir: string = '';

  async onload() {
    await this.settingsMgr.loadSettings();

    const pluginRes = ObsidianUtils.getPluginDir(this, this.app);
    if (pluginRes.isErr()) {
      new Notice('Error: Could not determine plugin directory: ' + pluginRes.unwrapErr());
      return;
    }
    this.pluginDir = pluginRes.unwrap();

    // Set the plugin directory globally for edge-js before importing BackendManager
    if (typeof global !== 'undefined') {
      global.__OBSIDIAN_PLUGIN_DIR__ = this.pluginDir;
      console.log('[edge-js setup] Plugin directory set to:', this.pluginDir);
    }

    // Now dynamically import BackendManager after the path is set
    const { BackendManager } = await import('./pimbackend/BackendManager');
    this.pimBackendManager = new BackendManager(this.pluginDir);

    // Apply settings after backend manager is initialized
    this.applySettings();

    // Existing import-contacts command
    this.addCommand({
      id: 'import-contacts',
      name: 'Import Contacts to Obsidian',
      callback: () => {
        if (!this.pimBackendManager) {
          ObsidianUtils.logAndNotice('Error: Backend manager not initialized');
          return;
        }
        const backendRes = this.pimBackendManager.getSelectedBackendType();
        if (backendRes.isOk()) {
          const importer = new PimIntegrationImportContacts(
            this.app,
            this.pluginDir,
            this.settingsMgr,
            backendRes.unwrap()
          );
          importer.importContacts().then((result) => {
            match(result, {
              Ok: (message) => {
                ObsidianUtils.logAndNotice(`Import completed successfully: ${message}`);
              },
              Err: (error) => {
                ObsidianUtils.logAndNotice(`Import completed with errors: ${error}`);
              },
            });
          });
          ObsidianUtils.logAndNotice('Importing contacts...');
        } else {
          ObsidianUtils.logAndNotice(
            'Error: No PIM backend selected or could not be loaded: ' + backendRes.unwrapErr()
          );
        }
      },
    });

    this.addCommand({
      id: 'import-calendar-today',
      name: 'Import Calendar Events for Today',
      callback: () => {
        this.importCalendarForDate(new Date());
      },
    });

    this.addCommand({
      id: 'import-calendar-date',
      name: 'Import Calendar Events for Date',
      callback: async () => {
        const date = await new DatePickerModal(this.app, new Date()).open();
        if (!date) return;
        this.importCalendarForDate(date);
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    const settingsController = PimIntegrationSettingsController.create(
      this.app,
      this,
      this.settingsMgr,
      this.pimBackendManager
    );
    if (settingsController.isErr()) {
      new Notice(
        'Error: Could not create settings controller: ' + settingsController.unwrapErr().message
      );
      return;
    }
    this.addSettingTab(settingsController.unwrap());
  }

  onunload() {}

  // TOOD: Move close to calendar commands
  private importCalendarForDate(date: Date) {
    if (!this.pimBackendManager) {
      ObsidianUtils.logAndNotice('Error: Backend manager not initialized');
      return;
    }
    const backendRes = this.pimBackendManager.getSelectedBackendType();
    if (backendRes.isErr()) {
      ObsidianUtils.logAndNotice(
        'Error: No PIM backend selected or could not be loaded: ' + backendRes.unwrapErr()
      );
      return;
    }
    const importer = new PimIntegrationImportCalendar(
      this.app,
      this.pluginDir,
      this.settingsMgr,
      backendRes.unwrap()
    );
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    importer.importCalendarForDate(date).then((result) => {
      match(result, {
        Ok: (message) => {
          ObsidianUtils.logAndNotice(`Calendar import for ${dateStr} completed: ${message}`);
        },
        Err: (error) => {
          ObsidianUtils.logAndNotice(`Calendar import for ${dateStr} failed: ${error}`);
        },
      });
    });
    ObsidianUtils.logAndNotice(`Importing calendar events for ${dateStr}...`);
  }

  // TODO: Use nested settings such that classes can load their own settings directly (settings sub-types)
  applySettings() {
    if (!this.pimBackendManager) {
      console.log('Backend manager not yet initialized, skipping applySettings');
      return;
    }
    const selectedBackendSetting = this.settingsMgr.getSettingValue('selectedPimBackend');
    let selectedBackend = null;
    if (!selectedBackendSetting) {
      ObsidianUtils.logAndNotice('Error: No PIM backend selected in settings.');
    } else {
      ObsidianUtils.logAndNotice(`Selecting PIM backend: ${selectedBackendSetting.getName()}`);
      const res = this.pimBackendManager.selectBackend(selectedBackendSetting);
      if (res.isOk()) {
        selectedBackend = res.unwrap();

        // Apply dotnetPath setting to Outlook backend if applicable
        const dotnetPath = this.settingsMgr.getSettingValue('dotnetPath');
        if (
          dotnetPath &&
          'setDotnetPath' in selectedBackend &&
          typeof selectedBackend.setDotnetPath === 'function'
        ) {
          selectedBackend.setDotnetPath(dotnetPath);
        }

        // Apply includePrivateCalendarEvents setting to Outlook backend if applicable
        const includePrivateCalendarEvents = this.settingsMgr.getSettingValue('includePrivateCalendarEvents');
        if (
          'setIncludePrivateCalendarEvents' in selectedBackend &&
          typeof selectedBackend.setIncludePrivateCalendarEvents === 'function'
        ) {
          selectedBackend.setIncludePrivateCalendarEvents(includePrivateCalendarEvents);
        }

        // Apply outlookCalendarName setting to Outlook backend if applicable
        const outlookCalendarName = this.settingsMgr.getSettingValue('outlookCalendarName');
        if (
          'setOutlookCalendarFolder' in selectedBackend &&
          typeof selectedBackend.setOutlookCalendarFolder === 'function'
        ) {
          selectedBackend.setOutlookCalendarFolder(outlookCalendarName);
        }
      } else {
        ObsidianUtils.logAndNotice(`Error loading PIM backend: ${res.unwrapErr()}`);
      }
    }

    const selectedBackendVariant = this.settingsMgr.getSettingValue('selectedPimBackendVariant');
    if (selectedBackendVariant && selectedBackend) {
      ObsidianUtils.logAndNotice(
        `Selected PIM backend variant: ${selectedBackendVariant.getName()}`
      );
      const res = selectedBackend.selectBackendVariant(selectedBackendVariant);
      if (res.isErr()) {
        ObsidianUtils.logAndNotice(`Error loading PIM backend variant: ${res.unwrapErr()}`);
      } else {
        // Skip deps.json generation during initial plugin load - files will be
        // generated when user explicitly changes settings in the UI
        selectedBackend.onSelectBackendType(res.unwrap(), true).then((initResult) => {
          if (initResult.isErr()) {
            ObsidianUtils.logAndNotice(`Error initializing backend: ${initResult.unwrapErr()}`);
          }
        });
      }
    }
  }
}
