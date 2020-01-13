import { NgModule } from '@angular/core';
import { BrowserModule, Title } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';

// Local storage
import { WebStorageModule } from 'ngx-store';

// Material design
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';

// Pipes
import { MarkdownToHtmlModule } from 'markdown-to-html-pipe';
import { PrefixPipe } from './pipes/prefix.pipe';
import { PrefixSimplePipe } from './pipes/prefix-simple.pipe';
import { CountryTooltipPipe } from './pipes/country-tooltip.pipe';

// FxFlex
import { FlexLayoutModule } from '@angular/flex-layout';

// Codemirror
import { CodemirrorModule } from 'ng2-codemirror-typescript/Codemirror';

// Clipboard
import { ClipboardModule } from 'ngx-clipboard';

// App
import { AppComponent } from './app.component';
import { QueryFieldComponent } from './query-field/query-field.component';
import { SparqlForceComponent } from './sparql-force/sparql-force.component';
import { SparqlTableComponent } from './sparql-table/sparql-table.component';
import { SettingsComponent } from './settings/settings.component';

// Toolbar and menus
import { ToolbarComponent } from './toolbar/toolbar.component';
import { SettingsDialogComponent } from './toolbar/settings-dialog/settings-dialog.component';

// Dialogs
import { MessageDialogComponent } from './dialogs/message-dialog.component';
import { VideoDialogComponent } from './dialogs/video-dialog.component';
import { InputDialogComponent } from './dialogs/input-dialog.component';
import { SelectDialogComponent } from './dialogs/select-dialog.component';

// Services
import { ProjectSettingsService } from './services/project-settings.service';
import { DataService } from './services/data.service';
import { SPARQLService } from './services/sparql.service';

// Draggable
import { AngularDraggableModule } from 'angular2-draggable';

// Services
import { QueryService } from './services/query.service';
import { StardogService } from './services/stardog.service';

const appRoutes: Routes = [{ path: '**', component: AppComponent }];

@NgModule({
    declarations: [
        AppComponent,
        SparqlForceComponent,
        QueryFieldComponent,
        SparqlTableComponent,
        SettingsComponent,
        ToolbarComponent,
        VideoDialogComponent,
        InputDialogComponent,
        SelectDialogComponent,
        SettingsDialogComponent,
        MessageDialogComponent,
        PrefixPipe,
        PrefixSimplePipe,
        CountryTooltipPipe
    ],
    imports: [
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        HttpClientModule,
        RouterModule.forRoot(
            appRoutes,
            { enableTracing: false } // <-- debugging purposes only
        ),
        CodemirrorModule,
        ClipboardModule,
        WebStorageModule,
        BrowserAnimationsModule,
        MatButtonModule,
        MatInputModule,
        MatSelectModule,
        MatTabsModule,
        MatCardModule,
        MatExpansionModule,
        MatIconModule,
        MatTooltipModule,
        MatSnackBarModule,
        MatTableModule,
        MatSlideToggleModule,
        MatMenuModule,
        MatToolbarModule,
        MatDialogModule,
        MarkdownToHtmlModule,
        MatProgressSpinnerModule,
        MatChipsModule,
        MatCheckboxModule,
        MatPaginatorModule,
        FlexLayoutModule,
        AngularDraggableModule
    ],
    providers: [
        ProjectSettingsService,
        Title,
        DataService,
        PrefixSimplePipe,
        SPARQLService,
        QueryService,
        StardogService
    ],
    bootstrap: [AppComponent],
    entryComponents: [
        MessageDialogComponent,
        VideoDialogComponent,
        InputDialogComponent,
        SelectDialogComponent,
        SettingsDialogComponent
    ]
})
export class AppModule {}
