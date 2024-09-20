import { App } from 'obsidian';
import { PimIntegrationSettingsMgr } from '../settings';
import { Err, Result } from 'oxide.ts';
import { PimIntegrationContactImporterVCFMarkdown as PimIntegrationContactImporterMarkdown } from '../contacts/ContactImporterMarkdown';
import { ObsidianUtils } from '../utils/obsidianUtils';
import { IBackendType } from '../pimbackend/IBackendType';
import { IContactBackend } from '../pimbackend/IContactBackend';

export class PimIntegrationImportContacts {
  app: App;
  plugin_dir: string;
  settings: PimIntegrationSettingsMgr;
  backend: IBackendType;

  constructor(
    app: App,
    plugin_dir: string,
    settings: PimIntegrationSettingsMgr,
    backend: IBackendType
  ) {
    this.app = app;
    this.plugin_dir = plugin_dir;
    this.settings = settings;
    this.backend = backend;
  }

  importContacts(): Promise<Result<string, string>> {
    const templateFile = this.app.vault.getFileByPath(
      this.settings.getSettingValue('targetTemplate')
    );
    if (!templateFile) {
      ObsidianUtils.logAndNotice(
        `Template file not found or not a markdown file: ${this.settings.getSettingValue('targetTemplate')}`
      );
      return Promise.resolve(
        Err(
          `Template file not found or not a markdown file: ${this.settings.getSettingValue('targetTemplate')}`
        )
      );
    }

    return this.app.vault.read(templateFile).then((content) => {
      if (!content) {
        ObsidianUtils.logAndNotice(
          `Could not read template file: ${this.settings.getSettingValue('targetTemplate')}`
        );
      }

      const importer = new PimIntegrationContactImporterMarkdown(
        this.app,
        this.plugin_dir,
        this.settings.getSettingValue('contactFolderPath'),
        content
      );
      // FIXME: We need a declarative way to know that backend is IContactBackend
      const do_import = async () => {
        return importer.transformContacts(this.backend as unknown as IContactBackend);
        // To be used when multi-threading is operational
        // then(result => {
        // 	match(result, {
        // 		Ok: (message) => {
        // 			ObsidianUtils.logAndNotice(`Import completed successfully: ${message}`);
        // 		},
        // 		Err: (error) => {
        // 			ObsidianUtils.logAndNotice(`Import completed with errors: ${error}`);
        // 		}
        // 	});
        // });
      };
      return do_import();

      // ObsidianUtils.logAndNotice("Contact import process initiated.");
    });
  }

  resetSettingsToDefault(): void {
    this.settings
      .resetSettingsToDefault()
      .then(() => {
        ObsidianUtils.logAndNotice('Settings have been reset to default.');
      })
      .catch((error) => {
        ObsidianUtils.logAndNotice(`Error resetting settings to default: ${error}`);
      });
  }
}
