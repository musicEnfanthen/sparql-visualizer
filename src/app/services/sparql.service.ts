import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { ProjectSettingsService } from './project-settings.service';
import { StardogService } from './stardog.service';
import { QueryService } from './query.service';

export interface ProjectSettings {
    endpoint: string;
    username?: string;
    password?: string;
}

@Injectable()
export class SPARQLService {
    public endpoint: string;
    public updateEndpoint: string;
    public dataEndpoint: string;
    public auth: string;
    public triplestore: string;

    constructor(
        private http: HttpClient,
        private projectSettingsService: ProjectSettingsService,
        private stardogService: StardogService,
        private queryService: QueryService
    ) {}

    getTriplestoreSettings() {
        const tss = this.projectSettingsService.getTriplestoreSettings();
        this.endpoint = tss.endpoint;
        this.updateEndpoint = tss.updateEndpoint;
        this.dataEndpoint = tss.dataEndpoint;
        this.triplestore = tss.tripleStore.toLowerCase();
        this.auth = `Basic ${window.btoa(tss.username + ':' + tss.password)}`;
    }

    public getQuery(query, reasoning?, mimeType?): Promise<any> {
        this.getTriplestoreSettings();

        // Escape plus
        query = query.replace(/\+/g, '%2B');

        const options: any = {};

        if (!mimeType) {
            // Get query type
            const queryType = this.queryService.getQuerytype(query);
            if (queryType === 'construct') {
                options.responseType = 'text';
                options.headers = { Accept: 'text/turtle' };
            } else {
                options.headers = { Accept: 'application/sparql-results+json' };
            }
        }

        if (this.triplestore === 'stardog') {
            return this.stardogService.query(query, reasoning);
        }

        // Default behavior is Fuseki
        options.headers['Authorization'] = this.auth;
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';

        const body = `query=${query}`;

        return this.http.post(this.endpoint, body, options).toPromise();
    }

    public updateQuery(query): Promise<any> {
        this.getTriplestoreSettings();

        // Escape plus
        query = query.replace(/\+/g, '%2B');

        if (this.triplestore === 'stardog') {
            return this.stardogService.query(query);
        }

        // Default behavior is Fuseki
        const headers: any = { Authorization: this.auth, 'Content-Type': 'application/x-www-form-urlencoded' };
        const options: any = { observe: 'response', responseType: 'text', headers };

        const body = `update=${query}`;

        return this.http.post(this.updateEndpoint, body, options).toPromise();
    }

    public loadTriples(triples, graphURI?): Promise<any> {
        this.getTriplestoreSettings();

        if (!this.dataEndpoint) {
            return new Promise((resolve, reject) => reject('No data endpoint provided!'));
        }

        if (this.triplestore === 'stardog') {
            return this.stardogService.loadTriples(triples, graphURI).toPromise();
        }

        // Default behavior uses the Graph Store protocol
        // https://www.w3.org/TR/2013/REC-sparql11-http-rdf-update-20130321/#http-post

        const options = {
            params: {},
            headers: {
                'Content-type': 'text/turtle'
            }
        };

        // If a named graph is specified, set this parameter
        if (graphURI) {
            options.params = { graph: graphURI };
        }

        return this.http.post(this.dataEndpoint, triples, options).toPromise();
    }

    // Download triples from some external resource
    getTriplesFromURL(url): Promise<any> {
        const options = {
            responseType: 'text' as 'text', // responsetype is necessary as Angular tries to convert to JSON if not set
            observe: 'response' as 'response',
            headers: {
                Accept: 'text/turtle'
            }
        };

        return this.http.get(url, options).toPromise();
    }

    /**
     * QUERIES
     */

    wipeDB(namedGraph?) {
        let q: string;
        if (!namedGraph) {
            q = 'DELETE WHERE { ?s ?p ?o }';
        } else {
            q = `DELETE WHERE { Graph <${namedGraph}> { ?s ?p ?o }}`;
        }
        return this.updateQuery(q);
    }

    async getNamedGraphs(): Promise<any> {
        const q = 'SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o}}';

        const res = await this.getQuery(q);

        return res.results.bindings.map(obj => {
            const x: any = obj;
            return x.g.value;
        });
    }
}
