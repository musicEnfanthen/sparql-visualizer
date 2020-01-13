import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

import { DataService } from '../../services/data.service';
import { ProjectSettingsService } from '../../services/project-settings.service';

export interface Settings {
    filePath: string;
}

// Dialog
@Component({
    selector: 'app-settings-dialog',
    templateUrl: './settings-dialog.component.html',
    styleUrls: ['./settings-dialog.component.css'],
    providers: [DataService, ProjectSettingsService]
})
export class SettingsDialogComponent implements OnInit {
    public title = 'Settings';

    public fileMode: boolean;
    public filePath: string;

    constructor(
        public dialogRef: MatDialogRef<SettingsDialogComponent>,
        private dataService: DataService,
        private projectSettingsService: ProjectSettingsService
    ) {}

    ngOnInit() {
        this.getSettings();
    }

    getSettings() {
        this.dataService.getProjectSettings().subscribe(settings => {
            // Get file path if one is available
            if (settings && settings.filePath) {
                this.fileMode = true;
                this.filePath = settings.filePath;
            }
        });
    }

    saveSettings() {
        const settings = { filePath: this.filePath };
        this.projectSettingsService.saveDataSettings(settings);
        this.onNoClick();
    }

    toggleFileMode() {
        this.fileMode = !this.fileMode;
        if (!this.fileMode) {
            this.filePath = '';
        }
    }

    // Close when clicking outside
    onNoClick(): void {
        this.dialogRef.close();
    }
}
