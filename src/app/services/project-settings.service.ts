import { Injectable } from '@angular/core';
import { LocalStorageService } from 'ngx-store';

// Interfaces
import { ProjectSettings } from '../settings/settings.component';

@Injectable()
export class ProjectSettingsService {

  public endpointSettings: ProjectSettings;

  constructor(
    public lss: LocalStorageService
  ) { }

  public saveTriplestoreSettings(object: ProjectSettings) {
    // Save object to {prefix}endpointSettings
    this.lss.set('endpointSettings', object);
  }

  public getTriplestoreSettings() {
    // Get object from {prefix}endpointSettings
    this.endpointSettings = this.lss.get('endpointSettings');
    return this.endpointSettings;
  }

  public saveDataSettings(object) {
    // convert improperly formatted dropbox link
    object.filePath = object.filePath.replace('www.dropbox', 'dl.dropboxusercontent');

    // Save object to {prefix}endpointSettings
    this.lss.set('dataSettings', object);
  }

  public getDataSettings() {
    // Get object from {prefix}endpointSettings
    return this.lss.get('dataSettings');
  }

}
