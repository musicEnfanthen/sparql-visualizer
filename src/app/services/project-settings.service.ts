import { Injectable } from '@angular/core';
import { LocalStorageService } from 'ngx-store';

// Interfaces
import { ProjectSettings } from '../settings/settings.component';

@Injectable()
export class ProjectSettingsService {
    public endpointSettings: ProjectSettings;

    constructor(public localStorageService: LocalStorageService) {}

    public saveTriplestoreSettings(object: ProjectSettings) {
        // Save object to {prefix}endpointSettings
        this.localStorageService.set('endpointSettings', object);
    }

    public getTriplestoreSettings() {
        // Get object from {prefix}endpointSettings
        this.endpointSettings = this.localStorageService.get('endpointSettings');
        return this.endpointSettings;
    }

    public saveDataSettings(object) {
        // convert improperly formatted dropbox link
        object.filePath = object.filePath.replace('www.dropbox', 'dl.dropboxusercontent');

        // Save object to {prefix}endpointSettings
        this.localStorageService.set('dataSettings', object);
    }

    public getDataSettings() {
        // Get object from {prefix}endpointSettings
        return this.localStorageService.get('dataSettings');
    }
}
