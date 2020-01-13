import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';

import { mergeMap, map } from 'rxjs/operators';
import { Observable, BehaviorSubject } from 'rxjs';

import * as existsFile from 'exists-file';
import * as _ from 'lodash';
import * as N3 from 'n3';
import * as rdfstore from 'rdfstore';

// services
import { ProjectSettingsService } from './project-settings.service';

export interface TabsData {
    title: string;
    description: string;
    triples: string;
    query: string;
    reasoning?: boolean;
    textOnly?: boolean;
}

export interface ProjectData {
    title: string;
    creator?: string;
}

export interface Data {
    project: ProjectData;
    tabs: TabsData[];
}

@Injectable()
export class DataService {
    constructor(
        public http: HttpClient,
        private route: ActivatedRoute,
        private projectSettingsService: ProjectSettingsService,
        private sanitizer: DomSanitizer
    ) {}

    private filePath = './assets/data.json';
    private prefixPath = './assets/prefixes.json';

    // SHARED SERVICES
    private loadingSource = new BehaviorSubject<boolean>(false);
    public loadingStatus = this.loadingSource.asObservable();

    private loadingMsgSource = new BehaviorSubject<string>('loading...');
    public loadingMessage = this.loadingMsgSource.asObservable();

    getPath(): Observable<string> {
        // Get URL parameters
        return this.route.queryParams.pipe(
            map(x => {
                // If a file path is specified, use this instead of the default
                let path = './assets/data.json';
                if (x.file) {
                    // convert improperly formatted dropbox link
                    path = x.file.replace('www.dropbox', 'dl.dropboxusercontent');
                }

                return path;
            })
        );
    }

    getProjectData(): Observable<ProjectData> {
        // First get file path from URL query parameter
        return this.getPath().pipe(
            mergeMap(path => {
                return this.http.get<any>(path).pipe(
                    map(x => {
                        // Title only exists on new JSON
                        if (this.isOldJSONFormat(x)) {
                            return { title: 'visualization' };
                        } else {
                            const dataNew: Data = x;
                            return dataNew.project;
                        }
                    })
                );
            })
        );
    }

    getProjectSettings() {
        // First get file path from URL query parameter
        return this.getPath().pipe(
            mergeMap(path => {
                return this.http.get<any>(path).pipe(
                    map(x => {
                        return x.settings ? x.settings : false;
                    }),
                    map(settings => {
                        if (!settings) {
                            settings = this.projectSettingsService.getDataSettings();
                        }
                        return settings;
                    })
                );
            })
        );
    }

    getTabTitles(): Observable<string[]> {
        // First get file path from URL query parameter
        return this.getPath().pipe(
            mergeMap(path => {
                return this.http.get<any>(path).pipe(
                    map(x => {
                        // An extra level has been added to JSON file since first release
                        // For backward support, a check is needed
                        if (this.isOldJSONFormat(x)) {
                            const dataOld: TabsData[] = x;
                            return _.map(dataOld, d => d.title);
                        } else {
                            const dataNew: Data = x;
                            return _.map(dataNew.tabs, d => d.title);
                        }
                    })
                );
            })
        );
    }

    getSingle(index): Observable<TabsData> {
        // First get file path from URL query parameter
        return this.getPath().pipe(
            mergeMap(path => {
                return this.http.get<any>(path).pipe(
                    map(x => {
                        if (this.isOldJSONFormat(x)) {
                            return x[index];
                        } else {
                            return x.tabs[index];
                        }
                    }),
                    map(x => {
                        x.query = Array.isArray(x.query) ? x.query.join('\n') : x.query;
                        x.description = Array.isArray(x.description) ? x.description.join('\n') : x.description;
                        x.triples = Array.isArray(x.triples) ? x.triples.join('\n') : x.triples;
                        return x;
                    })
                );
            })
        );
    }

    getPrefixes() {
        return this.http.get<any>(this.prefixPath);
    }

    setLoaderStatus(status: boolean) {
        this.loadingSource.next(status);
    }

    setLoadingMessage(msg: string) {
        this.loadingMsgSource.next(msg);
    }

    private isOldJSONFormat(data) {
        if (Array.isArray(data)) {
            return true;
        } else {
            return false;
        }
    }
}
