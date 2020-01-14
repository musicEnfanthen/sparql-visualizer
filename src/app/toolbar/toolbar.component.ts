import { Component, Input, Inject, Output, EventEmitter, HostListener } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer } from '@angular/platform-browser';

import { SettingsDialogComponent } from './settings-dialog/settings-dialog.component';
import { MessageDialogComponent } from '../dialogs/message-dialog.component';
import { VideoDialogComponent } from '../dialogs/video-dialog.component';

@Component({
    selector: 'app-visualizer-toolbar',
    templateUrl: './toolbar.component.html',
    styleUrls: ['./toolbar.component.css']
})
export class ToolbarComponent {
    @Input() title: string;
    @Input() creator: string;

    @Output() toggleFullScreen = new EventEmitter<boolean>();

    public fullScreen = false;

    videos = [
        { title: '1: The basics', id: 'ixrhgKHKXDY' },
        { title: '2: Running locally', id: 'KgtAgyzwEpk' }
    ];

    about = `
The development of this tool was initiated by [Mads Holten Rasmussen](https://www.researchgate.net/profile/Mads_Holten_Rasmussen) and developed in collaboration with [Mathias Bonduel](https://www.researchgate.net/profile/Mathias_Bonduel). It is distributed under the [GNU General Public License](https://www.gnu.org/licenses/gpl.txt).

It is based on several open libraries; [rdfstore](https://www.npmjs.com/package/rdfstore), [D3](https://d3js.org/), [Angular](https://angular.io/) etc. and is supposed to be further developed under a copyleft licence.

Please join the effort in further developing the tool so ontology designers can use it in their prototyping and communication. The repo can be forked from [here](https://github.com/MadsHolten/sparql-visualizer).

A special thanks to [Niras](https://www.niras.com/) for co-funding the Industrial PhD-project under which the tool has been developed.`;

    constructor(public dialog: MatDialog, private sanitizer: DomSanitizer, @Inject(DOCUMENT) private document: any) {}

    change(ev) {
        this.title = ev.target.value;
    }

    showAbout() {
        const dialogRef = this.dialog.open(MessageDialogComponent, {
            height: '300px',
            width: '500px',
            data: { title: 'About', message: this.about }
        });
    }

    fullScreenToggle() {
        this.fullScreen = !this.fullScreen;
        this.toggleFullScreen.emit(this.fullScreen);
    }

    // Escape full screen on escape key press
    @HostListener('document:keydown.escape', ['$event']) onKeydownHandler(event: KeyboardEvent) {
        if (this.fullScreen) {
            this.fullScreenToggle();
        }
    }

    downloadApp() {
        this.document.location.href =
            'https://github.com/MadsHolten/sparql-visualizer/blob/master/sparql-viz.zip?raw=true';
    }

    showVideo(videoId) {
        const safeURL = this.sanitizer.bypassSecurityTrustResourceUrl(
            `https://www.youtube.com/embed/${videoId}?autoplay=1`
        );
        const dialogRef = this.dialog.open(VideoDialogComponent, {
            height: '80%',
            width: '70%',
            data: { url: safeURL }
        });
    }

    showWIP() {
        const dialogRef = this.dialog.open(MessageDialogComponent, {
            height: '300px',
            width: '500px',
            data: { title: 'WIP', message: 'This feature is yet to be implemented.' }
        });
    }

    showSettings() {
        const dialogRef = this.dialog.open(SettingsDialogComponent, {
            height: '300px',
            width: '500px'
        });
    }
}
