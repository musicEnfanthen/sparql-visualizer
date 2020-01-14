import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Title } from '@angular/platform-browser'; // To override title

import { QueryService } from './services/query.service';
import { DataService, ProjectData, TabsData } from './services/data.service';
import { SPARQLService } from './services/sparql.service';

import 'codemirror/mode/turtle/turtle';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
    private queryResult;
    private resultFieldExpanded = false;
    public tabIndex: number;
    public showJSON = false;
    public editDescription = false; // true if in edit mode
    public newDescription: string; // Holds description changes
    public tabTitles: string[];
    public data: TabsData;
    public projectData: ProjectData;
    public queryType: string;
    public reasoning: boolean;
    public queryTime: number;
    public textOnly: boolean;
    public dataOnly = false; // Feature to be implemented
    public fullScreen = false;

    public loading: boolean;
    public loadingMessage: string;

    // Triplestore can easily be disabled
    public triplestoreOption = true;

    // Toggle store
    public localStore = true;
    public toggleTooltip = 'Switch to triplestore';

    // Codemirror
    cmConfig = {
        lineNumbers: true,
        firstLineNumber: 1,
        lineWrapping: true,
        matchBrackets: true,
        mode: 'text/turtle'
    };

    constructor(
        private queryService: QueryService,
        private dataService: DataService,
        private sparqlService: SPARQLService,
        private route: ActivatedRoute,
        public snackBar: MatSnackBar,
        private titleService: Title
    ) {}

    ngOnInit() {
        this.route.queryParams.subscribe(map => {
            // If a tab is specified, use this. Else default to first tab
            this.tabIndex = map.tab ? parseInt(map.tab, 10) : 0;

            // If triplestore mode is defined, use this
            this.localStore = map.local !== 0;

            // Get tab titles
            this.dataService.getTabTitles().subscribe(res => {
                console.log('AppComponent# tabtitle: ', res);
                this.tabTitles = res;
            });

            // Get project data
            this.dataService.getProjectData().subscribe(res => {
                console.log('AppComponent# projectdata: ', res);
                this.projectData = res;
                // Change page title
                this.titleService.setTitle(this.projectData.title);
            });

            this.changeTab(this.tabIndex);
        });

        // Inject shared services
        this.dataService.loadingStatus.subscribe(loading => (this.loading = loading));
        this.dataService.loadingMessage.subscribe(msg => (this.loadingMessage = msg));
    }

    changeMsg() {
        this.dataService.setLoadingMessage('Loading triples in store');
    }

    doQuery() {
        let query = this.data.query;
        const data = this.data.triples;

        if (!data) {
            return;
        }

        // If no prefix is defined in the query, get it from the turtle file
        if (query.toLowerCase().indexOf('prefix') === -1) {
            query = this.queryService.appendPrefixesToQuery(query, data);
            this.data.query = query;
        }

        // Get the query type
        this.queryType = this.queryService.getQuerytype(query);

        // If in localstore mode
        if (this.localStore) {
            this.queryLocalstore(query, data);
        } else {
            this.queryTriplestore(query);
        }
    }

    doRDFLibQuery() {
        let query = this.data.query;
        const data = this.data.triples;

        if (!data) {
            return;
        }

        // If no prefix is defined in the query, get it from the turtle file
        if (query.toLowerCase().indexOf('prefix') === -1) {
            query = this.queryService.appendPrefixesToQuery(query, data);
            this.data.query = query;
        }

        // Get the query type
        this.queryType = this.queryService.getQuerytype(query);

        // If in localstore mode
        this.queryLocalstoreWithRDFLib(query, data);
    }

    async queryLocalstoreWithRDFLib(query, data) {
        // Perform query with client based rdfstore
        try {
            this.queryResult = await this.queryService.doRDFJSLibQuery(query, data);
            this.resultFieldExpanded = true;
        } catch (err) {
            this.queryResult = '';
            if (err.message && err.name) {
                if (err.indexOf('undefined') !== -1) {
                    this.showSnackbar('The query did not return any results', 10000);
                }
                this.showSnackbar(err.name + ': ' + err.message, 10000);
            }
        }
    }

    log(ev) {
        console.log('AppComponent# log', ev);
    }

    async queryLocalstore(query, data) {
        if (this.reasoning) {
            // Show loader
            this.dataService.setLoadingMessage('Performing query using Hylar');
            this.dataService.setLoaderStatus(true);

            /* TODO: readd Hylar
            // Query Hylar based endpoint
            this.queryService.doHylarQuery(query, data).subscribe(
                res => {
                    this.queryResult = res;
                    this.resultFieldExpanded = true;
                    this.dataService.setLoaderStatus(false);
                },
                err => {
                    this.dataService.setLoaderStatus(false);
                    this.queryResult = '';
                    if (err.indexOf('undefined') !== -1) {
                        this.showSnackbar('The query did not return any results', 10000);
                    }
                    if (err.message && err.name) {
                        this.showSnackbar(err.name + ': ' + err.message, 10000);
                    }
               }
            );
            */
        } else {
            // Perform query with client based rdfstore
            try {
                this.queryResult = await this.queryService.doQuery(query, data);
                this.resultFieldExpanded = true;
            } catch (err) {
                this.queryResult = '';
                if (err.message && err.name) {
                    if (err.indexOf('undefined') !== -1) {
                        this.showSnackbar('The query did not return any results', 10000);
                    }
                    this.showSnackbar(err.name + ': ' + err.message, 10000);
                }
            }
        }
    }

    async queryTriplestore(query) {
        const t1 = Date.now();

        // Perform query
        let qRes;
        try {
            if (this.queryType === 'update') {
                qRes = await this.sparqlService.updateQuery(query);
                this.showSnackbar('Query successful');
                return; // Stop here
            } else {
                qRes = await this.sparqlService.getQuery(query, this.reasoning);
            }
        } catch (err) {
            return this.showSnackbar(err.statusText);
        }

        // Show Stardog error message
        if (qRes.message) {
            console.log(qRes.message);
            return this.showSnackbar(qRes.message);
        }

        // Capture query time
        this.queryTime = Date.now() - t1;

        // POST PROCESSING

        // If it's a select query, just return the result as it is
        if (this.queryType === 'select') {
            this.queryResult = qRes;
            this.resultFieldExpanded = true;
        }

        // If it is a construct query, process data
        if (this.queryType === 'construct') {
            const q = 'CONSTRUCT WHERE {?s ?p ?o}';

            let processed;
            try {
                processed = await this.queryService.doQuery(q, qRes);
            } catch (err) {
                console.log(err);
                return this.showSnackbar(err);
            }

            if (!processed) {
                this.queryResult = null;
                this.showSnackbar('Query returned no results. Did you load the correct dataset?');
                return;
            }

            this.queryResult = processed;
            this.resultFieldExpanded = true;
        }

        // Support for COUNT and DESCRIBE + SHOW RAW
    }

    resetTriples() {
        this.dataService.getSingle(this.tabIndex).subscribe(x => {
            this.data.triples = x.triples;
        });
    }

    toggleStore() {
        this.localStore = this.localStore === false ? true : false;
        this.toggleTooltip =
            this.toggleTooltip === 'Switch to datasets' ? 'Switch to triplestore' : 'Switch to datasets';
    }

    changeTab(i) {
        if (i === 'new') {
            console.log('Add new dataset');
        } else {
            this.tabIndex = i;

            console.log('AppComponent# changeTab', this.tabIndex);

            this.dataService.getSingle(i).subscribe(x => {
                this.data = x;

                console.log('AppComponent# data', this.data);

                // Use reasoning if the JSON says so
                this.reasoning = x.reasoning ? x.reasoning : false;

                // Hide triples, query and result tab if setting textOnly is true
                this.textOnly = x.textOnly ? x.textOnly : false;

                // Perform the query if the tab has a query assigned
                if (this.data.query) {
                    this.doQuery();
                } else {
                    this.queryResult = null;
                }
            });
        }
    }

    tableClick(URI) {
        let query;
        if (this.localStore) {
            query = `SELECT * WHERE {\n\tBIND(<${URI}> AS ?el)\n\t?el ?key ?value\n}`;
        } else {
            query = `SELECT *\nWHERE {\n\tBIND(<${URI}> AS ?el)\n\tOPTIONAL { \n\t\tGRAPH ?graph {\n\t\t\t?el ?key ?value .\n\t\t}\n\t}\n\tOPTIONAL { ?el ?key ?value . }\n}`;
        }
        this.data.query = query;
        this.doQuery();
    }

    toggleView(ev) {
        console.log('AppComponent# toggleView', ev);
    }

    graphClick(URI) {
        console.log('AppComponent# graphClick URI', URI);
    }

    showSnackbar(message, durationValue?) {
        if (!durationValue) {
            durationValue = 10000;
        }
        this.snackBar.open(message, 'close', {
            duration: durationValue
        });
    }

    saveDescription() {
        // If changes received
        if (this.newDescription) {
            this.data.description = this.newDescription;
        }
        this.editDescription = false;
    }

    update(ev) {
        console.log('AppComponent# update', ev);
    }
}
